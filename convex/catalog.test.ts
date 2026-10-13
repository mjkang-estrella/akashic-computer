/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { patchCatalogEntry, deleteCatalogEntry, insertCatalogEntry, summaryBucket } from "./catalogSnapshot";
import { publishableEntry } from "../src/lib/atlas/published";
import { CATALOG_FIXTURES } from "../test/catalogFixture";

const modules = import.meta.glob("./**/*.*s");

describe("published catalog snapshots", () => {
  it("keeps clients on a stable snapshot until the next rebuild", async () => {
    const t = convexTest(schema, modules);
    const entries = CATALOG_FIXTURES;
    await t.run(async (ctx) => {
      await ctx.db.insert("catalogState", {
        key: "public",
        revision: "revision-1",
        syncedAt: 10,
        snapshotRefreshScheduledAt: 10,
      });
      for (const entry of entries) {
        await ctx.db.insert("catalogEntries", {
          slug: entry.slug,
          familyId: entry.family.id,
          releaseId: entry.release.id,
          sizeLabel: entry.size.label,
          sourceRepos: entry.artifacts.map((artifact) => artifact.repo),
          updatedAt: entry.timestamp,
          payload: publishableEntry(entry),
          publishedAt: 10,
          sourceRevision: "seed",
        });
      }
    });

    expect(await t.mutation(internal.catalog.rebuildPublishedSnapshot, {
      scheduledAt: 10,
    })).toMatchObject({ rebuilt: true, chunks: new Set(CATALOG_FIXTURES.map(e => summaryBucket(e.slug))).size, changedChunks: new Set(CATALOG_FIXTURES.map(e => summaryBucket(e.slug))).size });
    const initial = await t.query(api.catalog.listPublished, {});
    expect(initial.revision).toBe("revision-1");
    expect(initial.entries).toHaveLength(3);

    await t.run(async (ctx) => {
      const state = await ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", "public"))
        .unique();
      await ctx.db.patch(state!._id, { snapshotRefreshScheduledAt: 11 });
    });
    expect(await t.mutation(internal.catalog.rebuildPublishedSnapshot, {
      scheduledAt: 11,
    })).toMatchObject({ rebuilt: true, changedChunks: 0 });

    await t.run(async (ctx) => {
      const document = await ctx.db
        .query("catalogEntries")
        .withIndex("by_slug", (q) => q.eq("slug", entries[0].slug))
        .unique();
      await patchCatalogEntry(ctx, document!, {
        payload: { ...publishableEntry(entries[0]), name: "Changed behind snapshot" },
      });
    });
    expect((await t.query(api.catalog.listPublished, {})).entries[0].name).not.toBe(
      "Changed behind snapshot",
    );

    await t.run(async (ctx) => {
      const state = await ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", "public"))
        .unique();
      await ctx.db.patch(state!._id, {
        revision: "revision-2",
        syncedAt: 20,
        snapshotRefreshScheduledAt: 20,
      });
    });
    expect(await t.mutation(internal.catalog.rebuildPublishedSnapshot, {
      scheduledAt: 20,
    })).toMatchObject({ rebuilt: true, changedChunks: 1 });
    const refreshed = await t.query(api.catalog.listPublished, {});
    expect(refreshed.revision).toBe("revision-2");
    expect(refreshed.entries.some((entry: { name: string }) => entry.name === "Changed behind snapshot")).toBe(true);
  });

  it("ignores a superseded snapshot job", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("catalogState", {
        key: "public",
        revision: "current",
        syncedAt: 20,
        snapshotRefreshScheduledAt: 20,
      });
    });
    expect(await t.mutation(internal.catalog.rebuildPublishedSnapshot, {
      scheduledAt: 10,
    })).toEqual({ rebuilt: false, chunks: 0, changedChunks: 0 });
  });

  it("reports partial source failures as degraded without invalidating current sources", async () => {
    const t = convexTest(schema, modules);
    const now = 100 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      await ctx.db.insert("monitoredSources", {
        owner: "current-org",
        ownerKey: "current-org",
        displayName: "Current org",
        role: "creator",
        enabled: true,
        familyIds: [],
        lastAuditAt: now - 60_000,
        lastSuccessAt: now - 60_000,
        consecutiveFailures: 0,
      });
      await ctx.db.insert("monitoredSources", {
        owner: "limited-org",
        ownerKey: "limited-org",
        displayName: "Limited org",
        role: "creator",
        enabled: true,
        familyIds: [],
        lastAuditAt: now,
        lastSuccessAt: now - 30 * 60 * 60 * 1000,
        lastError: "429 Too Many Requests",
        consecutiveFailures: 2,
        nextRetryAt: now + 300_000,
      });
      await ctx.db.insert("syncRuns", {
        kind: "audit",
        status: "degraded",
        startedAt: now - 120_000,
        completedAt: now - 60_000,
        discovered: 20,
        changed: 1,
        published: 18,
        skipped: 1,
        failed: 1,
        retries: 2,
      });
    });

    expect(await t.query(api.catalog.healthSummary, { now })).toMatchObject({
      level: "degraded",
      sourceTotal: 2,
      freshSourceCount: 1,
      staleSourceCount: 1,
      failingSourceCount: 1,
      retryingSourceCount: 1,
      staleSources: ["Limited org"],
      lastCompletedAuditAt: now - 60_000,
    });
  });
});


describe("incremental catalog publication", () => {
  it("backfills in bounded pages, keeps the old snapshot, and handles concurrent updates and deletes", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const base = publishableEntry(CATALOG_FIXTURES[0]);
      const ids = await t.run(async ctx => {
        await ctx.db.insert("catalogState", { key: "public", revision: "v2", syncedAt: 1, snapshotRefreshScheduledAt: 1 });
        await ctx.db.insert("catalogSnapshotState", { key: "public", revision: "legacy", syncedAt: 0 });
        await ctx.db.insert("catalogSnapshotChunks", { snapshotKey: "public", chunk: 0, entries: [base] });
        const ids = [];
        for (let i = 0; i < 130; i++) ids.push(await ctx.db.insert("catalogEntries", {
          slug: `model-${i}`, familyId: base.family.id, releaseId: base.release.id, sizeLabel: base.size.label,
          sourceRepos: [], updatedAt: i, payload: { ...base, slug: `model-${i}`, timestamp: i }, publishedAt: 1, sourceRevision: "seed",
        }));
        return ids;
      });
      expect((await t.mutation(internal.catalog.rebuildPublishedSnapshot, { scheduledAt: 1 })).rebuilt).toBe(false);
      expect((await t.query(api.catalog.listPublished, {})).revision).toBe("legacy");
      await t.run(async ctx => {
        const entry = (await ctx.db.get(ids[0]))!;
        await patchCatalogEntry(ctx, entry, { payload: { ...entry.payload, name: "Changed during backfill", timestamp: 1000 } });
        await deleteCatalogEntry(ctx, (await ctx.db.get(ids[129]))!);
      });
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
      const published = await t.query(api.catalog.listPublished, {});
      expect(published.revision).toBe("v2");
      expect(published.entries).toHaveLength(129);
      expect(published.entries[0].name).toBe("Changed during backfill");
      expect(published.entries.some(e => e.slug === "model-129")).toBe(false);
      const chunks = await t.run(ctx => ctx.db.query("catalogSnapshotChunks").collect());
      expect(chunks.every(c => c.snapshotKey === "public-v2")).toBe(true);

      // Moving a model to the top of the display order changes only its bucket.
      await t.run(async ctx => {
        const entry = (await ctx.db.get(ids[1]))!;
        await patchCatalogEntry(ctx, entry, { payload: { ...entry.payload, timestamp: 2000 } });
        const state = (await ctx.db.query("catalogState").first())!;
        await ctx.db.patch(state._id, { snapshotRefreshScheduledAt: 2, revision: "v3" });
      });
      expect(await t.mutation(internal.catalog.rebuildPublishedSnapshot, { scheduledAt: 2 })).toMatchObject({ rebuilt: true, changedChunks: 1 });
      const after = await t.run(ctx => ctx.db.query("catalogSnapshotChunks").collect());
      expect(after.filter(c => c.chunk !== summaryBucket("model-1"))).toEqual(chunks.filter(c => c.chunk !== summaryBucket("model-1")));
      expect((await t.query(api.catalog.listPublished, {})).entries[0].slug).toBe("model-1");
    } finally { vi.useRealTimers(); }
  });

  it("skips detail-only summary writes and removes empty buckets", async () => {
    const t = convexTest(schema, modules);
    const base = publishableEntry(CATALOG_FIXTURES[0]);
    const id = await t.run(async ctx => {
      await ctx.db.insert("catalogState", { key: "public", revision: "v1", syncedAt: 1, snapshotRefreshScheduledAt: 1, summariesReady: true });
      return insertCatalogEntry(ctx, { slug: base.slug, familyId: base.family.id, releaseId: base.release.id, sizeLabel: base.size.label,
        sourceRepos: [], updatedAt: 1, payload: base, publishedAt: 1, sourceRevision: "seed" });
    });
    expect((await t.mutation(internal.catalog.rebuildPublishedSnapshot, { scheduledAt: 1 })).changedChunks).toBe(1);
    await t.run(async ctx => {
      const entry = (await ctx.db.get(id))!;
      await patchCatalogEntry(ctx, entry, { payload: { ...entry.payload, introduction: { heading: "Details only", summary: "Details", paragraphs: [], highlights: [], sourceLabel: "Source", sourceUrl: "https://example.com" } } });
      expect(await ctx.db.query("catalogDirtyBuckets").collect()).toHaveLength(0);
      await deleteCatalogEntry(ctx, (await ctx.db.get(id))!);
      const state = (await ctx.db.query("catalogState").first())!;
      await ctx.db.patch(state._id, { snapshotRefreshScheduledAt: 2 });
    });
    expect(await t.mutation(internal.catalog.rebuildPublishedSnapshot, { scheduledAt: 2 })).toMatchObject({ chunks: 0, changedChunks: 1 });
    expect((await t.query(api.catalog.listPublished, {})).entries).toHaveLength(0);
  });
});
