/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
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
    })).toMatchObject({ rebuilt: true, chunks: 1, changedChunks: 1 });
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
    })).toMatchObject({ rebuilt: true, chunks: 1, changedChunks: 0 });

    await t.run(async (ctx) => {
      const document = await ctx.db
        .query("catalogEntries")
        .withIndex("by_slug", (q) => q.eq("slug", entries[0].slug))
        .unique();
      await ctx.db.patch(document!._id, {
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
    })).toMatchObject({ rebuilt: true, chunks: 1, changedChunks: 1 });
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
