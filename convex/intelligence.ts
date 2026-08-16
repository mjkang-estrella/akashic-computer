import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { changeDateLabel } from "../src/lib/atlas/intelligence";
import type { MaterialChange, MaterialChangeType, RunReport } from "../src/lib/atlas/types";
import type { PublishedCatalogEntry } from "../src/lib/atlas/published";

type UnknownRecord = Record<string, unknown>;

function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, clean(entry)]),
    ) as T;
  }
  return value;
}

const changeType = v.union(
  v.literal("model_published"),
  v.literal("weights_updated"),
  v.literal("artifact_published"),
  v.literal("recipe_published"),
  v.literal("recipe_updated"),
  v.literal("runtime_support_added"),
  v.literal("license_or_access_changed"),
);

const materialChange = v.object({
  id: v.string(),
  modelSlug: v.string(),
  modelName: v.string(),
  type: changeType,
  occurredAt: v.number(),
  dateLabel: v.string(),
  title: v.string(),
  summary: v.string(),
  sourceLabel: v.string(),
  sourceUrls: v.array(v.string()),
  reviewStatus: v.union(v.literal("automatic"), v.literal("reviewed")),
});

export interface MaterialChangeInput {
  dedupeKey: string;
  modelSlug: string;
  modelName: string;
  type: MaterialChangeType;
  occurredAt: number;
  title: string;
  summary: string;
  sourceLabel: string;
  sourceUrls: string[];
  reviewStatus?: "automatic" | "reviewed";
}

function publicChange(change: MaterialChangeInput): MaterialChange {
  return {
    id: change.dedupeKey,
    modelSlug: change.modelSlug,
    modelName: change.modelName,
    type: change.type,
    occurredAt: change.occurredAt,
    dateLabel: changeDateLabel(change.occurredAt),
    title: change.title,
    summary: change.summary,
    sourceLabel: change.sourceLabel,
    sourceUrls: change.sourceUrls,
    reviewStatus: change.reviewStatus ?? "automatic",
  };
}

export async function upsertMaterialChange(
  ctx: MutationCtx,
  change: MaterialChangeInput,
  now: number,
): Promise<boolean> {
  const existing = await ctx.db
    .query("materialChanges")
    .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", change.dedupeKey))
    .unique();
  if (existing) return false;
  await ctx.db.insert("materialChanges", {
    ...change,
    reviewStatus: change.reviewStatus ?? "automatic",
    createdAt: now,
  });
  const entry = await ctx.db
    .query("catalogEntries")
    .withIndex("by_slug", (q) => q.eq("slug", change.modelSlug))
    .unique();
  if (entry) {
    const payload = entry.payload as PublishedCatalogEntry;
    const materialChanges = [
      publicChange(change),
      ...(payload.materialChanges ?? []).filter((item) => item.id !== change.dedupeKey),
    ]
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .slice(0, 12);
    await ctx.db.patch(entry._id, { payload: { ...payload, materialChanges } });
  }
  return true;
}

export const listRecentChanges = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(materialChange),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 8), 1), 24);
    const changes = await ctx.db
      .query("materialChanges")
      .withIndex("by_occurred_at")
      .order("desc")
      .take(limit);
    return changes.map((change) => ({
      id: change.dedupeKey,
      modelSlug: change.modelSlug,
      modelName: change.modelName,
      type: change.type,
      occurredAt: change.occurredAt,
      dateLabel: changeDateLabel(change.occurredAt),
      title: change.title,
      summary: change.summary,
      sourceLabel: change.sourceLabel,
      sourceUrls: change.sourceUrls,
      reviewStatus: change.reviewStatus,
    }));
  },
});

export const status = query({
  args: {},
  returns: v.object({
    recipeSync: v.union(v.null(), v.object({
      status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
      sourceRevision: v.optional(v.string()),
      lastSuccessAt: v.optional(v.number()),
      matchedEntries: v.number(),
      lastError: v.optional(v.string()),
    })),
  }),
  handler: async (ctx) => {
    const recipeSync = await ctx.db
      .query("recipeSyncState")
      .withIndex("by_key", (q) => q.eq("key", "vllm"))
      .unique();
    return {
      recipeSync: recipeSync ? {
        status: recipeSync.status,
        sourceRevision: recipeSync.sourceRevision,
        lastSuccessAt: recipeSync.lastSuccessAt,
        matchedEntries: recipeSync.matchedEntries,
        lastError: recipeSync.lastError,
      } : null,
    };
  },
});

export const upsertRunReport = internalMutation({
  args: {
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
    now: v.number(),
  },
  returns: v.object({ reportId: v.string(), changed: v.boolean() }),
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", args.modelSlug))
      .unique();
    if (!entry) throw new Error(`Unknown catalog model ${args.modelSlug}`);
    const payload = entry.payload as PublishedCatalogEntry;
    if (!payload.artifacts.some((artifact) => artifact.repo === args.artifactRepo)) {
      throw new Error(`Artifact ${args.artifactRepo} is not linked to ${args.modelSlug}`);
    }
    const recipe = args.recipeUpstreamId
      ? (payload.recipeReferences ?? []).find((item) => item.upstreamId === args.recipeUpstreamId)
      : undefined;
    if (args.recipeUpstreamId && !recipe) {
      throw new Error(`Recipe ${args.recipeUpstreamId} is not linked to ${args.modelSlug}`);
    }
    if (args.recipeSourceSha && recipe?.sourceSha !== args.recipeSourceSha) {
      throw new Error("Recipe revision does not match the linked upstream reference");
    }
    const existing = await ctx.db
      .query("runReports")
      .withIndex("by_report_id", (q) => q.eq("reportId", args.reportId))
      .unique();
    const { now, ...reportValue } = args;
    const storedValue = { ...reportValue, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, clean(storedValue));
    else await ctx.db.insert("runReports", clean(storedValue));

    const report: RunReport = {
      id: args.reportId,
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
    };
    const runReports = args.published
      ? [report, ...(payload.runReports ?? []).filter((item) => item.id !== args.reportId)]
          .sort((left, right) => right.testedAt - left.testedAt)
          .slice(0, 12)
      : (payload.runReports ?? []).filter((item) => item.id !== args.reportId);
    await ctx.db.patch(entry._id, { payload: clean({ ...payload, runReports }) });
    return { reportId: args.reportId, changed: true };
  },
});
