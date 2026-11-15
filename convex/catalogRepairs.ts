import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { deleteCatalogEntry, patchCatalogEntry, scheduleCatalogSnapshotRefresh } from "./catalogSnapshot";
import { queueSiteRevalidation } from "./siteRevalidation";
import { CATALOG_CHANGES_TAG, CATALOG_LIST_TAG } from "../src/lib/atlas/cacheTags";

// Keep the original URL stable. These two published weight formats share one architecture.
export const mergeInklingSmall = internalMutation({
  args: {},
  returns: v.object({ changed: v.boolean(), slug: v.string() }),
  handler: async (ctx) => {
    const slug = "inkling-inkling-2-small-383b";
    const duplicateSlug = "inkling-inkling-2-small-612b";
    const find = (slug: string) => ctx.db.query("catalogEntries").withIndex("by_slug", q => q.eq("slug", slug)).unique();
    const entry = await find(slug);
    const duplicate = await find(duplicateSlug);
    if (!entry) throw new Error("Original Inkling 2 Small entry is missing");
    if (!duplicate && entry.payload.size.paramsB === 594) return { changed: false, slug };
    const originals = [entry, ...(duplicate ? [duplicate] : [])];
    const allowedRepos = new Set(["thinkingmachines/Inkling-2-Small", "thinkingmachines/Inkling-2-Small-MXFP8"]);
    if (originals.some(e => e.familyId !== "inkling" || e.payload.artifacts.some(a => !allowedRepos.has(a.repo)))) {
      throw new Error("Unexpected Inkling artifacts; repair requires inspection");
    }
    const artifacts = [...new Map(originals.flatMap(e => e.payload.artifacts).map(a => [a.repo, {
      ...a, format: a.repo.endsWith("-MXFP8") ? "MXFP8" : "NVFP4",
    }])).values()];
    const name = "Inkling 2 Small 594B";
    const unique = <T,>(items: T[], key: (item: T) => string) => [...new Map(items.map(i => [key(i), i])).values()];
    const payload = {
      ...entry.payload, name,
      size: { ...entry.payload.size, label: "594B", paramsB: 594, activeParamsB: 17, isMoe: true },
      artifacts, quantizations: artifacts.map(a => a.format),
      benchmarkRefs: unique(originals.flatMap(e => e.payload.benchmarkRefs), r => `${r.name}:${r.sourceUrl}`),
      deploymentRecipes: unique(originals.flatMap(e => (e.payload.deploymentRecipes ?? [])), r => `${r.provider}:${r.upstreamId}`),
      materialChanges: unique(originals.flatMap(e => (e.payload.materialChanges ?? [])), r => r.id).map(r => ({ ...r, modelSlug: slug, modelName: name })),
      runReports: unique(originals.flatMap(e => (e.payload.runReports ?? [])), r => r.id).map(r => ({ ...r, modelSlug: slug })),
    };
    const size = await ctx.db.query("modelSizes").withIndex("by_slug", q => q.eq("slug", slug)).unique();
    if (size) {
      await ctx.db.patch(size._id, { label: "594B", parameterCountB: 594, activeParameterCountB: 17 });
      const oldSize = await ctx.db.query("modelSizes").withIndex("by_slug", q => q.eq("slug", duplicateSlug)).unique();
      if (oldSize) {
        const variants = await ctx.db.query("modelVariants").withIndex("by_size", q => q.eq("sizeId", oldSize._id)).take(21);
        if (variants.length > 20) throw new Error("Too many variants to repair");
        for (const variant of variants) {
          const existing = await ctx.db.query("modelVariants").withIndex("by_size_slug", q => q.eq("sizeId", size._id).eq("slug", variant.slug)).unique();
          if (!existing) {
            await ctx.db.patch(variant._id, { sizeId: size._id });
            continue;
          }
          const artifacts = await ctx.db.query("artifacts").withIndex("by_variant", q => q.eq("variantId", variant._id)).take(201);
          if (artifacts.length > 200) throw new Error("Too many artifacts to repair");
          for (const artifact of artifacts) await ctx.db.patch(artifact._id, { variantId: existing._id });
          await ctx.db.delete(variant._id);
        }
      }
    }
    for (const oldSlug of [slug, duplicateSlug]) {
      const changes = await ctx.db.query("materialChanges").withIndex("by_model_and_occurred_at", q => q.eq("modelSlug", oldSlug)).take(201);
      const reports = await ctx.db.query("runReports").withIndex("by_model_and_published", q => q.eq("modelSlug", oldSlug)).take(201);
      const builds = await ctx.db.query("artifactBuilds").withIndex("by_model", q => q.eq("modelSlug", oldSlug)).take(201);
      if ([changes, reports, builds].some(rows => rows.length > 200)) throw new Error("Too many related records to repair");
      for (const row of changes) await ctx.db.patch(row._id, { modelSlug: slug, modelName: name });
      for (const row of [...reports, ...builds]) await ctx.db.patch(row._id, { modelSlug: slug });
    }
    await patchCatalogEntry(ctx, entry, { sizeLabel: "594B", sourceRepos: artifacts.map(a => a.repo), payload });
    if (duplicate) await deleteCatalogEntry(ctx, duplicate);
    const state = await ctx.db.query("catalogState").withIndex("by_key", q => q.eq("key", "public")).unique();
    if (state) {
      const now = Date.now();
      await ctx.db.patch(state._id, { revision: `inkling-repair:${now}` });
      await scheduleCatalogSnapshotRefresh(ctx, state._id, state.snapshotRefreshScheduledAt, now, 0);
    }
    await queueSiteRevalidation(ctx, [CATALOG_LIST_TAG, CATALOG_CHANGES_TAG]);
    return { changed: true, slug };
  },
});
