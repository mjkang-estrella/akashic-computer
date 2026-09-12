import { v, type Infer } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import {
  normalizeOwnerKey,
  type IngestionClassification,
} from "../src/lib/atlas/huggingface";
import {
  normalizeCatalogEntry,
  type PublishedCatalogEntry,
} from "../src/lib/atlas/published";
import { uploaderDisplay } from "../src/lib/atlas/naming";
import {
  convexValuesEqual,
  scheduleCatalogSnapshotRefresh,
} from "./catalogSnapshot";
import { upsertMaterialChange } from "./intelligence";
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

export const CATALOG_INGESTION_VERSION = 2 as const;

export const repositoryIngestionArgs = {
  classification: ingestionClassificationValue,
  sourceOwner: v.string(),
  repoKey: v.optional(v.string()),
  runId: v.id("syncRuns"),
  auditJobId: v.optional(v.id("sourceAuditJobs")),
  auditLeaseToken: v.optional(v.number()),
  eventId: v.optional(v.id("webhookEvents")),
  now: v.number(),
};

export const repositoryIngestionValue = v.object(repositoryIngestionArgs);

export const repositoryIngestionResultValue = v.union(
  v.object({ status: v.literal("skipped"), reason: v.string() }),
  v.object({
    status: v.literal("published"),
    slug: v.string(),
    resolution: v.union(
      v.literal("direct"),
      v.literal("family_scan"),
      v.literal("new"),
    ),
    changed: v.boolean(),
  }),
);

async function applyModelIntroduction(
  ctx: MutationCtx,
  slug: string,
  payload: PublishedCatalogEntry,
) {
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
  if (artifacts.length > 20)
    throw new Error("Repository exceeds the variant lookup bound");
  for (const artifact of artifacts) {
    if (!artifact.available) continue;
    const variant = await ctx.db.get(artifact.variantId);
    if (!variant) continue;
    const size = await ctx.db.get(variant.sizeId);
    if (!size) continue;
    const entry = await ctx.db
      .query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", size.slug))
      .unique();
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
  const entries: NonNullable<
    Awaited<ReturnType<typeof catalogEntryForRepo>>
  >[] = [];
  const repoNames = [
    parsed.repo.id,
    previousRepoName,
    ...parsed.repo.baseModels,
  ].filter((repoName): repoName is string => Boolean(repoName));
  for (const repoName of new Set(repoNames)) {
    const entry = await catalogEntryForRepo(ctx, repoName);
    if (entry && !entries.some((item) => item._id === entry._id))
      entries.push(entry);
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
    const familyId = await ctx.db.insert(
      "modelFamilies",
      clean({
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
      }),
    );
    family = await ctx.db.get(familyId);
  }
  if (!family) throw new Error("Failed to materialize family");
  let release = await ctx.db
    .query("modelReleases")
    .withIndex("by_family_slug", (q) =>
      q.eq("familyId", family!._id).eq("slug", payload.release.id),
    )
    .unique();
  if (!release) {
    const releaseId = await ctx.db.insert(
      "modelReleases",
      clean({
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
      }),
    );
    release = await ctx.db.get(releaseId);
  } else {
    await ctx.db.patch(
      release._id,
      clean({
        lastUpdatedAt: payload.timestamp,
        sourceSha: parsed.repo.sha,
        lastSyncedAt: now,
      }),
    );
  }
  if (!release) throw new Error("Failed to materialize release");
  let size = await ctx.db
    .query("modelSizes")
    .withIndex("by_slug", (q) => q.eq("slug", payload.slug))
    .unique();
  if (!size) {
    const sizeId = await ctx.db.insert(
      "modelSizes",
      clean({
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
      }),
    );
    size = await ctx.db.get(sizeId);
  } else {
    await ctx.db.patch(
      size._id,
      clean({
        label: payload.size.label,
        parameterCountB: payload.size.paramsB,
        activeParameterCountB: payload.size.activeParamsB,
        lastUpdatedAt: payload.timestamp,
        sourceSha: parsed.repo.sha,
        lastSyncedAt: now,
      }),
    );
  }
  if (!size) throw new Error("Failed to materialize size");
  const variantName =
    payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)
      ?.variant ?? parsed.variant;
  let variant = await ctx.db
    .query("modelVariants")
    .withIndex("by_size_slug", (q) =>
      q.eq("sizeId", size!._id).eq("slug", slugPart(variantName)),
    )
    .unique();
  if (!variant) {
    const kindText = variantName.toLowerCase();
    const variantKind = kindText.includes("base")
      ? ("base" as const)
      : kindText.includes("reason")
        ? ("reasoning" as const)
        : kindText.includes("code")
          ? ("coder" as const)
          : kindText.includes("embedding")
            ? ("embedding" as const)
            : kindText.includes("rerank")
              ? ("reranker" as const)
              : ("instruct" as const);
    const variantId = await ctx.db.insert(
      "modelVariants",
      clean({
        sizeId: size._id,
        slug: slugPart(variantName),
        name: variantName,
        category: payload.category,
        capabilities: payload.capabilities,
        variantKind,
        sourceRepo: parsed.repo.id,
        sourceSha: parsed.repo.sha,
        lastSyncedAt: now,
      }),
    );
    variant = await ctx.db.get(variantId);
  }
  if (!variant) throw new Error("Failed to materialize variant");
  const existingArtifact =
    (await ctx.db
      .query("artifacts")
      .withIndex("by_repo_variant", (q) =>
        q.eq("huggingFaceRepo", parsed.repo.id).eq("variantId", variant!._id),
      )
      .unique()) ??
    (previousRepoName && previousRepoName !== parsed.repo.id
      ? await ctx.db
          .query("artifacts")
          .withIndex("by_repo_variant", (q) =>
            q
              .eq("huggingFaceRepo", previousRepoName)
              .eq("variantId", variant!._id),
          )
          .unique()
      : null);
  const artifactValue = clean({
    variantId: variant._id,
    huggingFaceRepo: parsed.repo.id,
    format: parsed.format,
    quantization: parsed.format,
    uploaderKind: trustForRole(role, parsed.repo.baseModels.length > 0),
    runtimeSupport:
      payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)
        ?.runtimes ?? parsed.runtimes,
    hardwareKinds:
      payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)
        ?.kinds ?? parsed.kinds,
    minVramGb: payload.artifacts.find(
      (artifact) => artifact.repo === parsed.repo.id,
    )?.minVramGb,
    recommendedVramGb: payload.artifacts.find(
      (artifact) => artifact.repo === parsed.repo.id,
    )?.recVramGb,
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

export async function ingestRepository(
  ctx: MutationCtx,
  args: Infer<typeof repositoryIngestionValue>,
): Promise<Infer<typeof repositoryIngestionResultValue>> {
  const run = await ctx.db.get(args.runId);
  if (!run || run.status !== "running")
    return {
      status: "skipped" as const,
      reason: "Sync run is no longer active",
    };
  if (args.eventId) {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== "pending")
      return {
        status: "skipped" as const,
        reason: "Webhook was already completed",
      };
  }
  if (args.auditJobId) {
    const job = await ctx.db.get(args.auditJobId);
    if (
      !job ||
      job.runId !== args.runId ||
      job.owner !== args.sourceOwner ||
      job.status !== "running" ||
      job.leaseToken !== args.auditLeaseToken
    ) {
      return {
        status: "skipped" as const,
        reason: "Audit action lease was superseded",
      };
    }
  }

  const sourceByKey = await ctx.db
    .query("monitoredSources")
    .withIndex("by_owner_key", (q) =>
      q.eq("ownerKey", normalizeOwnerKey(args.sourceOwner)),
    )
    .first();
  const source =
    sourceByKey ??
    (await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.sourceOwner))
      .first());
  if (!source) throw new Error(`Unmonitored source ${args.sourceOwner}`);
  const classification = args.classification as IngestionClassification;
  const repo =
    classification.status === "publishable"
      ? classification.parsed.repo
      : classification.repo;
  const priorById = await ctx.db
    .query("sourceRepositories")
    .withIndex("by_repo_id", (q) => q.eq("repoId", args.repoKey ?? repo.id))
    .first();
  const priorByName =
    priorById ??
    (await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", repo.id))
      .first());
  const sourceValue = clean({
    ingestionVersion: CATALOG_INGESTION_VERSION,
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
    status:
      classification.status === "publishable"
        ? ("published" as const)
        : ("skipped" as const),
    skipReason:
      classification.status === "skipped" ? classification.reason : undefined,
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

  if (classification.status === "skipped") {
    if (run.kind !== "audit") {
      await ctx.db.patch(args.runId, {
        skipped: run.skipped + 1,
        changed: run.changed + 1,
      });
    }
    if (args.eventId)
      await ctx.db.patch(args.eventId, {
        status: "processed",
        processedAt: args.now,
        nextRetryAt: undefined,
      });
    return { status: "skipped" as const, reason: classification.reason };
  }

  const parsed = classification.parsed;
  const rule = sourceRule(source);
  const previousRepoName =
    priorByName?.repoName !== parsed.repo.id
      ? priorByName?.repoName
      : undefined;
  const directTarget = await directlyLinkedCatalogEntry(
    ctx,
    parsed,
    previousRepoName,
    rule,
  );
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
    throw new Error(
      "Catalog family exceeds the 500-entry reconciliation bound",
    );
  }
  const documents = directTarget ? [directTarget] : familyDocuments.flat();
  const target = directTarget ?? targetForParsed(documents, parsed, rule);
  const resolution = directTarget
    ? ("direct" as const)
    : target
      ? ("family_scan" as const)
      : ("new" as const);
  let payload: PublishedCatalogEntry | null = target
    ? mergeParsedIntoPayload(
        normalizeCatalogEntry(target.payload),
        parsed,
        source.role,
        previousRepoName,
      )
    : null;
  if (
    !payload &&
    source.role !== "artifact_provider" &&
    !(source.role === "creator_provider" && parsed.repo.baseModels.length > 0)
  ) {
    const family = familyForParsed(documents, parsed, rule);
    if (family) payload = newPayload(family, parsed);
  }
  if (
    !target &&
    payload &&
    documents.some((document) => document.slug === payload?.slug)
  )
    payload = null;
  if (!payload) {
    await ctx.db.patch(sourceRepoId, {
      status: "skipped",
      skipReason:
        "structured metadata could not resolve a catalog family or base model",
    });
    if (run.kind !== "audit") {
      await ctx.db.patch(args.runId, {
        skipped: run.skipped + 1,
        changed: run.changed + 1,
      });
    }
    if (args.eventId)
      await ctx.db.patch(args.eventId, {
        status: "processed",
        processedAt: args.now,
        nextRetryAt: undefined,
      });
    return {
      status: "skipped" as const,
      reason: "unresolved catalog identity",
    };
  }

  // Repair an old incorrect association atomically with the new association.
  const previousEntry = await catalogEntryForRepo(
    ctx,
    previousRepoName ?? parsed.repo.id,
  );
  if (previousEntry && previousEntry.slug !== payload.slug) {
    const previous = normalizeCatalogEntry(previousEntry.payload);
    const remaining = previous.artifacts.filter(
      (artifact) =>
        artifact.repo !== parsed.repo.id && artifact.repo !== previousRepoName,
    );
    const repos = new Set(
      remaining.map((artifact) => artifact.repo.toLowerCase()),
    );
    const retainedRecipes = previous.deploymentRecipes.filter((recipe) =>
      recipe.artifactRepos.some((repo) => repos.has(repo.toLowerCase())),
    );
    const excludedUrls = new Set([
      `https://huggingface.co/${parsed.repo.id}`,
      ...previous.deploymentRecipes
        .filter((recipe) => !retainedRecipes.includes(recipe))
        .map((recipe) => recipe.recipeUrl),
    ]);
    const obsoleteArtifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_repo", (q) =>
        q.eq("huggingFaceRepo", previousRepoName ?? parsed.repo.id),
      )
      .take(21);
    if (obsoleteArtifacts.length > 20)
      throw new Error("Repository exceeds the variant repair bound");
    for (const artifact of obsoleteArtifacts) {
      const variant = await ctx.db.get(artifact.variantId);
      const size = variant ? await ctx.db.get(variant.sizeId) : null;
      if (size?.slug === previousEntry.slug)
        await ctx.db.patch(artifact._id, {
          available: false,
          confidence: "needs_review",
        });
    }
    if (remaining.length === 0) {
      // This is a derived catalog identity, not source evidence. Retire it
      // atomically with the corrected identity and preserve shared URLs.
      await ctx.db.delete(previousEntry._id);
      const alias = await ctx.db
        .query("catalogAliases")
        .withIndex("by_slug", (q) => q.eq("slug", previousEntry.slug))
        .unique();
      const value = {
        slug: previousEntry.slug,
        canonicalSlug: payload.slug,
        createdAt: args.now,
        reason: "identity_repair" as const,
      };
      if (alias) await ctx.db.patch(alias._id, value);
      else await ctx.db.insert("catalogAliases", value);
      const upstreamAliases = await ctx.db
        .query("catalogAliases")
        .withIndex("by_canonical_slug", (q) =>
          q.eq("canonicalSlug", previousEntry.slug),
        )
        .take(101);
      if (upstreamAliases.length > 100)
        throw new Error("Catalog alias repair bound exceeded");
      for (const upstream of upstreamAliases)
        await ctx.db.patch(upstream._id, { canonicalSlug: payload.slug });
    } else
      await ctx.db.patch(previousEntry._id, {
        sourceRepos: remaining.map((artifact) => artifact.repo),
        payload: {
          ...previous,
          artifacts: remaining,
          quantizations: [
            ...new Set(remaining.map((artifact) => artifact.format)),
          ],
          providers: [
            ...new Set(
              remaining.map((artifact) => uploaderDisplay(artifact.repo)),
            ),
          ].sort(),
          deploymentRecipes: retainedRecipes,
          // Durable materialChanges/runReports records remain in their source tables.
          materialChanges: previous.materialChanges.filter(
            (change) => !change.sourceUrls.some((url) => excludedUrls.has(url)),
          ),
          runReports: previous.runReports.filter((report) =>
            repos.has(report.artifactRepo.toLowerCase()),
          ),
        },
      });
  }
  payload = await applyModelIntroduction(ctx, payload.slug, payload);
  const existingEntry =
    target?.slug === payload.slug
      ? target
      : await ctx.db
          .query("catalogEntries")
          .withIndex("by_slug", (q) => q.eq("slug", payload!.slug))
          .unique();
  const publicPayload = clean(payload);
  const publicChanged =
    !existingEntry || !convexValuesEqual(existingEntry.payload, publicPayload);
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
    await upsertNormalized(
      ctx,
      payload,
      parsed,
      source.role,
      args.now,
      previousRepoName,
    );

    const previousPayload = existingEntry?.payload as
      PublishedCatalogEntry | undefined;
    const previousArtifact = previousPayload?.artifacts.find(
      (artifact) =>
        artifact.repo === parsed.repo.id || artifact.repo === previousRepoName,
    );
    const nextArtifact = payload.artifacts.find(
      (artifact) => artifact.repo === parsed.repo.id,
    );
    const sourceUrl = `https://huggingface.co/${parsed.repo.id}`;
    if (!existingEntry) {
      await upsertMaterialChange(
        ctx,
        {
          dedupeKey: `${payload.slug}:model_published:${parsed.repo.id}:${parsed.repo.sha}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "model_published",
          occurredAt: significantTimestamp(parsed.repo),
          title: "Model weights published",
          summary: `${parsed.repo.id} entered the catalog from structured Hugging Face metadata.`,
          sourceLabel: "Hugging Face",
          sourceUrls: [sourceUrl],
        },
        args.now,
      );
    } else if (!previousArtifact) {
      await upsertMaterialChange(
        ctx,
        {
          dedupeKey: `${payload.slug}:artifact_published:${parsed.repo.id}:${parsed.repo.sha}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "artifact_published",
          occurredAt: significantTimestamp(parsed.repo),
          title: `${parsed.format} artifact added`,
          summary: `${parsed.repo.id} is now linked as a ${parsed.format} artifact.`,
          sourceLabel: "Hugging Face",
          sourceUrls: [sourceUrl],
        },
        args.now,
      );
    } else if (
      priorByName?.weightManifestHash &&
      parsed.repo.weightManifestHash &&
      priorByName.weightManifestHash !== parsed.repo.weightManifestHash
    ) {
      await upsertMaterialChange(
        ctx,
        {
          dedupeKey: `${payload.slug}:weights_updated:${parsed.repo.id}:${parsed.repo.weightManifestHash}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "weights_updated",
          occurredAt: significantTimestamp(parsed.repo),
          title: "Model weights changed",
          summary: `${parsed.repo.id} published a new recognized weight manifest.`,
          sourceLabel: "Hugging Face",
          sourceUrls: [sourceUrl],
        },
        args.now,
      );
    }
    const addedRuntimes =
      nextArtifact && previousArtifact
        ? nextArtifact.runtimes.filter(
            (runtime) => !previousArtifact.runtimes.includes(runtime),
          )
        : [];
    if (addedRuntimes.length > 0) {
      await upsertMaterialChange(
        ctx,
        {
          dedupeKey: `${payload.slug}:runtime_support_added:${parsed.repo.id}:${addedRuntimes.sort().join(",")}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "runtime_support_added",
          occurredAt: args.now,
          title: "Runtime support expanded",
          summary: `${addedRuntimes.join(", ")} support is now recorded for ${parsed.repo.id}.`,
          sourceLabel: "Hugging Face metadata",
          sourceUrls: [sourceUrl],
        },
        args.now,
      );
    }
    if (
      priorByName &&
      (priorByName.license !== parsed.repo.license ||
        priorByName.gated !== parsed.repo.gated)
    ) {
      const changes = [
        priorByName.license !== parsed.repo.license
          ? `license ${priorByName.license ?? "unknown"} to ${parsed.repo.license ?? "unknown"}`
          : null,
        priorByName.gated !== parsed.repo.gated
          ? `${parsed.repo.gated ? "gated" : "public"} access`
          : null,
      ].filter((value): value is string => Boolean(value));
      await upsertMaterialChange(
        ctx,
        {
          dedupeKey: `${payload.slug}:license_or_access_changed:${parsed.repo.id}:${parsed.repo.sha}`,
          modelSlug: payload.slug,
          modelName: payload.name,
          type: "license_or_access_changed",
          occurredAt: args.now,
          title: "License or access changed",
          summary: `${parsed.repo.id} changed ${changes.join(" and ")}.`,
          sourceLabel: "Hugging Face metadata",
          sourceUrls: [sourceUrl],
        },
        args.now,
      );
    }
  }

  if (run.kind !== "audit") {
    const state = await ctx.db
      .query("catalogState")
      .withIndex("by_key", (q) => q.eq("key", "public"))
      .unique();
    const stateValue = {
      key: "public",
      revision: publicChanged
        ? `${parsed.repo.sha}:${args.now}`
        : (state?.revision ?? `${parsed.repo.sha}:${args.now}`),
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
  if (args.eventId)
    await ctx.db.patch(args.eventId, {
      status: "processed",
      processedAt: args.now,
      nextRetryAt: undefined,
    });
  return {
    status: "published" as const,
    slug: payload.slug,
    resolution,
    changed: publicChanged,
  };
}
