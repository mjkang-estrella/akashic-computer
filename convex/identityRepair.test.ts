/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modelEntry, artifact } from "../test/catalogFixture";
import { publishableEntry } from "../src/lib/atlas/published";
import { classifyHuggingFaceRepo, compactClassification } from "../src/lib/atlas/huggingface";
const modules = import.meta.glob("./**/*.*s");

it("repairs a stale normalized regular-to-Flash link and remains idempotent on reingestion", async () => {
  const t = convexTest(schema, modules);
  const flash = publishableEntry(modelEntry({ slug: "glm-glm-5-3-flash-321b", familyId: "glm", familyName: "GLM",
    releaseName: "GLM 5.3 Flash", releaseId: "glm-5-3-flash", sizeLabel: "321B", paramsB: 321,
    repo: "zai-org/GLM-5.3-Flash", artifacts: [artifact("zai-org/GLM-5.3-Flash"), artifact("zai-org/GLM-5.3")] }));
  await t.run(async (ctx) => {
    await ctx.db.insert("monitoredSources", { owner: "zai-org", ownerKey: "zai-org", displayName: "Z.ai", role: "creator", enabled: true, familyIds: ["glm"] });
    const familyId = await ctx.db.insert("modelFamilies", { slug: "glm", name: "GLM", vendor: "Z.ai", summary: "", modalities: [], tags: [] });
    const releaseId = await ctx.db.insert("modelReleases", { familyId, slug: flash.release.id, name: flash.release.name });
    const sizeId = await ctx.db.insert("modelSizes", { releaseId, slug: flash.slug, label: "321B", parameterCountB: 321 });
    const variantId = await ctx.db.insert("modelVariants", { sizeId, slug: "instruct", name: "Instruct", variantKind: "instruct" });
    await ctx.db.insert("artifacts", { variantId, huggingFaceRepo: "zai-org/GLM-5.3", format: "FP8", uploaderKind: "official", runtimeSupport: [], available: true, confidence: "verified" });
    await ctx.db.insert("catalogEntries", { slug: flash.slug, familyId: "glm", releaseId: flash.release.id, sizeLabel: "321B", sourceRepos: flash.artifacts.map((a) => a.repo), updatedAt: 1, payload: flash, publishedAt: 1, sourceRevision: "old" });
  });
  const classification = compactClassification(classifyHuggingFaceRepo({ id: "zai-org/GLM-5.3", author: "zai-org", sha: "new",
    pipeline_tag: "text-generation", siblings: [{ rfilename: "model.safetensors" }], safetensors: { parameters: { BF16: 753e9 } },
    cardData: { license: "mit" } }, { owner: "zai-org", role: "creator", familyIds: ["glm"] }));
  for (const now of [2, 3]) {
    const runId = await t.mutation(internal.sync.startWebhookRun, { owner: "zai-org", now });
    const result = await t.mutation(internal.sync.applyRepoResult, { classification, sourceOwner: "zai-org", runId, now });
    expect(result).toMatchObject({ status: "published", slug: "glm-glm-5-3-753b" });
    const remaining = await t.query(api.catalog.getBySlug, { slug: flash.slug });
    expect(remaining!.artifacts.map((a) => a.repo)).toEqual(["zai-org/GLM-5.3-Flash"]);
    const regular = await t.query(api.catalog.getBySlug, { slug: "glm-glm-5-3-753b" });
    expect(regular!.artifacts.map((a) => a.repo)).toEqual(["zai-org/GLM-5.3"]);
  }
  const normalized = await t.run(async (ctx) => ctx.db.query("artifacts").withIndex("by_repo", (q) => q.eq("huggingFaceRepo", "zai-org/GLM-5.3")).take(20));
  expect(normalized.filter((a) => a.available)).toHaveLength(1);
  expect(normalized.filter((a) => !a.available)[0].confidence).toBe("needs_review");
});

it("merges both Inkling formats, preserves related data and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const slugs = ["inkling-inkling-2-small-383b", "inkling-inkling-2-small-612b"];
  await t.run(async ctx => {
    const familyId = await ctx.db.insert("modelFamilies", { slug: "inkling", name: "Inkling", vendor: "Thinking Machines Lab", summary: "", modalities: [], tags: [] });
    const releaseId = await ctx.db.insert("modelReleases", { familyId, slug: "inkling-2-small", name: "Inkling 2 Small" });
    for (const [index, slug] of slugs.entries()) {
      const repo = `thinkingmachines/Inkling-2-Small${index ? "-MXFP8" : ""}`;
      const payload = publishableEntry(modelEntry({ slug, familyId: "inkling", familyName: "Inkling", releaseName: "Inkling 2 Small",
        releaseId: "inkling-2-small", sizeLabel: index ? "612B" : "383B", paramsB: index ? 612 : 383, repo }));
      await ctx.db.insert("catalogEntries", { slug, familyId: "inkling", releaseId: payload.release.id, sizeLabel: payload.size.label,
        sourceRepos: [repo], updatedAt: 1, payload, publishedAt: 1, sourceRevision: "old" });
      const sizeId = await ctx.db.insert("modelSizes", { releaseId, slug, label: payload.size.label, parameterCountB: payload.size.paramsB });
      const variantId = await ctx.db.insert("modelVariants", { sizeId, slug: "instruct", name: "Instruct", variantKind: "instruct" });
      await ctx.db.insert("artifacts", { variantId, huggingFaceRepo: repo, format: "MXFP8", uploaderKind: "official", runtimeSupport: [], available: true, confidence: "verified" });
      await ctx.db.insert("artifactBuilds", { key: repo, repo, revision: "old", modelSlug: slug, observedAt: 1,
        label: repo, container: "safetensors", files: [], bytes: 100, complete: true, quantization: "NVFP4", mtp: "unknown", baseModels: [], sourceUrl: `https://huggingface.co/${repo}` });
    }
  });
  expect(await t.mutation(internal.catalogRepairs.mergeInklingSmall, {})).toMatchObject({ changed: true });
  const merged = await t.query(api.catalog.getBySlug, { slug: slugs[0] });
  expect(merged).toMatchObject({ name: "Inkling 2 Small 594B", size: { paramsB: 594, activeParamsB: 17 }, quantizations: ["NVFP4", "MXFP8"] });
  expect(merged!.artifacts).toHaveLength(2);
  expect(await t.run(async ctx => (await ctx.db.query("artifactBuilds").take(10)).map(b => b.modelSlug))).toEqual([slugs[0], slugs[0]]);
  expect(await t.query(api.catalog.getBySlug, { slug: slugs[1] })).toBeNull();
  await t.run(async ctx => {
    const size = await ctx.db.query("modelSizes").withIndex("by_slug", q => q.eq("slug", slugs[0])).unique();
    const variants = await ctx.db.query("modelVariants").withIndex("by_size", q => q.eq("sizeId", size!._id)).take(10);
    expect(variants).toHaveLength(1);
    const artifacts = await ctx.db.query("artifacts").withIndex("by_variant", q => q.eq("variantId", variants[0]._id)).take(10);
    expect(artifacts).toHaveLength(2);
  });
  expect(await t.mutation(internal.catalogRepairs.mergeInklingSmall, {})).toMatchObject({ changed: false });
});
