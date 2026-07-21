import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function secureEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function assertAdminSecret(secret: string): void {
  const expected = process.env.CATALOG_ADMIN_SECRET;
  if (!expected || !secureEqual(secret, expected)) {
    throw new Error("Invalid catalog admin secret");
  }
}

export const touchCatalogState = internalMutation({
  args: { revision: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("catalogState")
      .withIndex("by_key", (q) => q.eq("key", "public"))
      .unique();
    if (state) await ctx.db.patch(state._id, { revision: args.revision, syncedAt: args.now });
    else await ctx.db.insert("catalogState", { key: "public", revision: args.revision, syncedAt: args.now });
  },
});

/** Synchronize the code-owned source allowlist without reseeding catalog data. */
export const syncSourceConfig = action({
  args: { secret: v.string() },
  handler: async (ctx, args): Promise<{
    inserted: number;
    updated: number;
    disabled: number;
    configured: number;
  }> => {
    assertAdminSecret(args.secret);
    return await ctx.runMutation(internal.seed.seedSources, {});
  },
});

/** Seed one curated family without replacing or reprocessing the wider catalog. */
export const seedFamily = action({
  args: { secret: v.string(), familyId: v.string() },
  handler: async (ctx, args): Promise<{ familyId: string; revision: string }> => {
    assertAdminSecret(args.secret);
    const now = Date.now();
    await ctx.runMutation(internal.seed.seedFamily, { familyId: args.familyId, now });
    const revision = `family:${args.familyId}:${now}`;
    await ctx.runMutation(internal.admin.touchCatalogState, { revision, now });
    return { familyId: args.familyId, revision };
  },
});

/** Start a reconciliation unless one is already active. */
export const runAudit = action({
  args: { secret: v.string() },
  handler: async (ctx, args): Promise<{ scheduled: boolean; runId: string }> => {
    assertAdminSecret(args.secret);
    const result = await ctx.runMutation(internal.sync.startDailyAudit, { paceMs: 30_000 });
    return { scheduled: result.scheduled, runId: String(result.runId) };
  },
});

/** Stop a stuck or obsolete audit. Already scheduled source actions become no-ops. */
export const cancelAudit = action({
  args: { secret: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ cancelled: boolean; runId: string | null }> => {
    assertAdminSecret(args.secret);
    const result = await ctx.runMutation(internal.sync.cancelRunningAudit, {
      reason: args.reason ?? "Cancelled by catalog operator",
      now: Date.now(),
    });
    return { cancelled: result.cancelled, runId: result.runId ? String(result.runId) : null };
  },
});

/** Evaluate freshness immediately instead of waiting for the hourly watchdog. */
export const checkHealth = action({
  args: { secret: v.string() },
  handler: async (ctx, args): Promise<{
    activated: Array<{ kind: "webhook_stale" | "catalog_stale"; message: string }>;
    resolved: Array<{ kind: "webhook_stale" | "catalog_stale"; message: string }>;
  }> => {
    assertAdminSecret(args.secret);
    return await ctx.runAction(internal.health.checkCatalogHealth, {});
  },
});
