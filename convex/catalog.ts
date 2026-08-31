import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { convexValuesEqual } from "./catalogSnapshot";
import {
  publishedCatalogEntryValue,
  publishedCatalogListValue,
} from "./catalogValues";
import {
  catalogSummary,
  type PublishedCatalogEntry,
} from "../src/lib/atlas/published";
import {
  SOURCE_FRESHNESS_MS,
  summarizeSourceHealth,
  WEBHOOK_FRESHNESS_MS,
} from "../src/lib/atlas/catalogHealth";

const STATE_KEY = "public";
const SNAPSHOT_CHUNK_SIZE = 24;
const MAX_CATALOG_ENTRIES = 2_000;
const MAX_SNAPSHOT_CHUNKS = Math.ceil(MAX_CATALOG_ENTRIES / SNAPSHOT_CHUNK_SIZE) + 1;
const healthLevel = v.union(v.literal("healthy"), v.literal("degraded"), v.literal("stale"));

const healthSummaryValue = v.object({
  level: healthLevel,
  sourceTotal: v.number(),
  freshSourceCount: v.number(),
  staleSourceCount: v.number(),
  failingSourceCount: v.number(),
  retryingSourceCount: v.number(),
  staleSources: v.array(v.string()),
  failingSources: v.array(v.string()),
  nextRetryAt: v.union(v.number(), v.null()),
  pendingWebhookCount: v.number(),
  failedWebhookCount: v.number(),
  webhookStale: v.boolean(),
  lastCompletedAuditAt: v.union(v.number(), v.null()),
});

const sourceHealthValue = v.object({
  level: healthLevel,
  total: v.number(),
  fresh: v.number(),
  stale: v.number(),
  failing: v.number(),
  retrying: v.number(),
  staleSources: v.array(v.string()),
  failingSources: v.array(v.string()),
  nextRetryAt: v.union(v.number(), v.null()),
});

const statusValue = v.object({
  revision: v.string(),
  syncedAt: v.union(v.number(), v.null()),
  lastWebhookAt: v.union(v.number(), v.null()),
  lastSuccessfulAuditAt: v.union(v.number(), v.null()),
  lastCompletedAuditAt: v.union(v.number(), v.null()),
  latestAudit: v.union(v.null(), v.object({
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("degraded"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
    message: v.union(v.string(), v.null()),
    expectedSources: v.union(v.number(), v.null()),
    completedSources: v.union(v.number(), v.null()),
    discovered: v.number(),
    changed: v.number(),
    published: v.number(),
    skipped: v.number(),
    failed: v.number(),
    retries: v.number(),
  })),
  pendingWebhookCount: v.number(),
  failedWebhookCount: v.number(),
  activeAlerts: v.array(v.object({
    kind: v.union(
      v.literal("webhook_stale"),
      v.literal("catalog_degraded"),
      v.literal("catalog_stale"),
    ),
    message: v.string(),
    firstDetectedAt: v.number(),
  })),
  sourceHealth: sourceHealthValue,
  webhookStale: v.boolean(),
  catalogDegraded: v.boolean(),
  catalogStale: v.boolean(),
});

function assertCatalogBound<T>(documents: T[]): T[] {
  if (documents.length > MAX_CATALOG_ENTRIES) {
    throw new Error(`Published catalog exceeds the ${MAX_CATALOG_ENTRIES}-entry snapshot bound`);
  }
  return documents;
}

export const listPublished = query({
  args: {},
  returns: publishedCatalogListValue,
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
    if (!snapshotState) throw new Error("Published catalog snapshot is not initialized");
    return {
      entries: assertCatalogBound(chunks.flatMap((chunk) => chunk.entries)),
      syncedAt: snapshotState.syncedAt,
      revision: snapshotState.revision,
    };
  },
});

export const rebuildPublishedSnapshot = internalMutation({
  args: { scheduledAt: v.number() },
  returns: v.object({ rebuilt: v.boolean(), chunks: v.number(), changedChunks: v.number() }),
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
      .map((document) => catalogSummary(document.payload as PublishedCatalogEntry));
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
  returns: v.union(publishedCatalogEntryValue, v.null()),
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return document?.payload ?? null;
  },
});

export const healthSummary = query({
  args: { now: v.number() },
  returns: healthSummaryValue,
  handler: async (ctx, args) => {
    const [sources, pendingWebhooks, failedWebhooks, latestAudit] = await Promise.all([
      ctx.db
        .query("monitoredSources")
        .withIndex("by_enabled", (q) => q.eq("enabled", true))
        .take(100),
      ctx.db
        .query("webhookEvents")
        .withIndex("by_status_and_received", (q) => q.eq("status", "pending"))
        .order("asc")
        .take(100),
      ctx.db
        .query("webhookEvents")
        .withIndex("by_status_and_received", (q) =>
          q.eq("status", "failed").gte("receivedAt", args.now - SOURCE_FRESHNESS_MS))
        .order("desc")
        .take(100),
      ctx.db
        .query("syncRuns")
        .withIndex("by_kind_started", (q) => q.eq("kind", "audit"))
        .order("desc")
        .first(),
    ]);
    const sourceHealth = summarizeSourceHealth(sources, args.now);
    const oldestPendingAt = pendingWebhooks[0]?.receivedAt ?? null;
    return {
      level: sourceHealth.level,
      sourceTotal: sourceHealth.total,
      freshSourceCount: sourceHealth.fresh,
      staleSourceCount: sourceHealth.stale,
      failingSourceCount: sourceHealth.failing,
      retryingSourceCount: sourceHealth.retrying,
      staleSources: sourceHealth.staleSources,
      failingSources: sourceHealth.failingSources,
      nextRetryAt: sourceHealth.nextRetryAt,
      pendingWebhookCount: pendingWebhooks.length,
      failedWebhookCount: failedWebhooks.length,
      webhookStale: oldestPendingAt !== null && args.now - oldestPendingAt > WEBHOOK_FRESHNESS_MS,
      lastCompletedAuditAt: latestAudit?.completedAt ?? null,
    };
  },
});

export const status = query({
  args: { now: v.number() },
  returns: statusValue,
  handler: async (ctx, args) => {
    const [state, latestAudit, pendingWebhooks, failedWebhooks, activeAlerts, sources] = await Promise.all([
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
        .withIndex("by_status_and_received", (q) => q.eq("status", "pending"))
        .order("asc")
        .take(100),
      ctx.db
        .query("webhookEvents")
        .withIndex("by_status_and_received", (q) =>
          q.eq("status", "failed").gte("receivedAt", args.now - SOURCE_FRESHNESS_MS))
        .order("desc")
        .take(100),
      ctx.db
        .query("catalogHealthAlerts")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(10),
      ctx.db
        .query("monitoredSources")
        .withIndex("by_enabled", (q) => q.eq("enabled", true))
        .take(100),
    ]);
    const sourceHealth = summarizeSourceHealth(sources, args.now);
    const oldestPending = pendingWebhooks.reduce<number | null>(
      (oldest, event) => (oldest === null || event.receivedAt < oldest ? event.receivedAt : oldest),
      null,
    );
    return {
      revision: state?.revision ?? "unseeded",
      syncedAt: state?.syncedAt ?? null,
      lastWebhookAt: state?.lastWebhookAt ?? null,
      lastSuccessfulAuditAt: state?.lastSuccessfulAuditAt ?? null,
      lastCompletedAuditAt: state?.lastCompletedAuditAt ?? latestAudit?.completedAt ?? null,
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
      sourceHealth,
      webhookStale: oldestPending !== null && args.now - oldestPending > WEBHOOK_FRESHNESS_MS,
      catalogDegraded: sourceHealth.level === "degraded",
      catalogStale: sourceHealth.level === "stale",
    };
  },
});
