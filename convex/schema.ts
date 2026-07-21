import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    .index("by_slug", ["slug"]),

  artifacts: defineTable({
    variantId: v.id("modelVariants"),
    huggingFaceRepo: v.string(),
    aliases: v.optional(v.array(v.string())),
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
    .index("by_repo", ["huggingFaceRepo"]),

  modelBenchmarks: defineTable({
    variantId: v.id("modelVariants"),
    benchmarkName: v.string(),
    result: v.string(),
    sourceLabel: v.string(),
    sourceUrl: v.string(),
    sourceRepo: v.optional(v.string()),
    sourceSha: v.optional(v.string()),
    measuredAt: v.optional(v.number()),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_variant", ["variantId"])
    .index("by_benchmark", ["benchmarkName"]),

  monitoredSources: defineTable({
    owner: v.string(),
    ownerKey: v.optional(v.string()),
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
  })
    .index("by_owner", ["owner"])
    .index("by_owner_key", ["ownerKey"]),

  sourceRepositories: defineTable({
    repoId: v.string(),
    repoName: v.string(),
    owner: v.string(),
    aliases: v.array(v.string()),
    headSha: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    lastModifiedAt: v.optional(v.number()),
    private: v.boolean(),
    gated: v.boolean(),
    disabled: v.boolean(),
    pipelineTag: v.optional(v.string()),
    tags: v.array(v.string()),
    license: v.optional(v.string()),
    files: v.array(v.string()),
    baseModels: v.array(v.string()),
    cardData: v.optional(v.any()),
    config: v.optional(v.any()),
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
    payload: v.any(),
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
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_repo_id_status", ["repoId", "status"])
    .index("by_repo_status", ["repoName", "status"])
    .index("by_received", ["receivedAt"]),

  syncRuns: defineTable({
    kind: v.union(v.literal("webhook"), v.literal("audit"), v.literal("seed")),
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
    .index("by_status", ["status"]),

  catalogOverrides: defineTable({
    entityType: v.union(
      v.literal("family"),
      v.literal("release"),
      v.literal("size"),
      v.literal("variant"),
      v.literal("artifact"),
      v.literal("catalog_entry"),
    ),
    entityKey: v.string(),
    patch: v.any(),
    reason: v.string(),
    updatedAt: v.number(),
  }).index("by_entity", ["entityType", "entityKey"]),

  catalogEntries: defineTable({
    slug: v.string(),
    familyId: v.string(),
    releaseId: v.string(),
    sizeLabel: v.string(),
    sourceRepos: v.array(v.string()),
    updatedAt: v.number(),
    payload: v.any(),
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
  }).index("by_key", ["key"]),

  catalogHealthAlerts: defineTable({
    kind: v.union(v.literal("webhook_stale"), v.literal("catalog_stale")),
    active: v.boolean(),
    message: v.string(),
    firstDetectedAt: v.number(),
    lastCheckedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_kind", ["kind"]),
});
