import {
  catalogSummary,
  type PublishedCatalogEntry,
} from "../src/lib/atlas/published";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

const SNAPSHOT_SCHEDULE_TTL_MS = 10 * 60 * 1000;

export function convexValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => convexValuesEqual(value, right[index]))
    );
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        convexValuesEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

export async function scheduleCatalogSnapshotRefresh(
  ctx: MutationCtx,
  stateId: Id<"catalogState">,
  scheduledAt: number | undefined,
  now: number,
  delayMs: number,
): Promise<boolean> {
  if (
    scheduledAt !== undefined &&
    now - scheduledAt < SNAPSHOT_SCHEDULE_TTL_MS
  ) {
    return false;
  }
  await ctx.db.patch(stateId, { snapshotRefreshScheduledAt: now });
  await ctx.scheduler.runAfter(
    delayMs,
    internal.catalog.rebuildPublishedSnapshot,
    {
      scheduledAt: now,
    },
  );
  return true;
}

// Bucket by identity, not display order, so a changed timestamp cannot shift
// unrelated models into different snapshot chunks.
export const MAX_CATALOG_ENTRIES = 2_000;
export const SUMMARY_BUCKETS = 128;
export const SUMMARY_SNAPSHOT_KEY = "public-v2";
export function summaryBucket(slug: string): number {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i++)
    hash = Math.imul(hash ^ slug.charCodeAt(i), 16777619);
  return (hash >>> 0) % SUMMARY_BUCKETS;
}

async function markSummaryBucket(ctx: MutationCtx, bucket: number) {
  const dirty = await ctx.db
    .query("catalogDirtyBuckets")
    .withIndex("by_bucket", (q) => q.eq("bucket", bucket))
    .unique();
  if (!dirty) await ctx.db.insert("catalogDirtyBuckets", { bucket });
}

async function changeSummaryCount(ctx: MutationCtx, delta: 1 | -1) {
  const state = await ctx.db
    .query("catalogSummaryCounts")
    .withIndex("by_key", (q) => q.eq("key", "public"))
    .unique();
  const count = (state?.count ?? 0) + delta;
  if (count > MAX_CATALOG_ENTRIES)
    throw new Error(
      `Published catalog exceeds the ${MAX_CATALOG_ENTRIES}-entry snapshot bound`,
    );
  if (count < 0) throw new Error("Catalog summary count is inconsistent");
  if (state) await ctx.db.patch(state._id, { count });
  else await ctx.db.insert("catalogSummaryCounts", { key: "public", count });
}

export async function updateCatalogSummary(
  ctx: MutationCtx,
  slug: string,
  payload: Doc<"catalogEntries">["payload"] | null,
) {
  const existing = await ctx.db
    .query("catalogSummaries")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  const bucket = summaryBucket(slug);
  if (payload === null) {
    if (existing) {
      await ctx.db.delete(existing._id);
      await changeSummaryCount(ctx, -1);
    }
    await markSummaryBucket(ctx, bucket);
    return;
  }
  const summary = catalogSummary(payload as PublishedCatalogEntry);
  if (existing && convexValuesEqual(existing.payload, summary)) return;
  if (existing) await ctx.db.patch(existing._id, { payload: summary });
  else {
    await changeSummaryCount(ctx, 1);
    await ctx.db.insert("catalogSummaries", { slug, bucket, payload: summary });
  }
  await markSummaryBucket(ctx, bucket);
}

export async function insertCatalogEntry(
  ctx: MutationCtx,
  value: Omit<Doc<"catalogEntries">, "_id" | "_creationTime">,
) {
  const id = await ctx.db.insert("catalogEntries", value);
  await updateCatalogSummary(ctx, value.slug, value.payload);
  return id;
}

export async function patchCatalogEntry(
  ctx: MutationCtx,
  entry: Doc<"catalogEntries">,
  patch: Partial<Omit<Doc<"catalogEntries">, "_id" | "_creationTime">>,
) {
  if (patch.slug !== undefined && patch.slug !== entry.slug)
    throw new Error("Catalog slug changes require delete and insert");
  await ctx.db.patch(entry._id, patch);
  if (patch.payload) await updateCatalogSummary(ctx, entry.slug, patch.payload);
}

export async function deleteCatalogEntry(
  ctx: MutationCtx,
  entry: Doc<"catalogEntries">,
) {
  await ctx.db.delete(entry._id);
  await updateCatalogSummary(ctx, entry.slug, null);
}
