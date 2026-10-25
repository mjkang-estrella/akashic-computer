/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { insertCatalogEntry, patchCatalogEntry } from "./catalogSnapshot";
import { upsertMaterialChange } from "./intelligence";
import { publishableEntry } from "../src/lib/atlas/published";
import { CATALOG_FIXTURES } from "../test/catalogFixture";

const modules = import.meta.glob("./**/*.*s");
const base = publishableEntry(CATALOG_FIXTURES[0]);

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    await ctx.db.insert("catalogState", { key: "public", revision: "v1", syncedAt: 1, snapshotRefreshScheduledAt: 1, summariesReady: true });
    return insertCatalogEntry(ctx, {
      slug: base.slug, familyId: base.family.id, releaseId: base.release.id, sizeLabel: base.size.label,
      sourceRepos: [], updatedAt: 1, payload: base, publishedAt: 1, sourceRevision: "seed",
    });
  });
}

const queuedTags = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => (await ctx.db.query("siteRevalidations").collect()).map((row) => row.tag).sort());

describe("site revalidation", () => {
  beforeEach(() => {
    vi.stubEnv("CATALOG_REVALIDATE_URL", "https://site.test/api/revalidate");
    vi.stubEnv("CATALOG_REVALIDATE_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("queues a model tag only when the public payload changes", async () => {
    const t = convexTest(schema, modules);
    const id = await seed(t);
    const flushes = async () => (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()))
      .filter((job) => job.name.includes("siteRevalidation")).length;
    // Stand in for a completed flush of the insert's tag.
    await t.run(async (ctx) => { await ctx.db.delete((await ctx.db.query("siteRevalidations").first())!._id); });
    const before = await flushes();

    await t.run(async (ctx) => patchCatalogEntry(ctx, (await ctx.db.get(id))!, { payload: { ...base }, publishedAt: 2 }));
    expect(await queuedTags(t)).toEqual([]);
    expect(await flushes()).toBe(before);

    await t.run(async (ctx) => patchCatalogEntry(ctx, (await ctx.db.get(id))!, { payload: { ...base, name: "Renamed" } }));
    await t.run(async (ctx) => patchCatalogEntry(ctx, (await ctx.db.get(id))!, { payload: { ...base, name: "Renamed again" } }));
    expect(await queuedTags(t)).toEqual([`catalog:model:${base.slug}`]);
    // The second change finds the tag pending and relies on the flush already scheduled.
    expect(await flushes()).toBe(before + 1);
  });

  it("queues the list tag when summaries change and not for detail-only rebuilds", async () => {
    const t = convexTest(schema, modules);
    const id = await seed(t);
    expect((await t.mutation(internal.catalog.rebuildPublishedSnapshot, { scheduledAt: 1 })).changedChunks).toBe(1);
    expect(await queuedTags(t)).toContain("catalog:list");

    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("siteRevalidations").collect()) await ctx.db.delete(row._id);
      // Introductions appear on the model page only, not in list summaries.
      await patchCatalogEntry(ctx, (await ctx.db.get(id))!, { payload: { ...base, introduction: {
        heading: "Details only", summary: "Details", paragraphs: [], highlights: [], sourceLabel: "Source", sourceUrl: "https://example.com",
      } } });
      const state = (await ctx.db.query("catalogState").first())!;
      await ctx.db.patch(state._id, { snapshotRefreshScheduledAt: 2, revision: "v2", syncedAt: 2 });
    });
    expect((await t.mutation(internal.catalog.rebuildPublishedSnapshot, { scheduledAt: 2 })).changedChunks).toBe(0);
    expect(await queuedTags(t)).toEqual([`catalog:model:${base.slug}`]);
  });

  it("queues the changes tag for a new material change", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    await t.run(async (ctx) => {
      const change = {
        dedupeKey: "change-1", modelSlug: base.slug, modelName: base.name, type: "artifact_published" as const,
        occurredAt: 5, title: "Artifact added", summary: "Added.", sourceLabel: "Hugging Face", sourceUrls: [],
      };
      expect(await upsertMaterialChange(ctx, change, 5)).toBe(true);
    });
    expect(await queuedTags(t)).toEqual(["catalog:changes", `catalog:model:${base.slug}`]);
  });

  it("posts model tags promptly, list-wide tags hourly, and keeps tags after a failure", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    await t.mutation(internal.catalog.rebuildPublishedSnapshot, { scheduledAt: 1 });
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await t.action(internal.siteRevalidation.flush, { includeListWide: false });
    expect(await queuedTags(t)).toEqual(["catalog:list", `catalog:model:${base.slug}`]);

    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    await t.action(internal.siteRevalidation.flush, { includeListWide: false });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("https://site.test/api/revalidate");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-secret");
    expect(JSON.parse(String(init?.body))).toEqual({ tags: [`catalog:model:${base.slug}`] });
    expect(await queuedTags(t)).toEqual(["catalog:list"]);

    await t.action(internal.siteRevalidation.flush, { includeListWide: true });
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)![1]?.body))).toEqual({ tags: ["catalog:list"] });
    expect(await queuedTags(t)).toEqual([]);
  });

  it("queues nothing without the site settings", async () => {
    vi.unstubAllEnvs();
    const t = convexTest(schema, modules);
    await seed(t);
    await t.mutation(internal.catalog.rebuildPublishedSnapshot, { scheduledAt: 1 });
    expect(await queuedTags(t)).toEqual([]);
  });
});
