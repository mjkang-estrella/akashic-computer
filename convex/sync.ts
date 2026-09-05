import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  compactClassification,
  matchesSourceRules,
  normalizeHuggingFaceRepo,
  normalizeOwnerKey,
  type IngestionClassification,
} from "../src/lib/atlas/huggingface";
import type { PublishedCatalogEntry } from "../src/lib/atlas/published";
import { uploaderDisplay } from "../src/lib/atlas/naming";
import { convexValuesEqual, scheduleCatalogSnapshotRefresh } from "./catalogSnapshot";
import { upsertMaterialChange } from "./intelligence";
import {
  classifyWithWeightMetadata,
  fetchRepo,
  listRepos,
  retryDelayForError,
} from "./huggingFaceClient";
import { ingestionClassificationValue } from "./catalogValues";
import {
  clean,
  familyForParsed,
  mergeParsedIntoPayload,
  newPayload,
  significantTimestamp,
  slugPart,
  sourceRule,
  targetForParsed,
  timestamp,
  trustForRole,
  type IngestedParsedRepo,
} from "./catalogReconciliation";

const sourceRuleResultValue = v.union(v.null(), v.object({
  owner: v.string(),
  role: v.union(v.literal("creator"), v.literal("artifact_provider"), v.literal("creator_provider")),
  enabled: v.boolean(),
  familyIds: v.array(v.string()),
  includePatterns: v.optional(v.array(v.string())),
  excludePatterns: v.optional(v.array(v.string())),
}));

const eventResultValue = v.union(v.null(), v.object({
  status: v.union(v.literal("pending"), v.literal("superseded"), v.literal("processed"), v.literal("ignored"), v.literal("failed")),
  owner: v.string(),
  repoId: v.string(),
  repoName: v.string(),
  scope: v.string(),
  action: v.string(),
}));

const runResultValue = v.union(v.null(), v.object({
  status: v.union(v.literal("running"), v.literal("success"), v.literal("degraded"), v.literal("failed")),
  expectedSources: v.optional(v.number()),
  completedSources: v.optional(v.number()),
  sourceOwners: v.optional(v.array(v.string())),
  sourcePaceMs: v.optional(v.number()),
  discovered: v.number(),
  changed: v.number(),
  published: v.number(),
  skipped: v.number(),
  failed: v.number(),
  retries: v.number(),
}));

const sourceRepoResultValue = v.union(v.null(), v.object({
  repoId: v.string(),
  repoName: v.string(),
  headSha: v.optional(v.string()),
  weightManifestHash: v.optional(v.string()),
  weightsLastModifiedAt: v.optional(v.number()),
}));

export const sourceByOwner = internalQuery({
  args: { owner: v.string() },
  returns: sourceRuleResultValue,
  handler: async (ctx, args) => {
    const byKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.owner)))
      .first();
    const source = byKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
    return source ? {
      owner: source.owner,
      role: source.role,
      enabled: source.enabled,
      familyIds: source.familyIds,
      includePatterns: source.includePatterns,
      excludePatterns: source.excludePatterns,
    } : null;
  },
});

export const eventById = internalQuery({
  args: { eventId: v.id("webhookEvents") },
  returns: eventResultValue,
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    return event ? {
      status: event.status,
      owner: event.owner,
      repoId: event.repoId,
      repoName: event.repoName,
      scope: event.scope,
      action: event.action,
    } : null;
  },
});

export const syncRunById = internalQuery({
  args: { runId: v.id("syncRuns") },
  returns: runResultValue,
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    return run ? {
      status: run.status,
      expectedSources: run.expectedSources,
      completedSources: run.completedSources,
      sourceOwners: run.sourceOwners,
      sourcePaceMs: run.sourcePaceMs,
      discovered: run.discovered,
      changed: run.changed,
      published: run.published,
      skipped: run.skipped,
      failed: run.failed,
      retries: run.retries,
    } : null;
  },
});

export const sourceRepoByName = internalQuery({
  args: { repoName: v.string() },
  returns: sourceRepoResultValue,
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", args.repoName))
      .unique();
    return repo ? {
      repoId: repo.repoId,
      repoName: repo.repoName,
      headSha: repo.headSha,
      weightManifestHash: repo.weightManifestHash,
      weightsLastModifiedAt: repo.weightsLastModifiedAt,
    } : null;
  },
});

export const sourceRepoById = internalQuery({
  args: { repoId: v.string() },
  returns: sourceRepoResultValue,
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_id", (q) => q.eq("repoId", args.repoId))
      .first();
    return repo ? {
      repoId: repo.repoId,
      repoName: repo.repoName,
      headSha: repo.headSha,
      weightManifestHash: repo.weightManifestHash,
      weightsLastModifiedAt: repo.weightsLastModifiedAt,
    } : null;
  },
});

export const startWebhookRun = internalMutation({
  args: { owner: v.string(), now: v.number() },
  returns: v.id("syncRuns"),
  handler: async (ctx, args) =>
    await ctx.db.insert("syncRuns", {
      kind: "webhook",
      sourceOwner: args.owner,
      status: "running",
      startedAt: args.now,
      discovered: 1,
      changed: 0,
      published: 0,
      skipped: 0,
      failed: 0,
      retries: 0,
    }),
});

async function applyModelIntroduction(ctx: MutationCtx, slug: string, payload: PublishedCatalogEntry) {
  const introduction = await ctx.db
    .query("modelIntroductions")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!introduction) return payload;
  return {
    ...payload,
    introduction: {
      heading: introduction.heading,
      summary: introduction.summary,
      paragraphs: introduction.paragraphs,
      highlights: introduction.highlights,
      sourceLabel: introduction.sourceLabel,
      sourceUrl: introduction.sourceUrl,
      sourceSha: introduction.sourceSha,
    },
  };
}

async function catalogEntryForRepo(ctx: MutationCtx, repoName: string) {
  const artifacts = await ctx.db
    .query("artifacts")
    .withIndex("by_repo", (q) => q.eq("huggingFaceRepo", repoName))
    .take(21);
  if (artifacts.length > 20) throw new Error("Repository exceeds the variant lookup bound");
  for (const artifact of artifacts) {
    if (!artifact.available) continue;
    const variant = await ctx.db.get(artifact.variantId);
    if (!variant) continue;
    const size = await ctx.db.get(variant.sizeId);
    if (!size) continue;
    const entry = await ctx.db.query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", size.slug)).unique();
    if (entry?.sourceRepos.includes(repoName)) return entry;
  }
  return null;
}

async function directlyLinkedCatalogEntry(
  ctx: MutationCtx,
  parsed: IngestedParsedRepo,
  previousRepoName?: string,
  rule?: ReturnType<typeof sourceRule>,
) {
  const entries: NonNullable<Awaited<ReturnType<typeof catalogEntryForRepo>>>[] = [];
  const repoNames = [parsed.repo.id, previousRepoName, ...parsed.repo.baseModels]
    .filter((repoName): repoName is string => Boolean(repoName));
  for (const repoName of new Set(repoNames)) {
    const entry = await catalogEntryForRepo(ctx, repoName);
    if (entry && !entries.some((item) => item._id === entry._id)) entries.push(entry);
  }
  return rule ? targetForParsed(entries, parsed, rule) : null;
}

async function upsertNormalized(
  ctx: MutationCtx,
  payload: PublishedCatalogEntry,
  parsed: IngestedParsedRepo,
  role: string,
  now: number,
  previousRepoName?: string,
) {
  let family = await ctx.db
    .query("modelFamilies")
    .withIndex("by_slug", (q) => q.eq("slug", payload.family.id))
    .unique();
  if (!family) {
    const familyId = await ctx.db.insert("modelFamilies", clean({
      slug: payload.family.id,
      name: payload.family.name,
      vendor: payload.family.vendor,
      summary: payload.family.tags,
      modalities: [],
      tags: payload.family.tags.split(",").map((tag) => tag.trim()),
      category: payload.family.category,
      capabilities: payload.family.capabilities,
      sourceOwner: parsed.repo.author,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
    family = await ctx.db.get(familyId);
  }
  if (!family) throw new Error("Failed to materialize family");
  let release = await ctx.db
    .query("modelReleases")
    .withIndex("by_family_slug", (q) => q.eq("familyId", family!._id).eq("slug", payload.release.id))
    .unique();
  if (!release) {
    const releaseId = await ctx.db.insert("modelReleases", clean({
      familyId: family._id,
      slug: payload.release.id,
      name: payload.release.name,
      releasedAt: timestamp(payload.release.date),
      lastUpdatedAt: payload.timestamp,
      contextTokens: parsed.contextTokens ?? undefined,
      contextLabel: payload.release.ctx,
      license: payload.release.license,
      category: payload.release.category,
      capabilities: payload.release.capabilities,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
    release = await ctx.db.get(releaseId);
  } else {
    await ctx.db.patch(release._id, clean({ lastUpdatedAt: payload.timestamp, sourceSha: parsed.repo.sha, lastSyncedAt: now }));
  }
  if (!release) throw new Error("Failed to materialize release");
  let size = await ctx.db
    .query("modelSizes")
    .withIndex("by_slug", (q) => q.eq("slug", payload.slug))
    .unique();
  if (!size) {
    const sizeId = await ctx.db.insert("modelSizes", clean({
      releaseId: release._id,
      slug: payload.slug,
      label: payload.size.label,
      parameterCountB: payload.size.paramsB,
      activeParameterCountB: parsed.activeParamsB ?? undefined,
      contextTokens: parsed.contextTokens ?? undefined,
      contextLabel: payload.context,
      lastUpdatedAt: payload.timestamp,
      category: payload.size.category,
      capabilities: payload.size.capabilities,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
    size = await ctx.db.get(sizeId);
  } else {
    await ctx.db.patch(size._id, clean({
      label: payload.size.label,
      parameterCountB: payload.size.paramsB,
      activeParameterCountB: payload.size.activeParamsB,
      lastUpdatedAt: payload.timestamp,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
  }
  if (!size) throw new Error("Failed to materialize size");
  const variantName = payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.variant ?? parsed.variant;
  let variant = await ctx.db
    .query("modelVariants")
    .withIndex("by_size_slug", (q) => q.eq("sizeId", size!._id).eq("slug", slugPart(variantName)))
    .unique();
  if (!variant) {
    const kindText = variantName.toLowerCase();
    const variantKind = kindText.includes("base") ? "base" as const
      : kindText.includes("reason") ? "reasoning" as const
        : kindText.includes("code") ? "coder" as const
          : kindText.includes("embedding") ? "embedding" as const
            : kindText.includes("rerank") ? "reranker" as const
              : "instruct" as const;
    const variantId = await ctx.db.insert("modelVariants", clean({
      sizeId: size._id,
      slug: slugPart(variantName),
      name: variantName,
      category: payload.category,
      capabilities: payload.capabilities,
      variantKind,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
    variant = await ctx.db.get(variantId);
  }
  if (!variant) throw new Error("Failed to materialize variant");
  const existingArtifact = await ctx.db
    .query("artifacts")
    .withIndex("by_repo_variant", (q) => q.eq("huggingFaceRepo", parsed.repo.id).eq("variantId", variant!._id))
    .unique() ?? (previousRepoName && previousRepoName !== parsed.repo.id
      ? await ctx.db
          .query("artifacts")
          .withIndex("by_repo_variant", (q) => q.eq("huggingFaceRepo", previousRepoName).eq("variantId", variant!._id))
          .unique()
      : null);
  const artifactValue = clean({
    variantId: variant._id,
    huggingFaceRepo: parsed.repo.id,
    format: parsed.format,
    quantization: parsed.format,
    uploaderKind: trustForRole(role, parsed.repo.baseModels.length > 0),
    runtimeSupport: payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.runtimes ?? parsed.runtimes,
    hardwareKinds: payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.kinds ?? parsed.kinds,
    minVramGb: payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.minVramGb,
    recommendedVramGb: payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.recVramGb,
    vramEstimated: true,
    gated: parsed.repo.gated,
    available: true,
    provenanceUrl: `https://huggingface.co/${parsed.repo.id}/tree/${parsed.repo.sha}`,
    confidence: "verified" as const,
    lastUpdatedAt: significantTimestamp(parsed.repo),
    sourceRepo: parsed.repo.id,
    sourceSha: parsed.repo.sha,
    lastSyncedAt: now,
  });
  if (existingArtifact) await ctx.db.patch(existingArtifact._id, artifactValue);
  else await ctx.db.insert("artifacts", artifactValue);

}

export const applyRepoResult = internalMutation({
  args: {
    classification: ingestionClassificationValue,
    sourceOwner: v.string(),
    repoKey: v.optional(v.string()),
    runId: v.id("syncRuns"),
    eventId: v.optional(v.id("webhookEvents")),
    now: v.number(),
  },
  returns: v.union(
    v.object({ status: v.literal("skipped"), reason: v.string() }),
    v.object({
      status: v.literal("published"),
      slug: v.string(),
      resolution: v.union(v.literal("direct"), v.literal("family_scan"), v.literal("new")),
      changed: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const sourceByKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.sourceOwner)))
      .first();
    const source = sourceByKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.sourceOwner))
      .first();
    if (!source) throw new Error(`Unmonitored source ${args.sourceOwner}`);
    const classification = args.classification as IngestionClassification;
    const repo = classification.status === "publishable" ? classification.parsed.repo : classification.repo;
    const priorById = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_id", (q) => q.eq("repoId", args.repoKey ?? repo.id))
      .first();
    const priorByName = priorById ?? (await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", repo.id))
      .first());
    const sourceValue = clean({
      repoId: args.repoKey ?? priorByName?.repoId ?? repo.id,
      repoName: repo.id,
      owner: repo.author,
      headSha: repo.sha,
      createdAt: timestamp(repo.createdAt),
      lastModifiedAt: timestamp(repo.lastModified),
      weightManifestHash: repo.weightManifestHash ?? undefined,
      weightsLastModifiedAt: timestamp(repo.weightsLastModified),
      weightCommitSha: repo.weightCommitSha ?? undefined,
      weightBytes: repo.weightBytes ?? undefined,
      private: repo.private,
      gated: repo.gated,
      disabled: repo.disabled,
      pipelineTag: repo.pipelineTag ?? undefined,
      license: repo.license ?? undefined,
      status: classification.status === "publishable" ? "published" as const : "skipped" as const,
      skipReason: classification.status === "skipped" ? classification.reason : undefined,
      missingCount: 0,
      lastSeenAt: args.now,
      lastIngestedAt: args.now,
    });
    const sourceRepoId = priorByName
      ? (await ctx.db.patch(priorByName._id, sourceValue), priorByName._id)
      : await ctx.db.insert("sourceRepositories", sourceValue);
    if (classification.status === "publishable" && priorByName?.skipReason) {
      await ctx.db.patch(sourceRepoId, { skipReason: undefined });
    }

    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Sync run was deleted");
    if (classification.status === "skipped") {
      if (run.kind !== "audit") {
        await ctx.db.patch(args.runId, {
          skipped: run.skipped + 1,
          changed: run.changed + 1,
        });
      }
      if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now, nextRetryAt: undefined });
      return { status: "skipped" as const, reason: classification.reason };
    }

    const parsed = classification.parsed;
    const rule = sourceRule(source);
    const previousRepoName = priorByName?.repoName !== parsed.repo.id ? priorByName?.repoName : undefined;
    const directTarget = await directlyLinkedCatalogEntry(ctx, parsed, previousRepoName, rule);
    const familyDocuments = directTarget
      ? []
      : await Promise.all(
          rule.familyIds.map((familyId) =>
            ctx.db
              .query("catalogEntries")
              .withIndex("by_family", (q) => q.eq("familyId", familyId))
              .take(501),
          ),
        );
    if (familyDocuments.some((entries) => entries.length > 500)) {
      throw new Error("Catalog family exceeds the 500-entry reconciliation bound");
    }
    const documents = directTarget ? [directTarget] : familyDocuments.flat();
    const target = directTarget ?? targetForParsed(documents, parsed, rule);
    const resolution = directTarget ? "direct" as const : target ? "family_scan" as const : "new" as const;
    let payload: PublishedCatalogEntry | null = target
      ? mergeParsedIntoPayload(target.payload as PublishedCatalogEntry, parsed, source.role, previousRepoName)
      : null;
    if (!payload && source.role !== "artifact_provider" && !(source.role === "creator_provider" && parsed.repo.baseModels.length > 0)) {
      const family = familyForParsed(documents, parsed, rule);
      if (family) payload = newPayload(family, parsed);
    }
    if (!target && payload && documents.some((document) => document.slug === payload?.slug)) payload = null;
    if (!payload) {
      await ctx.db.patch(sourceRepoId, {
        status: "skipped",
        skipReason: "structured metadata could not resolve a catalog family or base model",
      });
      if (run.kind !== "audit") {
        await ctx.db.patch(args.runId, { skipped: run.skipped + 1, changed: run.changed + 1 });
      }
      if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now, nextRetryAt: undefined });
      return { status: "skipped" as const, reason: "unresolved catalog identity" };
    }

    // Repair an old incorrect association atomically with the new association.
    const previousEntry = await catalogEntryForRepo(ctx, previousRepoName ?? parsed.repo.id);
    if (previousEntry && previousEntry.slug !== payload.slug) {
      const previous = previousEntry.payload as PublishedCatalogEntry;
      const remaining = previous.artifacts.filter((artifact) =>
        artifact.repo !== parsed.repo.id && artifact.repo !== previousRepoName,
      );
      if (remaining.length === 0) throw new Error("Cannot automatically move the last artifact of a model");
      const repos = new Set(remaining.map((artifact) => artifact.repo.toLowerCase()));
      const retainedRecipes = previous.deploymentRecipes.filter((recipe) =>
        recipe.artifactRepos.some((repo) => repos.has(repo.toLowerCase())),
      );
      const excludedUrls = new Set([
        `https://huggingface.co/${parsed.repo.id}`,
        ...previous.deploymentRecipes.filter((recipe) => !retainedRecipes.includes(recipe)).map((recipe) => recipe.recipeUrl),
      ]);
      const obsoleteArtifacts = await ctx.db.query("artifacts")
        .withIndex("by_repo", (q) => q.eq("huggingFaceRepo", previousRepoName ?? parsed.repo.id)).take(21);
      if (obsoleteArtifacts.length > 20) throw new Error("Repository exceeds the variant repair bound");
      for (const artifact of obsoleteArtifacts) {
        const variant = await ctx.db.get(artifact.variantId);
        const size = variant ? await ctx.db.get(variant.sizeId) : null;
        if (size?.slug === previousEntry.slug) await ctx.db.patch(artifact._id, { available: false, confidence: "needs_review" });
      }
      await ctx.db.patch(previousEntry._id, {
        sourceRepos: remaining.map((artifact) => artifact.repo),
        payload: {
          ...previous,
          artifacts: remaining,
          quantizations: [...new Set(remaining.map((artifact) => artifact.format))],
          providers: [...new Set(remaining.map((artifact) => uploaderDisplay(artifact.repo)))].sort(),
          deploymentRecipes: retainedRecipes,
          // Durable materialChanges/runReports records remain in their source tables.
          materialChanges: previous.materialChanges.filter((change) => !change.sourceUrls.some((url) => excludedUrls.has(url))),
          runReports: previous.runReports.filter((report) => repos.has(report.artifactRepo.toLowerCase())),
        },
      });
    }
    payload = await applyModelIntroduction(ctx, payload.slug, payload);
    const existingEntry = target?.slug === payload.slug
      ? target
      : await ctx.db
          .query("catalogEntries")
          .withIndex("by_slug", (q) => q.eq("slug", payload!.slug))
          .unique();
    const publicPayload = clean(payload);
    const publicChanged = !existingEntry || !convexValuesEqual(existingEntry.payload, publicPayload);
    const sourceRepos = payload.artifacts.map((artifact) => artifact.repo);
    const catalogValue = {
      slug: payload.slug,
      familyId: payload.family.id,
      releaseId: payload.release.id,
      sizeLabel: payload.size.label,
      sourceRepos,
      updatedAt: payload.timestamp,
      payload: publicPayload,
      publishedAt: args.now,
      sourceRevision: parsed.repo.sha,
    };
    if (publicChanged) {
      if (existingEntry) await ctx.db.patch(existingEntry._id, catalogValue);
      else await ctx.db.insert("catalogEntries", catalogValue);
      await upsertNormalized(ctx, payload, parsed, source.role, args.now, previousRepoName);

      const previousPayload = existingEntry?.payload as PublishedCatalogEntry | undefined;
      const previousArtifact = previousPayload?.artifacts.find(
        (artifact) => artifact.repo === parsed.repo.id || artifact.repo === previousRepoName,
      );
      const nextArtifact = payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id);
      const sourceUrl = `https://huggingface.co/${parsed.repo.id}`;
      if (!existingEntry) {
        await upsertMaterialChange(ctx, {
          dedupeKey: `${payload.slug}:model_published:${parsed.repo.id}:${parsed.repo.sha}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "model_published",
          occurredAt: significantTimestamp(parsed.repo),
          title: "Model weights published",
          summary: `${parsed.repo.id} entered the catalog from structured Hugging Face metadata.`,
          sourceLabel: "Hugging Face",
          sourceUrls: [sourceUrl],
        }, args.now);
      } else if (!previousArtifact) {
        await upsertMaterialChange(ctx, {
          dedupeKey: `${payload.slug}:artifact_published:${parsed.repo.id}:${parsed.repo.sha}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "artifact_published",
          occurredAt: significantTimestamp(parsed.repo),
          title: `${parsed.format} artifact added`,
          summary: `${parsed.repo.id} is now linked as a ${parsed.format} artifact.`,
          sourceLabel: "Hugging Face",
          sourceUrls: [sourceUrl],
        }, args.now);
      } else if (
        priorByName?.weightManifestHash &&
        parsed.repo.weightManifestHash &&
        priorByName.weightManifestHash !== parsed.repo.weightManifestHash
      ) {
        await upsertMaterialChange(ctx, {
          dedupeKey: `${payload.slug}:weights_updated:${parsed.repo.id}:${parsed.repo.weightManifestHash}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "weights_updated",
          occurredAt: significantTimestamp(parsed.repo),
          title: "Model weights changed",
          summary: `${parsed.repo.id} published a new recognized weight manifest.`,
          sourceLabel: "Hugging Face",
          sourceUrls: [sourceUrl],
        }, args.now);
      }
      const addedRuntimes = nextArtifact && previousArtifact
        ? nextArtifact.runtimes.filter((runtime) => !previousArtifact.runtimes.includes(runtime))
        : [];
      if (addedRuntimes.length > 0) {
        await upsertMaterialChange(ctx, {
          dedupeKey: `${payload.slug}:runtime_support_added:${parsed.repo.id}:${addedRuntimes.sort().join(",")}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "runtime_support_added",
          occurredAt: args.now,
          title: "Runtime support expanded",
          summary: `${addedRuntimes.join(", ")} support is now recorded for ${parsed.repo.id}.`,
          sourceLabel: "Hugging Face metadata",
          sourceUrls: [sourceUrl],
        }, args.now);
      }
      if (
        priorByName &&
        (priorByName.license !== parsed.repo.license || priorByName.gated !== parsed.repo.gated)
      ) {
        const changes = [
          priorByName.license !== parsed.repo.license
            ? `license ${priorByName.license ?? "unknown"} to ${parsed.repo.license ?? "unknown"}`
            : null,
          priorByName.gated !== parsed.repo.gated
            ? `${parsed.repo.gated ? "gated" : "public"} access`
            : null,
        ].filter((value): value is string => Boolean(value));
        await upsertMaterialChange(ctx, {
          dedupeKey: `${payload.slug}:license_or_access_changed:${parsed.repo.id}:${parsed.repo.sha}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "license_or_access_changed",
          occurredAt: args.now,
          title: "License or access changed",
          summary: `${parsed.repo.id} changed ${changes.join(" and ")}.`,
          sourceLabel: "Hugging Face metadata",
          sourceUrls: [sourceUrl],
        }, args.now);
      }
    }

    if (run.kind !== "audit") {
      const state = await ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", "public"))
        .unique();
      const stateValue = {
        key: "public",
        revision: publicChanged ? `${parsed.repo.sha}:${args.now}` : state?.revision ?? `${parsed.repo.sha}:${args.now}`,
        syncedAt: args.now,
        lastWebhookAt: args.eventId ? args.now : state?.lastWebhookAt,
        lastSuccessfulAuditAt: state?.lastSuccessfulAuditAt,
      };
      const stateId = state
        ? (await ctx.db.patch(state._id, clean(stateValue)), state._id)
        : await ctx.db.insert("catalogState", clean(stateValue));
      if (publicChanged) {
        await scheduleCatalogSnapshotRefresh(
          ctx,
          stateId,
          state?.snapshotRefreshScheduledAt,
          args.now,
          5_000,
        );
      }
      await ctx.db.patch(args.runId, {
        changed: run.changed + (publicChanged ? 1 : 0),
        published: run.published + 1,
      });
    }
    if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now, nextRetryAt: undefined });
    return { status: "published" as const, slug: payload.slug, resolution, changed: publicChanged };
  },
});

export const finishWebhookRun = internalMutation({
  args: { runId: v.id("syncRuns"), now: v.number(), success: v.boolean(), message: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    await ctx.db.patch(args.runId, clean({
      status: args.success ? "success" as const : "failed" as const,
      completedAt: args.now,
      failed: args.success ? run.failed : run.failed + 1,
      message: args.message,
    }));
    return null;
  },
});

export const completeUnchangedWebhook = internalMutation({
  args: { eventId: v.id("webhookEvents"), runId: v.id("syncRuns"), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now, nextRetryAt: undefined });
    await ctx.db.patch(args.runId, {
      status: "success",
      completedAt: args.now,
      message: "Repository SHA already processed",
    });
    return null;
  },
});

export const scheduleWebhookRetry = internalMutation({
  args: {
    eventId: v.id("webhookEvents"),
    runId: v.id("syncRuns"),
    attempt: v.number(),
    error: v.string(),
    delayMs: v.number(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run) await ctx.db.patch(args.runId, { retries: run.retries + 1, message: args.error });
    await ctx.db.patch(args.eventId, {
      error: args.error,
      nextRetryAt: args.now + args.delayMs,
    });
    await ctx.scheduler.runAfter(
      args.delayMs,
      internal.sync.processWebhook,
      { eventId: args.eventId, attempt: args.attempt + 1, runId: args.runId },
    );
    return null;
  },
});

export const failWebhook = internalMutation({
  args: { eventId: v.id("webhookEvents"), runId: v.id("syncRuns"), error: v.string(), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { status: "failed", error: args.error, processedAt: args.now, nextRetryAt: undefined });
    const run = await ctx.db.get(args.runId);
    if (run) {
      await ctx.db.patch(args.runId, {
        status: "failed",
        completedAt: args.now,
        failed: run.failed + 1,
        message: args.error,
      });
    }
    return null;
  },
});

export const removeRepository = internalMutation({
  args: {
    repoName: v.string(),
    explicit: v.boolean(),
    now: v.number(),
    eventId: v.optional(v.id("webhookEvents")),
    runId: v.optional(v.id("syncRuns")),
  },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", args.repoName))
      .unique();
    if (!source) return { removed: false };
    const missingCount = args.explicit ? 3 : source.missingCount + 1;
    await ctx.db.patch(source._id, {
      missingCount,
      status: missingCount >= 3 ? "missing" : source.status,
      lastIngestedAt: args.now,
    });
    if (missingCount >= 3) {
      const artifacts = await ctx.db
        .query("artifacts")
        .withIndex("by_repo", (q) => q.eq("huggingFaceRepo", args.repoName))
        .take(101);
      if (artifacts.length > 100) throw new Error("Repository exceeds the 100-artifact removal bound");
      for (const artifact of artifacts) await ctx.db.patch(artifact._id, { available: false, lastSyncedAt: args.now });
      const variants = await Promise.all(artifacts.map((artifact) => ctx.db.get(artifact.variantId)));
      const sizeIds = [...new Set(variants.filter(Boolean).map((variant) => variant!.sizeId))];
      const sizes = await Promise.all(sizeIds.map((sizeId) => ctx.db.get(sizeId)));
      const affectedSlugs = [...new Set(sizes.filter(Boolean).map((size) => size!.slug))];
      const entries = (await Promise.all(
        affectedSlugs.map((slug) =>
          ctx.db
            .query("catalogEntries")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique(),
        ),
      )).filter((entry) => entry !== null);
      let catalogChanged = false;
      for (const entry of entries) {
        const payload = entry.payload as PublishedCatalogEntry;
        const remaining = payload.artifacts.filter((artifact) => artifact.repo !== args.repoName);
        if (remaining.length === payload.artifacts.length) continue;
        catalogChanged = true;
        if (remaining.length === 0) {
          await ctx.db.delete(entry._id);
        } else {
          const nextPayload = {
            ...payload,
            artifacts: remaining,
            quantizations: [...new Set(remaining.map((artifact) => artifact.format))],
            providers: [...new Set(remaining.map((artifact) => uploaderDisplay(artifact.repo)))].sort(),
          };
          await ctx.db.patch(entry._id, {
            payload: nextPayload,
            sourceRepos: remaining.map((artifact) => artifact.repo),
            publishedAt: args.now,
            sourceRevision: `removed:${args.repoName}:${args.now}`,
          });
        }
      }
      if (catalogChanged) {
        const state = await ctx.db
          .query("catalogState")
          .withIndex("by_key", (q) => q.eq("key", "public"))
          .unique();
        const stateValue = {
          key: "public",
          revision: `removed:${args.repoName}:${args.now}`,
          syncedAt: args.now,
          lastWebhookAt: args.eventId ? args.now : state?.lastWebhookAt,
          lastSuccessfulAuditAt: state?.lastSuccessfulAuditAt,
        };
        const stateId = state
          ? (await ctx.db.patch(state._id, clean(stateValue)), state._id)
          : await ctx.db.insert("catalogState", clean(stateValue));
        await scheduleCatalogSnapshotRefresh(
          ctx,
          stateId,
          state?.snapshotRefreshScheduledAt,
          args.now,
          5_000,
        );
      }
    }
    if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now, nextRetryAt: undefined });
    if (args.runId) {
      const run = await ctx.db.get(args.runId);
      if (run) await ctx.db.patch(args.runId, { changed: run.changed + 1 });
    }
    return { removed: missingCount >= 3 };
  },
});

export const processWebhook = internalAction({
  args: {
    eventId: v.id("webhookEvents"),
    attempt: v.number(),
    runId: v.optional(v.id("syncRuns")),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const event = await ctx.runQuery(internal.sync.eventById, { eventId: args.eventId });
    if (!event || event.status !== "pending") return null;
    const runId = args.runId ?? (await ctx.runMutation(internal.sync.startWebhookRun, { owner: event.owner, now: Date.now() }));
    try {
      if (event.action === "delete") {
        const result = await fetchRepo(event.repoName);
        if (result.status === 404) {
          await ctx.runMutation(internal.sync.removeRepository, {
            repoName: event.repoName,
            explicit: true,
            now: Date.now(),
            eventId: args.eventId,
            runId,
          });
          await ctx.runMutation(internal.sync.finishWebhookRun, { runId, now: Date.now(), success: true });
          return null;
        }
        if (!result.data) throw new Error(`Delete confirmation failed with HTTP ${result.status}`);
      }
      const response = await fetchRepo(event.repoName);
      if (!response.data) throw new Error(`Hugging Face repo fetch failed: ${response.status}`);
      const normalized = normalizeHuggingFaceRepo(response.data);
      const prior = await ctx.runQuery(internal.sync.sourceRepoById, { repoId: event.repoId });
      if (
        !event.scope.startsWith("repo.config") &&
        prior?.headSha &&
        prior.headSha === normalized.sha &&
        prior.repoName === normalized.id &&
        prior.weightManifestHash &&
        prior.weightsLastModifiedAt
      ) {
        await ctx.runMutation(internal.sync.completeUnchangedWebhook, {
          eventId: args.eventId,
          runId,
          now: Date.now(),
        });
        return null;
      }
      const source = await ctx.runQuery(internal.sync.sourceByOwner, { owner: event.owner });
      if (!source?.enabled) throw new Error(`Source ${event.owner} is no longer monitored`);
      const classification = compactClassification(
        await classifyWithWeightMetadata(response.data, sourceRule(source)),
      );
      await ctx.runMutation(internal.sync.applyRepoResult, {
        classification,
        sourceOwner: event.owner,
        repoKey: event.repoId,
        runId,
        eventId: args.eventId,
        now: Date.now(),
      });
      await ctx.runMutation(internal.sync.finishWebhookRun, { runId, now: Date.now(), success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (args.attempt < 2) {
        const delayMs = retryDelayForError(error, args.attempt, 30_000);
        await ctx.runMutation(internal.sync.scheduleWebhookRetry, {
          eventId: args.eventId,
          runId,
          attempt: args.attempt,
          error: message,
          delayMs,
          now: Date.now(),
        });
      } else {
        await ctx.runMutation(internal.sync.failWebhook, {
          eventId: args.eventId,
          runId,
          error: message,
          now: Date.now(),
        });
      }
    }
    return null;
  },
});

export const startDailyAudit = internalMutation({
  args: { paceMs: v.optional(v.number()) },
  returns: v.object({ scheduled: v.boolean(), runId: v.id("syncRuns") }),
  handler: async (ctx, args) => {
    const runningAudit = await ctx.db
      .query("syncRuns")
      .withIndex("by_status_and_kind", (q) => q.eq("status", "running").eq("kind", "audit"))
      .first();
    if (runningAudit) return { scheduled: false, runId: runningAudit._id };
    const sources = (await ctx.db
      .query("monitoredSources")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .take(100)).sort((left, right) => left.owner.localeCompare(right.owner));
    const now = Date.now();
    const paceMs = Math.max(5_000, Math.min(args.paceMs ?? 30_000, 60_000));
    const runId = await ctx.db.insert("syncRuns", {
      kind: "audit",
      status: "running",
      startedAt: now,
      discovered: 0,
      changed: 0,
      published: 0,
      skipped: 0,
      failed: 0,
      retries: 0,
      expectedSources: sources.length,
      completedSources: 0,
      sourceOwners: sources.map((source) => source.owner),
      sourcePaceMs: paceMs,
    });
    const firstSource = sources[0];
    if (firstSource) {
      await ctx.scheduler.runAfter(0, internal.sync.auditSource, {
        runId,
        owner: firstSource.owner,
        attempt: 0,
      });
    } else {
      await ctx.db.patch(runId, { status: "success", completedAt: now });
    }
    return { scheduled: true, runId };
  },
});

export const cancelRunningAudit = internalMutation({
  args: { reason: v.string(), now: v.number() },
  returns: v.object({ cancelled: v.boolean(), runId: v.union(v.id("syncRuns"), v.null()) }),
  handler: async (ctx, args) => {
    const runningAudit = await ctx.db
      .query("syncRuns")
      .withIndex("by_status_and_kind", (q) => q.eq("status", "running").eq("kind", "audit"))
      .first();
    if (!runningAudit) return { cancelled: false, runId: null };
    await ctx.db.patch(runningAudit._id, {
      status: "degraded",
      completedAt: args.now,
      message: args.reason,
    });
    return { cancelled: true, runId: runningAudit._id };
  },
});

export const recordAuditRetry = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    owner: v.string(),
    message: v.string(),
    nextRetryAt: v.number(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    await ctx.db.patch(args.runId, { retries: run.retries + 1, message: args.message });
    const sourceByKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.owner)))
      .first();
    const source = sourceByKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
    if (source) {
      await ctx.db.patch(source._id, {
        lastAuditAt: args.now,
        lastError: args.message,
        consecutiveFailures: (source.consecutiveFailures ?? 0) + 1,
        nextRetryAt: args.nextRetryAt,
      });
    }
    return null;
  },
});

export const markAuditMissing = internalMutation({
  args: { owner: v.string(), seen: v.array(v.string()), runId: v.id("syncRuns"), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seen = new Set(args.seen);
    const repos = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .take(2_000);
    for (const repo of repos) {
      if (seen.has(repo.repoName)) {
        if (repo.missingCount !== 0) await ctx.db.patch(repo._id, { missingCount: 0, lastSeenAt: args.now });
      } else {
        await ctx.scheduler.runAfter(0, internal.sync.removeRepository, {
          repoName: repo.repoName,
          explicit: false,
          now: args.now,
          runId: args.runId,
        });
      }
    }
    return null;
  },
});

export const finishAuditSource = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    owner: v.string(),
    success: v.boolean(),
    discovered: v.number(),
    changed: v.number(),
    published: v.number(),
    skipped: v.number(),
    message: v.optional(v.string()),
    nextRetryAt: v.optional(v.number()),
    now: v.number(),
  },
  returns: v.union(v.null(), v.object({
    nextOwner: v.union(v.string(), v.null()),
    paceMs: v.number(),
  })),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    const sourceByKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.owner)))
      .first();
    const source = sourceByKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
    if (!run || !source) return null;
    await ctx.db.patch(source._id, {
      lastAuditAt: args.now,
      lastSuccessAt: args.success ? args.now : source.lastSuccessAt,
      lastError: args.success ? undefined : args.message,
      consecutiveFailures: args.success ? 0 : (source.consecutiveFailures ?? 0) + 1,
      nextRetryAt: args.success ? undefined : args.nextRetryAt,
    });
    const completedSources = (run.completedSources ?? 0) + 1;
    const failed = run.failed + (args.success ? 0 : 1);
    const changed = run.changed + args.changed;
    const published = run.published + args.published;
    const skipped = run.skipped + args.skipped;
    const complete = completedSources >= (run.expectedSources ?? 0);
    await ctx.db.patch(args.runId, clean({
      completedSources,
      discovered: run.discovered + args.discovered,
      changed,
      published,
      skipped,
      failed,
      status: complete ? (failed > 0 ? "degraded" as const : "success" as const) : "running" as const,
      completedAt: complete ? args.now : undefined,
      message: args.success ? run.message : `${args.owner}: ${args.message ?? "source audit failed"}`,
    }));
    if (complete) {
      const state = await ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", "public"))
        .unique();
      const stateValue = clean({
        key: "public",
        revision: changed > 0 ? `audit:${args.runId}:${args.now}` : state?.revision ?? `audit:${args.now}`,
        syncedAt: args.now,
        lastWebhookAt: state?.lastWebhookAt,
        lastSuccessfulAuditAt: failed === 0 ? args.now : state?.lastSuccessfulAuditAt,
        lastCompletedAuditAt: args.now,
        lastDegradedAuditAt: failed > 0 ? args.now : state?.lastDegradedAuditAt,
      });
      const stateId = state
        ? (await ctx.db.patch(state._id, stateValue), state._id)
        : await ctx.db.insert("catalogState", stateValue);
      await scheduleCatalogSnapshotRefresh(
        ctx,
        stateId,
        state?.snapshotRefreshScheduledAt,
        args.now,
        5_000,
      );
    }
    return {
      nextOwner: complete ? null : run.sourceOwners?.[completedSources] ?? null,
      paceMs: run.sourcePaceMs ?? 30_000,
    };
  },
});

export const auditSource = internalAction({
  args: { runId: v.id("syncRuns"), owner: v.string(), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const activeRun = await ctx.runQuery(internal.sync.syncRunById, { runId: args.runId });
    if (!activeRun || activeRun.status !== "running") return null;
    try {
      const source = await ctx.runQuery(internal.sync.sourceByOwner, { owner: args.owner });
      if (!source?.enabled) throw new Error(`Source ${args.owner} is not enabled`);
      const rawRepos = await listRepos(args.owner);
      const rule = sourceRule(source);
      const candidates = rawRepos
        .map(normalizeHuggingFaceRepo)
        .filter((repo) => repo.id && matchesSourceRules(repo.id, rule));
      const seen = candidates.map((repo) => repo.id);
      let changed = 0;
      let published = 0;
      let skipped = 0;
      for (let offset = 0; offset < candidates.length; offset += 12) {
        const batch = candidates.slice(offset, offset + 12);
        const previous = await Promise.all(
          batch.map((repo) => ctx.runQuery(internal.sync.sourceRepoByName, { repoName: repo.id })),
        );
        const changedRepos = batch.filter((repo, index) => {
          const prior = previous[index];
          if (prior?.headSha !== repo.sha) return true;
          return false;
        });
        const hydrated: Array<{ repo: (typeof changedRepos)[number]; data: unknown }> = [];
        for (const repo of changedRepos) {
          const response = await fetchRepo(repo.id);
          if (!response.data) {
            throw new Error(`Hugging Face repo fetch failed for ${repo.id}: ${response.status}`);
          }
          hydrated.push({ repo, data: response.data });
        }
        for (const result of hydrated) {
          const classification = compactClassification(
            await classifyWithWeightMetadata(result.data, rule),
          );
          const outcome = await ctx.runMutation(internal.sync.applyRepoResult, {
            classification,
            sourceOwner: args.owner,
            repoKey: result.repo.id,
            runId: args.runId,
            now: Date.now(),
          });
          if (outcome.status === "published") {
            published += 1;
            if (outcome.changed) changed += 1;
          } else {
            skipped += 1;
          }
        }
      }
      await ctx.runMutation(internal.sync.markAuditMissing, {
        owner: args.owner,
        seen,
        runId: args.runId,
        now: Date.now(),
      });
      const completion = await ctx.runMutation(internal.sync.finishAuditSource, {
        runId: args.runId,
        owner: args.owner,
        success: true,
        discovered: candidates.length,
        changed,
        published,
        skipped,
        now: Date.now(),
      });
      if (completion?.nextOwner) {
        await ctx.scheduler.runAfter(completion.paceMs, internal.sync.auditSource, {
          runId: args.runId,
          owner: completion.nextOwner,
          attempt: 0,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const currentRun = await ctx.runQuery(internal.sync.syncRunById, { runId: args.runId });
      if (!currentRun || currentRun.status !== "running") return null;
      if (args.attempt < 2) {
        const delayMs = retryDelayForError(error, args.attempt, 60_000);
        const now = Date.now();
        await ctx.runMutation(internal.sync.recordAuditRetry, {
          runId: args.runId,
          owner: args.owner,
          message,
          nextRetryAt: now + delayMs,
          now,
        });
        await ctx.scheduler.runAfter(delayMs, internal.sync.auditSource, {
          ...args,
          attempt: args.attempt + 1,
        });
        return null;
      }
      const completion = await ctx.runMutation(internal.sync.finishAuditSource, {
        runId: args.runId,
        owner: args.owner,
        success: false,
        discovered: 0,
        changed: 0,
        published: 0,
        skipped: 0,
        message,
        now: Date.now(),
      });
      if (completion?.nextOwner) {
        await ctx.scheduler.runAfter(completion.paceMs, internal.sync.auditSource, {
          runId: args.runId,
          owner: completion.nextOwner,
          attempt: 0,
        });
      }
    }
    return null;
  },
});

/** Operator-only reingestion after identity-rule changes, even when the SHA is unchanged. */
export const refreshRepository = internalAction({
  args: { repoName: v.string() },
  returns: v.null(),
  handler: async (ctx, { repoName }): Promise<null> => {
    const owner = repoName.split("/")[0];
    const source = await ctx.runQuery(internal.sync.sourceByOwner, { owner });
    if (!source?.enabled) throw new Error("Source is not enabled");
    const runId = await ctx.runMutation(internal.sync.startWebhookRun, { owner, now: Date.now() });
    try {
      const response = await fetchRepo(repoName);
      if (!response.data) throw new Error(`Repository fetch failed: ${response.status}`);
      const classification = compactClassification(await classifyWithWeightMetadata(response.data, sourceRule(source)));
      if (classification.status !== "publishable") throw new Error(`Repository cannot be published: ${classification.reason}`);
      const result = await ctx.runMutation(internal.sync.applyRepoResult, {
        classification, sourceOwner: owner, runId, now: Date.now(),
      });
      if (result.status !== "published") throw new Error(result.reason);
      await ctx.runMutation(internal.sync.finishWebhookRun, { runId, now: Date.now(), success: true });
    } catch (error) {
      await ctx.runMutation(internal.sync.finishWebhookRun, {
        runId, now: Date.now(), success: false, message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    return null;
  },
});
