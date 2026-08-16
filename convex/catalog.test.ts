/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { MODEL_ENTRIES } from "../src/lib/atlas/models";
import { publishableEntry } from "../src/lib/atlas/published";

const modules = import.meta.glob("./**/*.*s");

describe("published catalog snapshots", () => {
  it("keeps clients on a stable snapshot until the next rebuild", async () => {
    const t = convexTest(schema, modules);
    const entries = MODEL_ENTRIES.slice(0, 3);
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
});
