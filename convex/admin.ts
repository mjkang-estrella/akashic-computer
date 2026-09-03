import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { convexValuesEqual, scheduleCatalogSnapshotRefresh } from "./catalogSnapshot";
import type { PublishedCatalogEntry } from "../src/lib/atlas/published";

const modelIntroductionArgs = {
  slug: v.string(),
  heading: v.string(),
  summary: v.string(),
  paragraphs: v.array(v.string()),
  highlights: v.array(v.object({ label: v.string(), value: v.string() })),
  sourceLabel: v.string(),
  sourceUrl: v.string(),
  sourceSha: v.optional(v.string()),
};

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
  if (!expected || !secureEqual(secret, expected)) throw new Error("Invalid catalog admin secret");
}

export const requestCatalogSnapshotRefresh = internalMutation({
  args: { now: v.number() },
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("catalogState")
      .withIndex("by_key", (q) => q.eq("key", "public"))
      .unique();
    if (!state) throw new Error("Catalog state is not initialized");
    const scheduled = await scheduleCatalogSnapshotRefresh(
      ctx,
      state._id,
      state.snapshotRefreshScheduledAt,
      args.now,
      0,
    );
    return { scheduled };
  },
});

export const upsertModelIntroduction = internalMutation({
  args: { ...modelIntroductionArgs, now: v.number() },
  returns: v.object({ slug: v.string(), changed: v.boolean() }),
  handler: async (ctx, args) => {
    if (args.heading.length > 120 || args.summary.length > 360) {
      throw new Error("Model introduction heading or summary is too long");
    }
    if (args.paragraphs.length < 1 || args.paragraphs.length > 8) {
      throw new Error("Model introduction requires 1 to 8 paragraphs");
    }
    if (args.paragraphs.some((paragraph) => paragraph.length > 1_200)) {
      throw new Error("Model introduction paragraph is too long");
    }
    if (args.highlights.length > 12) throw new Error("Model introduction has too many highlights");
    const document = await ctx.db
      .query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!document) throw new Error(`Unknown catalog model ${args.slug}`);
    const introduction = {
      heading: args.heading,
      summary: args.summary,
      paragraphs: args.paragraphs,
      highlights: args.highlights,
      sourceLabel: args.sourceLabel,
      sourceUrl: args.sourceUrl,
      ...(args.sourceSha ? { sourceSha: args.sourceSha } : {}),
    };
    const payload = document.payload as PublishedCatalogEntry;
    const changed = !convexValuesEqual(payload.introduction, introduction);
    const existing = await ctx.db
      .query("modelIntroductions")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    const value = { slug: args.slug, ...introduction, updatedAt: args.now };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("modelIntroductions", value);
    if (!changed) return { slug: args.slug, changed: false };

    await ctx.db.patch(document._id, { payload: { ...payload, introduction } });
    const state = await ctx.db
      .query("catalogState")
      .withIndex("by_key", (q) => q.eq("key", "public"))
      .unique();
    if (!state) throw new Error("Catalog state is not initialized");
    await ctx.db.patch(state._id, { revision: `introduction:${args.slug}:${args.now}` });
    await scheduleCatalogSnapshotRefresh(ctx, state._id, state.snapshotRefreshScheduledAt, args.now, 0);
    return { slug: args.slug, changed: true };
  },
});

export const refreshCatalogSnapshot = action({
  args: { secret: v.string() },
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx, args): Promise<{ scheduled: boolean }> => {
    assertAdminSecret(args.secret);
    return await ctx.runMutation(internal.admin.requestCatalogSnapshotRefresh, { now: Date.now() });
  },
});

export const syncSourceConfig = action({
  args: { secret: v.string() },
  returns: v.object({ inserted: v.number(), updated: v.number(), disabled: v.number(), configured: v.number() }),
  handler: async (ctx, args): Promise<{ inserted: number; updated: number; disabled: number; configured: number }> => {
    assertAdminSecret(args.secret);
    return await ctx.runMutation(internal.sourceConfigSync.syncSources, {});
  },
});

export const runAudit = action({
  args: { secret: v.string() },
  returns: v.object({ scheduled: v.boolean(), runId: v.string() }),
  handler: async (ctx, args): Promise<{ scheduled: boolean; runId: string }> => {
    assertAdminSecret(args.secret);
    const result = await ctx.runMutation(internal.sync.startDailyAudit, { paceMs: 30_000 });
    return { scheduled: result.scheduled, runId: String(result.runId) };
  },
});

export const cancelAudit = action({
  args: { secret: v.string(), reason: v.optional(v.string()) },
  returns: v.object({ cancelled: v.boolean(), runId: v.union(v.string(), v.null()) }),
  handler: async (ctx, args): Promise<{ cancelled: boolean; runId: string | null }> => {
    assertAdminSecret(args.secret);
    const result = await ctx.runMutation(internal.sync.cancelRunningAudit, {
      reason: args.reason ?? "Cancelled by catalog operator",
      now: Date.now(),
    });
    return { cancelled: result.cancelled, runId: result.runId ? String(result.runId) : null };
  },
});

const healthTransitionValue = v.object({
  kind: v.union(v.literal("webhook_stale"), v.literal("catalog_degraded"), v.literal("catalog_stale")),
  message: v.string(),
});

export const checkHealth = action({
  args: { secret: v.string() },
  returns: v.object({ activated: v.array(healthTransitionValue), resolved: v.array(healthTransitionValue) }),
  handler: async (ctx, args): Promise<{
    activated: Array<{ kind: "webhook_stale" | "catalog_degraded" | "catalog_stale"; message: string }>;
    resolved: Array<{ kind: "webhook_stale" | "catalog_degraded" | "catalog_stale"; message: string }>;
  }> => {
    assertAdminSecret(args.secret);
    return await ctx.runAction(internal.health.checkCatalogHealth, {});
  },
});

const deploymentRecipeSyncResultValue = v.object({
  provider: v.union(v.literal("vllm"), v.literal("sglang")),
  status: v.union(v.literal("unchanged"), v.literal("synchronized"), v.literal("failed")),
  recipes: v.number(),
  matchedEntries: v.number(),
  error: v.optional(v.string()),
});

export const syncDeploymentRecipes = action({
  args: { secret: v.string(), force: v.optional(v.boolean()) },
  returns: v.array(deploymentRecipeSyncResultValue),
  handler: async (ctx, args): Promise<Array<{
    provider: "vllm" | "sglang";
    status: "unchanged" | "synchronized" | "failed";
    recipes: number;
    matchedEntries: number;
    error?: string;
  }>> => {
    assertAdminSecret(args.secret);
    return await ctx.runAction(internal.deploymentRecipeSync.syncAll, { force: args.force });
  },
});

export const setModelIntroduction = action({
  args: { secret: v.string(), ...modelIntroductionArgs },
  returns: v.object({ slug: v.string(), changed: v.boolean() }),
  handler: async (ctx, args): Promise<{ slug: string; changed: boolean }> => {
    assertAdminSecret(args.secret);
    return await ctx.runMutation(internal.admin.upsertModelIntroduction, {
      slug: args.slug,
      heading: args.heading,
      summary: args.summary,
      paragraphs: args.paragraphs,
      highlights: args.highlights,
      sourceLabel: args.sourceLabel,
      sourceUrl: args.sourceUrl,
      sourceSha: args.sourceSha,
      now: Date.now(),
    });
  },
});

export const publishRunReport = action({
  args: {
    secret: v.string(),
    reportId: v.string(),
    modelSlug: v.string(),
    artifactRepo: v.string(),
    recipeUpstreamId: v.optional(v.string()),
    recipeSourceSha: v.optional(v.string()),
    hardwareProfile: v.string(),
    runtime: v.string(),
    runtimeVersion: v.string(),
    testedContextTokens: v.optional(v.number()),
    concurrency: v.optional(v.number()),
    peakMemoryGb: v.optional(v.number()),
    throughputTokensPerSecond: v.optional(v.number()),
    verificationStatus: v.union(v.literal("measured"), v.literal("reproduced")),
    testedAt: v.number(),
    notes: v.string(),
    evidenceUrl: v.optional(v.string()),
    published: v.boolean(),
  },
  returns: v.object({ reportId: v.string(), changed: v.boolean() }),
  handler: async (ctx, args): Promise<{ reportId: string; changed: boolean }> => {
    assertAdminSecret(args.secret);
    return await ctx.runMutation(internal.intelligence.upsertRunReport, {
      reportId: args.reportId,
      modelSlug: args.modelSlug,
      artifactRepo: args.artifactRepo,
      recipeUpstreamId: args.recipeUpstreamId,
      recipeSourceSha: args.recipeSourceSha,
      hardwareProfile: args.hardwareProfile,
      runtime: args.runtime,
      runtimeVersion: args.runtimeVersion,
      testedContextTokens: args.testedContextTokens,
      concurrency: args.concurrency,
      peakMemoryGb: args.peakMemoryGb,
      throughputTokensPerSecond: args.throughputTokensPerSecond,
      verificationStatus: args.verificationStatus,
      testedAt: args.testedAt,
      notes: args.notes,
      evidenceUrl: args.evidenceUrl,
      published: args.published,
      now: Date.now(),
    });
  },
});
