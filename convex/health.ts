import { internalAction, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

const alertKind = v.union(v.literal("webhook_stale"), v.literal("catalog_stale"));
type HealthTransition = { kind: "webhook_stale" | "catalog_stale"; message: string };
type HealthResult = { activated: HealthTransition[]; resolved: HealthTransition[] };

export const recordHealth = internalMutation({
  args: {
    checks: v.array(v.object({ kind: alertKind, stale: v.boolean(), message: v.string() })),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const activated: Array<{ kind: "webhook_stale" | "catalog_stale"; message: string }> = [];
    const resolved: Array<{ kind: "webhook_stale" | "catalog_stale"; message: string }> = [];
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
  handler: async (ctx): Promise<HealthResult> => {
    const status = await ctx.runQuery(api.catalog.status, {});
    const now = Date.now();
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
          kind: "catalog_stale",
          stale: status.catalogStale,
          message: status.catalogStale
            ? "Akashic catalog has no successful reconciliation within the last 26 hours."
            : "Akashic catalog reconciliation is healthy.",
        },
      ],
    });
    for (const alert of result.activated) await sendAlert(`[Akashic] ${alert.message}`);
    for (const alert of result.resolved) await sendAlert(`[Akashic resolved] ${alert.message}`);
    return result;
  },
});
