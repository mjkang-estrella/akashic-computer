/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { publishableEntry } from "../src/lib/atlas/published";
import { QWEN_ENTRY } from "../test/catalogFixture";

const modules = import.meta.glob("./**/*.*s");

async function catalogFixture() {
  const t = convexTest(schema, modules);
  const entry = QWEN_ENTRY;
  await t.run(async (ctx) => {
    await ctx.db.insert("catalogState", {
      key: "public",
      revision: "seed",
      syncedAt: 1,
    });
    await ctx.db.insert("catalogEntries", {
      slug: entry.slug,
      familyId: entry.family.id,
      releaseId: entry.release.id,
      sizeLabel: entry.size.label,
      sourceRepos: entry.artifacts.map((artifact) => artifact.repo),
      updatedAt: entry.timestamp,
      payload: publishableEntry(entry),
      publishedAt: 1,
      sourceRevision: "seed",
    });
  });
  return { t, entry };
}

describe("catalog intelligence", () => {
  it("projects exact recipe matches and leaves a repeated projection unchanged", async () => {
    const { t, entry } = await catalogFixture();
    const repo = entry.artifacts[0].repo;
    const recipe = {
      provider: "vllm" as const,
      upstreamId: repo,
      title: `${entry.name} recipe`,
      publisher: entry.family.vendor,
      description: "Versioned upstream deployment reference.",
      recipeUrl: `https://recipes.vllm.ai/${repo}`,
      sourceUrl: "https://github.com/vllm-project/recipes/tree/abc123",
      sourceSha: "abc123",
      contentHash: "semantic-hash",
      tasks: ["text-generation"],
      features: ["tool_calling"],
      verifiedHardware: [{ id: "dgx_spark_gb10", label: "DGX Spark (GB10)" }],
      variants: [{ key: "default", modelId: repo, precision: "BF16" }],
      artifactRepos: [repo],
    };

    expect(await t.mutation(internal.recipeSync.upsertRecipeBatch, {
      recipes: [recipe],
      now: 10,
    })).toEqual({ inserted: 1, updated: 0 });
    await t.mutation(internal.recipeSync.beginSync, {
      sourceRevision: "abc123",
      now: 10,
    });
    const first = await t.mutation(internal.recipeSync.finalizeSync, {
      sourceRevision: "abc123",
      recipeIds: [repo],
      inserted: 1,
      updated: 0,
      initialSync: true,
      now: 10,
    });
    expect(first).toMatchObject({ matchedEntries: 1, changedEntries: 1 });
    expect((await t.query(api.catalog.getBySlug, { slug: entry.slug }))!.recipeReferences)
      .toHaveLength(1);

    const second = await t.mutation(internal.recipeSync.finalizeSync, {
      sourceRevision: "abc123",
      recipeIds: [repo],
      inserted: 0,
      updated: 0,
      initialSync: false,
      now: 20,
    });
    expect(second.changedEntries).toBe(0);
  });

  it("publishes and retracts provenance-bound run reports", async () => {
    const { t, entry } = await catalogFixture();
    const artifactRepo = entry.artifacts[0].repo;
    const args = {
      reportId: "report-1",
      modelSlug: entry.slug,
      artifactRepo,
      hardwareProfile: "DGX Spark (GB10)",
      runtime: "vLLM",
      runtimeVersion: "0.17.0",
      testedContextTokens: 8_192,
      concurrency: 1,
      peakMemoryGb: 80,
      throughputTokensPerSecond: 42,
      verificationStatus: "measured" as const,
      testedAt: 100,
      notes: "Matched single-request generation workload.",
      published: true,
      now: 101,
    };
    await t.mutation(internal.intelligence.upsertRunReport, args);
    expect((await t.query(api.catalog.getBySlug, { slug: entry.slug }))!.runReports)
      .toHaveLength(1);

    await t.mutation(internal.intelligence.upsertRunReport, {
      ...args,
      published: false,
      now: 102,
    });
    expect((await t.query(api.catalog.getBySlug, { slug: entry.slug }))!.runReports)
      .toHaveLength(0);
  });

  it("returns material changes newest first with a bounded public limit", async () => {
    const { t, entry } = await catalogFixture();
    await t.run(async (ctx) => {
      for (const occurredAt of [10, 30, 20]) {
        await ctx.db.insert("materialChanges", {
          dedupeKey: `${entry.slug}:${occurredAt}`,
          modelSlug: entry.slug,
          modelName: entry.name,
          type: "weights_updated",
          occurredAt,
          title: "Weights changed",
          summary: "A recognized weight manifest changed.",
          sourceLabel: "Hugging Face",
          sourceUrls: [`https://huggingface.co/${entry.artifacts[0].repo}`],
          reviewStatus: "automatic",
          createdAt: occurredAt,
        });
      }
    });
    const changes = await t.query(api.intelligence.listRecentChanges, { limit: 2 });
    expect(changes.map((change) => change.occurredAt)).toEqual([30, 20]);
  });

  it("publishes a protected model-card introduction without changing model recency", async () => {
    const { t, entry } = await catalogFixture();
    const result = await t.mutation(internal.admin.upsertModelIntroduction, {
      slug: entry.slug,
      heading: `About ${entry.name}`,
      summary: "Architecture and deployment context from the official model card.",
      paragraphs: ["This is a source-attributed, paraphrased introduction."],
      highlights: [{ label: "Architecture", value: "Mixture of experts" }],
      sourceLabel: "Official Hugging Face model card",
      sourceUrl: `https://huggingface.co/${entry.artifacts[0].repo}/blob/abc123/README.md`,
      sourceSha: "abc123",
      now: 200,
    });
    expect(result).toEqual({ slug: entry.slug, changed: true });

    const payload = await t.query(api.catalog.getBySlug, { slug: entry.slug });
    expect(payload!.introduction).toMatchObject({
      heading: `About ${entry.name}`,
      sourceSha: "abc123",
    });
    const storedEntry = await t.run(async (ctx) => await ctx.db
      .query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", entry.slug))
      .unique());
    expect(storedEntry?.updatedAt).toBe(entry.timestamp);
    const introduction = await t.run(async (ctx) => await ctx.db
      .query("modelIntroductions")
      .withIndex("by_slug", (q) => q.eq("slug", entry.slug))
      .unique());
    expect(introduction).toMatchObject({ sourceSha: "abc123" });
  });
});
