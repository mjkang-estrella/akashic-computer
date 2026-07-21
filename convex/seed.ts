import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { FAMILIES } from "../src/lib/atlas/catalog";
import { MODEL_ENTRIES } from "../src/lib/atlas/models";
import { publishableEntry } from "../src/lib/atlas/published";
import { activeParamsLabel } from "../src/lib/atlas/naming";
import { CURRENT_MONITORED_SOURCES } from "./sourceConfig";
import { normalizeOwnerKey } from "../src/lib/atlas/huggingface";
import type { Trust } from "../src/lib/atlas/types";

type AnyRecord = Record<string, unknown>;

function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as AnyRecord)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, clean(entry)]),
    ) as T;
  }
  return value;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function contextTokens(value: string | undefined): number | undefined {
  const match = value?.toUpperCase().match(/([\d.]+)\s*([KM])/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return match[2] === "M" ? amount * 1_000_000 : amount * 1_000;
}

function dateTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function variantKind(value: string) {
  const variant = value.toLowerCase();
  if (variant.includes("base")) return "base" as const;
  if (variant.includes("instruct") || variant.includes("chat")) return "instruct" as const;
  if (variant.includes("reason")) return "reasoning" as const;
  if (variant.includes("code")) return "coder" as const;
  if (variant.includes("vision") || variant.includes("multimodal")) return "vision" as const;
  if (variant.includes("embedding")) return "embedding" as const;
  if (variant.includes("rerank")) return "reranker" as const;
  return "other" as const;
}

function uploaderKind(trust: Trust) {
  return trust === "official" ? "official" as const : trust === "vendor" ? "vendor" as const : "community" as const;
}

export const seedFamily = internalMutation({
  args: { familyId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const family = FAMILIES.find((candidate) => candidate.id === args.familyId);
    if (!family) throw new Error(`Unknown seed family: ${args.familyId}`);
    const familyEntries = MODEL_ENTRIES.filter((entry) => entry.family.id === family.id);
    const sourceOwners = [...new Set(familyEntries.flatMap((entry) => entry.artifacts.map((artifact) => artifact.repo.split("/")[0])))];
    const primaryOwner = sourceOwners.find((owner) => owner.toLowerCase() !== "nvidia" && owner.toLowerCase() !== "unsloth") ?? sourceOwners[0];

    const familyDocument = await ctx.db
      .query("modelFamilies")
      .withIndex("by_slug", (q) => q.eq("slug", family.id))
      .unique();
    const familyValue = {
      slug: family.id,
      name: family.name,
      vendor: family.vendor,
      summary: family.tags,
      modalities: [],
      tags: family.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      category: family.category,
      capabilities: family.capabilities,
      sourceOwner: primaryOwner,
      lastSyncedAt: args.now,
    };
    const familyId = familyDocument
      ? (await ctx.db.patch(familyDocument._id, clean(familyValue)), familyDocument._id)
      : await ctx.db.insert("modelFamilies", clean(familyValue));

    for (const release of family.releases) {
      const releaseDocument = await ctx.db
        .query("modelReleases")
        .withIndex("by_family", (q) => q.eq("familyId", familyId))
        .filter((q) => q.eq(q.field("slug"), release.id))
        .unique();
      const releaseValue = {
        familyId,
        slug: release.id,
        name: release.name,
        releasedAt: dateTimestamp(release.date),
        lastUpdatedAt: Math.max(
          dateTimestamp(release.date) ?? 0,
          ...release.sizes.map((size) => dateTimestamp(size.updated) ?? 0),
        ),
        contextTokens: contextTokens(release.ctx),
        contextLabel: release.ctx,
        license: release.license,
        category: release.category,
        capabilities: release.capabilities,
        lastSyncedAt: args.now,
      };
      const releaseId = releaseDocument
        ? (await ctx.db.patch(releaseDocument._id, clean(releaseValue)), releaseDocument._id)
        : await ctx.db.insert("modelReleases", clean(releaseValue));

      for (const size of release.sizes) {
        const sizeSlug = `${family.id}-${release.id}-${slugPart(size.label)}`;
        const sizeDocument = await ctx.db
          .query("modelSizes")
          .withIndex("by_release", (q) => q.eq("releaseId", releaseId))
          .filter((q) => q.eq(q.field("slug"), sizeSlug))
          .unique();
        const active = activeParamsLabel(size.label);
        const sizeValue = {
          releaseId,
          slug: sizeSlug,
          label: size.label,
          parameterCountB: size.paramsB,
          activeParameterCountB: active ? Number(active.replace("B active", "")) : undefined,
          contextTokens: contextTokens(size.context ?? release.ctx),
          contextLabel: size.context ?? release.ctx,
          lastUpdatedAt: dateTimestamp(size.updated ?? release.date),
          category: size.category,
          capabilities: size.capabilities,
          lastSyncedAt: args.now,
        };
        const sizeId = sizeDocument
          ? (await ctx.db.patch(sizeDocument._id, clean(sizeValue)), sizeDocument._id)
          : await ctx.db.insert("modelSizes", clean(sizeValue));

        const entry = familyEntries.find(
          (candidate) => candidate.release.id === release.id && candidate.size.label === size.label,
        );
        if (!entry) continue;
        for (const variant of size.variants) {
          const variantDocument = await ctx.db
            .query("modelVariants")
            .withIndex("by_size", (q) => q.eq("sizeId", sizeId))
            .filter((q) => q.eq(q.field("slug"), slugPart(variant)))
            .unique();
          const variantValue = {
            sizeId,
            slug: slugPart(variant),
            name: variant,
            category: size.category ?? release.category ?? family.category,
            capabilities: size.capabilities ?? release.capabilities ?? family.capabilities,
            variantKind: variantKind(variant),
            lastSyncedAt: args.now,
          };
          const variantId = variantDocument
            ? (await ctx.db.patch(variantDocument._id, clean(variantValue)), variantDocument._id)
            : await ctx.db.insert("modelVariants", clean(variantValue));

          const artifacts = entry.artifacts.filter((artifact) => artifact.variant === variant);
          for (const artifact of artifacts) {
            const existingArtifact = await ctx.db
              .query("artifacts")
              .withIndex("by_repo", (q) => q.eq("huggingFaceRepo", artifact.repo))
              .filter((q) => q.eq(q.field("variantId"), variantId))
              .unique();
            const artifactValue = {
              variantId,
              huggingFaceRepo: artifact.repo,
              aliases: [],
              format: artifact.format,
              quantization: artifact.format,
              uploaderKind: uploaderKind(artifact.trust),
              runtimeSupport: artifact.runtimes,
              hardwareKinds: artifact.kinds,
              minVramGb: artifact.minVramGb,
              recommendedVramGb: artifact.recVramGb,
              vramEstimated: false,
              gated: false,
              available: true,
              provenanceUrl: `https://huggingface.co/${artifact.repo}`,
              confidence: artifact.confidence,
              lastUpdatedAt: entry.timestamp,
              sourceRepo: artifact.repo,
              lastSyncedAt: args.now,
            };
            if (existingArtifact) await ctx.db.patch(existingArtifact._id, clean(artifactValue));
            else await ctx.db.insert("artifacts", clean(artifactValue));
          }

          for (const benchmark of entry.benchmarkRefs) {
            const existingBenchmark = await ctx.db
              .query("modelBenchmarks")
              .withIndex("by_variant", (q) => q.eq("variantId", variantId))
              .filter((q) => q.eq(q.field("benchmarkName"), benchmark.name))
              .first();
            const benchmarkValue = {
              variantId,
              benchmarkName: benchmark.name,
              result: benchmark.result,
              sourceLabel: benchmark.sourceLabel,
              sourceUrl: benchmark.sourceUrl,
              measuredAt: dateTimestamp(benchmark.measuredAt),
              lastSyncedAt: args.now,
            };
            if (existingBenchmark) await ctx.db.patch(existingBenchmark._id, clean(benchmarkValue));
            else await ctx.db.insert("modelBenchmarks", clean(benchmarkValue));
          }
        }

        const payload = publishableEntry(entry);
        const existingEntry = await ctx.db
          .query("catalogEntries")
          .withIndex("by_slug", (q) => q.eq("slug", entry.slug))
          .unique();
        const sourceRepos = entry.artifacts.map((artifact) => artifact.repo);
        const catalogValue = {
          slug: entry.slug,
          familyId: family.id,
          releaseId: release.id,
          sizeLabel: size.label,
          sourceRepos,
          updatedAt: entry.timestamp,
          payload,
          publishedAt: args.now,
          sourceRevision: `seed:${entry.effectiveDate}`,
        };
        if (existingEntry) await ctx.db.patch(existingEntry._id, clean(catalogValue));
        else await ctx.db.insert("catalogEntries", clean(catalogValue));

        for (const artifact of entry.artifacts) {
          const existingSource = await ctx.db
            .query("sourceRepositories")
            .withIndex("by_repo_name", (q) => q.eq("repoName", artifact.repo))
            .unique();
          if (!existingSource) {
            await ctx.db.insert("sourceRepositories", {
              repoId: artifact.repo,
              repoName: artifact.repo,
              owner: artifact.repo.split("/")[0],
              aliases: [],
              private: false,
              gated: false,
              disabled: false,
              tags: [],
              files: [],
              baseModels: [],
              status: "published",
              missingCount: 0,
              lastSeenAt: args.now,
              lastIngestedAt: args.now,
            });
          }
        }
      }
    }
    return { familyId: family.id, entries: familyEntries.length };
  },
});

export const seedSources = internalMutation({
  args: {},
  handler: async (ctx) => {
    const configuredOwnerKeys = new Set(
      CURRENT_MONITORED_SOURCES.map((source) => normalizeOwnerKey(source.owner)),
    );
    let inserted = 0;
    let updated = 0;
    let disabled = 0;
    for (const source of CURRENT_MONITORED_SOURCES) {
      const ownerKey = normalizeOwnerKey(source.owner);
      const existingByKey = await ctx.db
        .query("monitoredSources")
        .withIndex("by_owner_key", (q) => q.eq("ownerKey", ownerKey))
        .first();
      const existing = existingByKey ?? await ctx.db
        .query("monitoredSources")
        .withIndex("by_owner", (q) => q.eq("owner", source.owner))
        .first();
      const value = {
        owner: source.owner,
        ownerKey,
        displayName: source.displayName,
        role: source.role,
        enabled: true,
        familyIds: source.familyIds,
        includePatterns: source.includePatterns,
        excludePatterns: source.excludePatterns,
      };
      if (existing) {
        await ctx.db.patch(existing._id, value);
        updated += 1;
      } else {
        await ctx.db.insert("monitoredSources", value);
        inserted += 1;
      }
    }
    const existingSources = await ctx.db.query("monitoredSources").collect();
    for (const source of existingSources) {
      const ownerKey = source.ownerKey ?? normalizeOwnerKey(source.owner);
      if (configuredOwnerKeys.has(ownerKey) || !source.enabled) continue;
      await ctx.db.patch(source._id, { enabled: false });
      disabled += 1;
    }
    return { inserted, updated, disabled, configured: CURRENT_MONITORED_SOURCES.length };
  },
});

export const finalizeSeed = internalMutation({
  args: { now: v.number(), revision: v.string(), runId: v.id("syncRuns") },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("catalogState")
      .withIndex("by_key", (q) => q.eq("key", "public"))
      .unique();
    const value = { key: "public", revision: args.revision, syncedAt: args.now };
    if (state) await ctx.db.patch(state._id, value);
    else await ctx.db.insert("catalogState", value);
    await ctx.db.patch(args.runId, {
      status: "success",
      completedAt: args.now,
      published: MODEL_ENTRIES.length,
      changed: MODEL_ENTRIES.length,
      message: `Seeded ${MODEL_ENTRIES.length} model-size entries`,
    });
  },
});

export const beginSeed = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, args) =>
    await ctx.db.insert("syncRuns", {
      kind: "seed",
      status: "running",
      startedAt: args.now,
      discovered: MODEL_ENTRIES.length,
      changed: 0,
      published: 0,
      skipped: 0,
      failed: 0,
      retries: 0,
    }),
});

/** One-time operator command. Guarded and intentionally excluded from the frontend. */
export const seedCurrentCatalog = action({
  args: { secret: v.string() },
  handler: async (ctx, args): Promise<{ entries: number; revision: string }> => {
    const expected = process.env.CATALOG_ADMIN_SECRET;
    if (!expected || args.secret !== expected) throw new Error("Invalid catalog admin secret");
    const now = Date.now();
    const runId = await ctx.runMutation(internal.seed.beginSeed, { now });
    await ctx.runMutation(internal.seed.seedSources, {});
    for (const family of FAMILIES) {
      await ctx.runMutation(internal.seed.seedFamily, { familyId: family.id, now });
    }
    const revision = `seed-${now}`;
    await ctx.runMutation(internal.seed.finalizeSeed, { now, revision, runId });
    return { entries: MODEL_ENTRIES.length, revision };
  },
});
