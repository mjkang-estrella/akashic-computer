import { internalAction, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

const alertKind = v.union(
  v.literal("webhook_stale"),
  v.literal("catalog_degraded"),
  v.literal("catalog_stale"),
);
type HealthKind = "webhook_stale" | "catalog_degraded" | "catalog_stale";
type HealthTransition = { kind: HealthKind; message: string };
type HealthResult = { activated: HealthTransition[]; resolved: HealthTransition[] };
const healthTransition = v.object({ kind: alertKind, message: v.string() });
const healthResult = v.object({
  activated: v.array(healthTransition),
  resolved: v.array(healthTransition),
});

export const recordHealth = internalMutation({
  args: {
    checks: v.array(v.object({ kind: alertKind, stale: v.boolean(), message: v.string() })),
    now: v.number(),
  },
  returns: healthResult,
  handler: async (ctx, args) => {
    const activated: HealthTransition[] = [];
    const resolved: HealthTransition[] = [];
    for (const check of args.checks) {
      const existing = await ctx.db
        .query("catalogHealthAlerts")
        .withIndex("by_kind", (q) => q.eq("kind", check.kind))
        .first();
      if (!existing) {
        await ctx.db.insert("catalogHealthAlerts", {
          kind: check.kind,
          active: check.stale,
          message: check.message,
          firstDetectedAt: args.now,
          lastCheckedAt: args.now,
          resolvedAt: check.stale ? undefined : args.now,
        });
        if (check.stale) activated.push({ kind: check.kind, message: check.message });
        continue;
      }
      if (check.stale) {
        await ctx.db.patch(existing._id, {
          active: true,
          message: check.message,
          firstDetectedAt: existing.active ? existing.firstDetectedAt : args.now,
          lastCheckedAt: args.now,
          resolvedAt: undefined,
        });
        if (!existing.active) activated.push({ kind: check.kind, message: check.message });
      } else {
        await ctx.db.patch(existing._id, {
          active: false,
          message: check.message,
          lastCheckedAt: args.now,
          resolvedAt: existing.active ? args.now : existing.resolvedAt,
        });
        if (existing.active) resolved.push({ kind: check.kind, message: check.message });
      }
    }
    return { activated, resolved };
  },
});

async function sendAlert(message: string): Promise<void> {
  const target = process.env.CATALOG_ALERT_WEBHOOK_URL;
  if (!target) {
    console.error(message);
    return;
  }
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message, content: message }),
  });
  if (!response.ok) throw new Error(`Catalog alert delivery failed: ${response.status}`);
}

export const checkCatalogHealth = internalAction({
  args: {},
  returns: healthResult,
  handler: async (ctx): Promise<HealthResult> => {
    const now = Date.now();
    const status = await ctx.runQuery(api.catalog.healthSummary, { now });
    const result: HealthResult = await ctx.runMutation(internal.health.recordHealth, {
      now,
      checks: [
        {
          kind: "webhook_stale",
          stale: status.webhookStale,
          message: status.webhookStale
            ? "Akashic catalog webhook processing has been pending for more than 10 minutes."
            : "Akashic catalog webhook processing is healthy.",
        },
        {
          kind: "catalog_degraded",
          stale: status.level === "degraded",
          message: status.level === "degraded"
            ? `Akashic catalog is current for ${status.freshSourceCount} of ${status.sourceTotal} sources; ${status.staleSourceCount} source refreshes are delayed.`
            : "Akashic catalog has no delayed source refreshes.",
        },
        {
          kind: "catalog_stale",
          stale: status.level === "stale",
          message: status.level === "stale"
            ? "Akashic catalog has no current Hugging Face sources."
            : "Akashic catalog has current Hugging Face source data.",
        },
      ],
    });
    for (const alert of result.activated) await sendAlert(`[Akashic] ${alert.message}`);
    for (const alert of result.resolved) await sendAlert(`[Akashic resolved] ${alert.message}`);
    return result;
  },
});
