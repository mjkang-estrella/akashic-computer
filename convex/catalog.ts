import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { convexValuesEqual } from "./catalogSnapshot";

const STATE_KEY = "public";
const SNAPSHOT_CHUNK_SIZE = 24;
const MAX_CATALOG_ENTRIES = 2_000;
const MAX_SNAPSHOT_CHUNKS = Math.ceil(MAX_CATALOG_ENTRIES / SNAPSHOT_CHUNK_SIZE) + 1;

function assertCatalogBound<T>(documents: T[]): T[] {
  if (documents.length > MAX_CATALOG_ENTRIES) {
    throw new Error(`Published catalog exceeds the ${MAX_CATALOG_ENTRIES}-entry snapshot bound`);
  }
  return documents;
}

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const [chunks, snapshotState] = await Promise.all([
      ctx.db
        .query("catalogSnapshotChunks")
        .withIndex("by_snapshot_and_chunk", (q) => q.eq("snapshotKey", STATE_KEY))
        .order("asc")
        .take(MAX_SNAPSHOT_CHUNKS),
      ctx.db
        .query("catalogSnapshotState")
        .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
        .unique(),
    ]);
    if (snapshotState) {
      return {
        entries: chunks.flatMap((chunk) => chunk.entries),
        syncedAt: snapshotState.syncedAt,
        revision: snapshotState.revision,
        catalogStale: false,
      };
    }

    // Migration fallback. Once the first snapshot is built, clients no longer
    // subscribe to every individual catalog entry.
    const [documents, state] = await Promise.all([
      ctx.db.query("catalogEntries").take(MAX_CATALOG_ENTRIES + 1),
      ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
        .unique(),
    ]);
    return {
      entries: assertCatalogBound(documents)
        .sort((a, b) => b.updatedAt - a.updatedAt || a.slug.localeCompare(b.slug))
        .map((document) => document.payload),
      syncedAt: state?.syncedAt ?? null,
      revision: state?.revision ?? "unseeded",
      catalogStale: state?.syncedAt === undefined,
    };
  },
});

export const rebuildPublishedSnapshot = internalMutation({
  args: { scheduledAt: v.number() },
  handler: async (ctx, args) => {
    const catalogState = await ctx.db
      .query("catalogState")
      .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
      .unique();
    if (!catalogState || catalogState.snapshotRefreshScheduledAt !== args.scheduledAt) {
      return { rebuilt: false, chunks: 0, changedChunks: 0 };
    }

    const documents = assertCatalogBound(
      await ctx.db.query("catalogEntries").take(MAX_CATALOG_ENTRIES + 1),
    );
    const entries = documents
      .sort((a, b) => b.updatedAt - a.updatedAt || a.slug.localeCompare(b.slug))
      .map((document) => document.payload);
    const nextChunks = Array.from(
      { length: Math.ceil(entries.length / SNAPSHOT_CHUNK_SIZE) },
      (_, index) => entries.slice(index * SNAPSHOT_CHUNK_SIZE, (index + 1) * SNAPSHOT_CHUNK_SIZE),
    );
    const existingChunks = await ctx.db
      .query("catalogSnapshotChunks")
      .withIndex("by_snapshot_and_chunk", (q) => q.eq("snapshotKey", STATE_KEY))
      .take(MAX_SNAPSHOT_CHUNKS);
    const existingByChunk = new Map(existingChunks.map((chunk) => [chunk.chunk, chunk]));
    let changedChunks = 0;

    for (let index = 0; index < nextChunks.length; index += 1) {
      const nextEntries = nextChunks[index];
      const existing = existingByChunk.get(index);
      if (!existing) {
        await ctx.db.insert("catalogSnapshotChunks", {
          snapshotKey: STATE_KEY,
          chunk: index,
          entries: nextEntries,
        });
        changedChunks += 1;
      } else if (!convexValuesEqual(existing.entries, nextEntries)) {
        await ctx.db.patch(existing._id, { entries: nextEntries });
        changedChunks += 1;
      }
    }
    for (const existing of existingChunks) {
      if (existing.chunk >= nextChunks.length) {
        await ctx.db.delete(existing._id);
        changedChunks += 1;
      }
    }

    const snapshotState = await ctx.db
      .query("catalogSnapshotState")
      .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
      .unique();
    const stateValue = {
      key: STATE_KEY,
      revision: catalogState.revision,
      syncedAt: catalogState.syncedAt,
    };
    if (snapshotState) await ctx.db.patch(snapshotState._id, stateValue);
    else await ctx.db.insert("catalogSnapshotState", stateValue);
    await ctx.db.patch(catalogState._id, { snapshotRefreshScheduledAt: undefined });
    return { rebuilt: true, chunks: nextChunks.length, changedChunks };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return document?.payload ?? null;
  },
});

export const status = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [state, latestAudit, pendingWebhooks, failedWebhooks, activeAlerts] = await Promise.all([
      ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
        .unique(),
      ctx.db
        .query("syncRuns")
        .withIndex("by_kind_started", (q) => q.eq("kind", "audit"))
        .order("desc")
        .first(),
      ctx.db
        .query("webhookEvents")
        .withIndex("by_received")
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect(),
      ctx.db
        .query("webhookEvents")
        .withIndex("by_received")
        .filter((q) => q.eq(q.field("status"), "failed"))
        .take(100),
      ctx.db
        .query("catalogHealthAlerts")
        .filter((q) => q.eq(q.field("active"), true))
        .collect(),
    ]);
    const oldestPending = pendingWebhooks.reduce<number | null>(
      (oldest, event) => (oldest === null || event.receivedAt < oldest ? event.receivedAt : oldest),
      null,
    );
    return {
      revision: state?.revision ?? "unseeded",
      syncedAt: state?.syncedAt ?? null,
      lastWebhookAt: state?.lastWebhookAt ?? null,
      lastSuccessfulAuditAt: state?.lastSuccessfulAuditAt ?? null,
      latestAudit: latestAudit
        ? {
            status: latestAudit.status,
            startedAt: latestAudit.startedAt,
            completedAt: latestAudit.completedAt ?? null,
            message: latestAudit.message ?? null,
            expectedSources: latestAudit.expectedSources ?? null,
            completedSources: latestAudit.completedSources ?? null,
            discovered: latestAudit.discovered,
            changed: latestAudit.changed,
            published: latestAudit.published,
            skipped: latestAudit.skipped,
            failed: latestAudit.failed,
            retries: latestAudit.retries,
          }
        : null,
      pendingWebhookCount: pendingWebhooks.length,
      failedWebhookCount: failedWebhooks.length,
      activeAlerts: activeAlerts.map((alert) => ({
        kind: alert.kind,
        message: alert.message,
        firstDetectedAt: alert.firstDetectedAt,
      })),
      webhookStale: oldestPending !== null && now - oldestPending > 10 * 60 * 1000,
      catalogStale:
        !state?.lastSuccessfulAuditAt || now - state.lastSuccessfulAuditAt > 26 * 60 * 60 * 1000,
    };
  },
});
