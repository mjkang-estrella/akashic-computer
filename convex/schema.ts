import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { publishedCatalogEntryValue, publishedCatalogSummaryValue } from "./catalogValues";

const sourceFields = {
  sourceRepo: v.optional(v.string()),
  sourceSha: v.optional(v.string()),
  lastSyncedAt: v.optional(v.number()),
  lockedFields: v.optional(v.array(v.string())),
};

export default defineSchema({
  modelFamilies: defineTable({
    slug: v.string(),
    name: v.string(),
    vendor: v.string(),
    summary: v.string(),
    homepageUrl: v.optional(v.string()),
    license: v.optional(v.string()),
    modalities: v.array(v.string()),
    tags: v.array(v.string()),
    category: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    sourceOwner: v.optional(v.string()),
    ...sourceFields,
  })
    .index("by_slug", ["slug"])
    .index("by_source_owner", ["sourceOwner"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["vendor"],
    }),

  modelReleases: defineTable({
    familyId: v.id("modelFamilies"),
    slug: v.string(),
    name: v.string(),
    version: v.optional(v.string()),
    releasedAt: v.optional(v.number()),
    lastUpdatedAt: v.optional(v.number()),
    contextTokens: v.optional(v.number()),
    contextLabel: v.optional(v.string()),
    license: v.optional(v.string()),
    notes: v.optional(v.string()),
    category: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    ...sourceFields,
  })
    .index("by_family", ["familyId"])
    .index("by_family_slug", ["familyId", "slug"])
    .index("by_slug", ["slug"]),

  modelSizes: defineTable({
    releaseId: v.id("modelReleases"),
    slug: v.string(),
    label: v.string(),
    parameterCountB: v.number(),
    activeParameterCountB: v.optional(v.number()),
    contextTokens: v.optional(v.number()),
    contextLabel: v.optional(v.string()),
    lastUpdatedAt: v.optional(v.number()),
    category: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    ...sourceFields,
  })
    .index("by_release", ["releaseId"])
    .index("by_slug", ["slug"]),

  modelVariants: defineTable({
    sizeId: v.id("modelSizes"),
    slug: v.string(),
    name: v.string(),
    architecture: v.optional(v.string()),
    category: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    variantKind: v.union(
      v.literal("base"),
      v.literal("instruct"),
      v.literal("reasoning"),
      v.literal("coder"),
      v.literal("vision"),
      v.literal("embedding"),
      v.literal("reranker"),
      v.literal("other"),
    ),
    ...sourceFields,
  })
    .index("by_size", ["sizeId"])
    .index("by_size_slug", ["sizeId", "slug"])
    .index("by_slug", ["slug"]),

  artifacts: defineTable({
    variantId: v.id("modelVariants"),
    huggingFaceRepo: v.string(),
    format: v.string(),
    quantization: v.optional(v.string()),
    dtype: v.optional(v.string()),
    uploaderKind: v.union(
      v.literal("official"),
      v.literal("vendor"),
      v.literal("community"),
      v.literal("unknown"),
    ),
    runtimeSupport: v.array(v.string()),
    hardwareKinds: v.optional(v.array(v.string())),
    minVramGb: v.optional(v.number()),
    recommendedVramGb: v.optional(v.number()),
    vramEstimated: v.optional(v.boolean()),
    gated: v.optional(v.boolean()),
    available: v.boolean(),
    provenanceUrl: v.optional(v.string()),
    confidence: v.union(
      v.literal("verified"),
      v.literal("inferred"),
      v.literal("needs_review"),
    ),
    lastUpdatedAt: v.optional(v.number()),
    ...sourceFields,
  })
    .index("by_variant", ["variantId"])
    .index("by_repo", ["huggingFaceRepo"])
    .index("by_repo_variant", ["huggingFaceRepo", "variantId"]),

  deploymentRecipes: defineTable({
    provider: v.union(v.literal("vllm"), v.literal("sglang")),
    runtime: v.string(),
    upstreamId: v.string(),
    title: v.string(),
    publisher: v.string(),
    description: v.string(),
    recipeUrl: v.string(),
    sourceUrl: v.string(),
    sourceSha: v.string(),
    contentHash: v.string(),
    upstreamUpdatedAt: v.optional(v.number()),
    minimumRuntimeVersion: v.optional(v.string()),
    difficulty: v.optional(v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced"),
    )),
    tasks: v.array(v.string()),
    features: v.array(v.string()),
    hardware: v.array(v.object({
      id: v.string(),
      label: v.string(),
      status: v.union(v.literal("verified"), v.literal("documented")),
    })),
    variants: v.array(v.object({
      key: v.string(),
      modelId: v.string(),
      precision: v.string(),
      minimumVramGb: v.optional(v.number()),
      minimumRuntimeVersion: v.optional(v.string()),
      description: v.optional(v.string()),
    })),
    artifactRepos: v.array(v.string()),
    available: v.boolean(),
    lastSyncedAt: v.number(),
  })
    .index("by_provider_and_upstream_id", ["provider", "upstreamId"])
    .index("by_provider_and_available", ["provider", "available"]),

  deploymentRecipeSyncState: defineTable({
    provider: v.union(v.literal("vllm"), v.literal("sglang")),
    sourceRevision: v.optional(v.string()),
    recipeIds: v.array(v.string()),
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    inserted: v.number(),
    updated: v.number(),
    removed: v.number(),
    matchedEntries: v.number(),
  }).index("by_provider", ["provider"]),

  materialChanges: defineTable({
    dedupeKey: v.string(),
    modelSlug: v.string(),
    modelName: v.string(),
    type: v.union(
      v.literal("model_published"),
      v.literal("weights_updated"),
      v.literal("artifact_published"),
      v.literal("recipe_published"),
      v.literal("recipe_updated"),
      v.literal("runtime_support_added"),
      v.literal("license_or_access_changed"),
    ),
    occurredAt: v.number(),
    title: v.string(),
    summary: v.string(),
    sourceLabel: v.string(),
    sourceUrls: v.array(v.string()),
    reviewStatus: v.union(v.literal("automatic"), v.literal("reviewed")),
    createdAt: v.number(),
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_occurred_at", ["occurredAt"])
    .index("by_model_and_occurred_at", ["modelSlug", "occurredAt"]),

  runReports: defineTable({
    reportId: v.string(),
    modelSlug: v.string(),
    artifactRepo: v.string(),
    recipeUpstreamId: v.optional(v.string()),
    recipeSourceSha: v.optional(v.string()),
    hardwareProfile: v.string(),
    runtime: v.string(),
    runtimeVersion: v.string(),
    testedContextTokens: v.optional(v.number()),
    concurrency: v.optional(v.number()),
    peakMemoryGb: v.optional(v.number()),
    throughputTokensPerSecond: v.optional(v.number()),
    verificationStatus: v.union(v.literal("measured"), v.literal("reproduced")),
    testedAt: v.number(),
    notes: v.string(),
    evidenceUrl: v.optional(v.string()),
    published: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_report_id", ["reportId"])
    .index("by_model_and_published", ["modelSlug", "published"])
    .index("by_artifact_repo", ["artifactRepo"]),

  monitoredSources: defineTable({
    owner: v.string(),
    ownerKey: v.string(),
    displayName: v.string(),
    role: v.union(
      v.literal("creator"),
      v.literal("artifact_provider"),
      v.literal("creator_provider"),
    ),
    enabled: v.boolean(),
    familyIds: v.array(v.string()),
    includePatterns: v.optional(v.array(v.string())),
    excludePatterns: v.optional(v.array(v.string())),
    lastAuditAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    consecutiveFailures: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
  })
    .index("by_owner", ["owner"])
    .index("by_owner_key", ["ownerKey"])
    .index("by_enabled", ["enabled"]),

  sourceRepositories: defineTable({
    repoId: v.string(),
    repoName: v.string(),
    owner: v.string(),
    headSha: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    lastModifiedAt: v.optional(v.number()),
    weightManifestHash: v.optional(v.string()),
    weightsLastModifiedAt: v.optional(v.number()),
    weightCommitSha: v.optional(v.string()),
    weightBytes: v.optional(v.number()),
    private: v.boolean(),
    gated: v.boolean(),
    disabled: v.boolean(),
    pipelineTag: v.optional(v.string()),
    license: v.optional(v.string()),
    status: v.union(
      v.literal("published"),
      v.literal("skipped"),
      v.literal("missing"),
      v.literal("failed"),
    ),
    skipReason: v.optional(v.string()),
    missingCount: v.number(),
    lastSeenAt: v.number(),
    lastIngestedAt: v.optional(v.number()),
  })
    .index("by_repo_id", ["repoId"])
    .index("by_repo_name", ["repoName"])
    .index("by_owner", ["owner"]),

  webhookEvents: defineTable({
    dedupeKey: v.string(),
    repoId: v.string(),
    repoName: v.string(),
    owner: v.string(),
    scope: v.string(),
    action: v.string(),
    headSha: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("superseded"),
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("failed"),
    ),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    nextRetryAt: v.optional(v.number()),
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_repo_id_status", ["repoId", "status"])
    .index("by_repo_status", ["repoName", "status"])
    .index("by_received", ["receivedAt"])
    .index("by_status_and_received", ["status", "receivedAt"]),

  syncRuns: defineTable({
    kind: v.union(v.literal("webhook"), v.literal("audit")),
    sourceOwner: v.optional(v.string()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("degraded"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    discovered: v.number(),
    changed: v.number(),
    published: v.number(),
    skipped: v.number(),
    failed: v.number(),
    retries: v.number(),
    expectedSources: v.optional(v.number()),
    completedSources: v.optional(v.number()),
    sourceOwners: v.optional(v.array(v.string())),
    sourcePaceMs: v.optional(v.number()),
    message: v.optional(v.string()),
  })
    .index("by_kind_started", ["kind", "startedAt"])
    .index("by_status", ["status"])
    .index("by_status_and_kind", ["status", "kind"]),

  modelIntroductions: defineTable({
    slug: v.string(),
    heading: v.string(),
    summary: v.string(),
    paragraphs: v.array(v.string()),
    highlights: v.array(v.object({ label: v.string(), value: v.string() })),
    sourceLabel: v.string(),
    sourceUrl: v.string(),
    sourceSha: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  catalogEntries: defineTable({
    slug: v.string(),
    familyId: v.string(),
    releaseId: v.string(),
    sizeLabel: v.string(),
    sourceRepos: v.array(v.string()),
    updatedAt: v.number(),
    payload: publishedCatalogEntryValue,
    publishedAt: v.number(),
    sourceRevision: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_family", ["familyId"])
    .index("by_updated", ["updatedAt"]),

  catalogState: defineTable({
    key: v.string(),
    revision: v.string(),
    syncedAt: v.number(),
    lastWebhookAt: v.optional(v.number()),
    lastSuccessfulAuditAt: v.optional(v.number()),
    lastCompletedAuditAt: v.optional(v.number()),
    lastDegradedAuditAt: v.optional(v.number()),
    snapshotRefreshScheduledAt: v.optional(v.number()),
  }).index("by_key", ["key"]),

  catalogSnapshotChunks: defineTable({
    snapshotKey: v.string(),
    chunk: v.number(),
    entries: v.array(publishedCatalogSummaryValue),
  }).index("by_snapshot_and_chunk", ["snapshotKey", "chunk"]),

  catalogSnapshotState: defineTable({
    key: v.string(),
    revision: v.string(),
    syncedAt: v.number(),
  }).index("by_key", ["key"]),

  catalogHealthAlerts: defineTable({
    kind: v.union(
      v.literal("webhook_stale"),
      v.literal("catalog_degraded"),
      v.literal("catalog_stale"),
    ),
    active: v.boolean(),
    message: v.string(),
    firstDetectedAt: v.number(),
    lastCheckedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_kind", ["kind"])
    .index("by_active", ["active"]),
});
