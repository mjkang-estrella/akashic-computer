import { v } from "convex/values";

export const benchKeyValue = v.union(
  v.literal("mmlu"),
  v.literal("ifeval"),
  v.literal("gpqa"),
  v.literal("hle"),
  v.literal("aime"),
  v.literal("math500"),
  v.literal("lcb"),
  v.literal("swe"),
);

export const modelCategoryValue = v.union(
  v.literal("language"),
  v.literal("vision-documents"),
  v.literal("image-generation"),
  v.literal("video-generation"),
  v.literal("audio-speech"),
  v.literal("retrieval"),
  v.literal("3d-spatial"),
  v.literal("world-models"),
  v.literal("robotics"),
);

export const modelCapabilityValue = v.union(
  v.literal("general"),
  v.literal("reasoning"),
  v.literal("coding"),
  v.literal("mathematics"),
  v.literal("science"),
  v.literal("agentic"),
  v.literal("long-context"),
  v.literal("multilingual"),
  v.literal("ocr"),
  v.literal("image-understanding"),
  v.literal("video-understanding"),
  v.literal("document-qa"),
  v.literal("image-generation"),
  v.literal("image-editing"),
  v.literal("video-generation"),
  v.literal("speech-recognition"),
  v.literal("text-to-speech"),
  v.literal("music"),
  v.literal("embedding"),
  v.literal("reranking"),
  v.literal("3d-generation"),
  v.literal("robot-control"),
  v.literal("world-modeling"),
);

const benchmarkDeltasValue = v.object({
  mmlu: v.union(v.number(), v.null()),
  ifeval: v.union(v.number(), v.null()),
  gpqa: v.union(v.number(), v.null()),
  hle: v.union(v.number(), v.null()),
  aime: v.union(v.number(), v.null()),
  math500: v.union(v.number(), v.null()),
  lcb: v.union(v.number(), v.null()),
  swe: v.union(v.number(), v.null()),
});

const benchmarkScoresValue = v.object({
  mmlu: v.number(),
  ifeval: v.number(),
  gpqa: v.number(),
  hle: v.number(),
  aime: v.number(),
  math500: v.number(),
  lcb: v.number(),
  swe: v.number(),
});

const benchmarkReferenceValue = v.object({
  name: v.string(),
  result: v.string(),
  sourceUrl: v.string(),
  sourceLabel: v.string(),
  measuredAt: v.optional(v.string()),
});

const vramEstimateValue = v.object({
  weightGb: v.number(),
  kvCacheGb: v.number(),
  kvCacheDtype: v.literal("BF16"),
  contextTokens: v.number(),
  concurrency: v.literal(1),
  cacheMethod: v.union(v.literal("standard"), v.literal("mla")),
});

const ingestionRepoValue = v.object({
  id: v.string(),
  author: v.string(),
  sha: v.string(),
  createdAt: v.union(v.string(), v.null()),
  lastModified: v.union(v.string(), v.null()),
  weightManifestHash: v.union(v.string(), v.null()),
  weightsLastModified: v.union(v.string(), v.null()),
  weightCommitSha: v.union(v.string(), v.null()),
  weightBytes: v.union(v.number(), v.null()),
  private: v.boolean(),
  gated: v.boolean(),
  disabled: v.boolean(),
  pipelineTag: v.union(v.string(), v.null()),
  license: v.union(v.string(), v.null()),
  baseModels: v.array(v.string()),
  safetensorsParameters: v.union(v.number(), v.null()),
});

const parsedIngestionRepoValue = v.object({
  repo: ingestionRepoValue,
  format: v.string(),
  modelStem: v.string(),
  sizeLabel: v.union(v.string(), v.null()),
  paramsB: v.union(v.number(), v.null()),
  activeParamsB: v.union(v.number(), v.null()),
  isMoe: v.boolean(),
  variant: v.string(),
  category: v.union(modelCategoryValue, v.null()),
  capabilities: v.array(modelCapabilityValue),
  minVramGb: v.union(v.number(), v.null()),
  recVramGb: v.union(v.number(), v.null()),
  vramEstimate: v.union(vramEstimateValue, v.null()),
  kinds: v.array(v.union(v.literal("mac"), v.literal("cpu"), v.literal("cuda"), v.literal("dgx"))),
  runtimes: v.array(v.string()),
  benchmarkRows: v.array(v.object({
    name: v.string(),
    result: v.string(),
    sourceLabel: v.string(),
    sourceUrl: v.string(),
  })),
  contextLabel: v.string(),
  contextTokens: v.union(v.number(), v.null()),
});

export const ingestionClassificationValue = v.union(
  v.object({ status: v.literal("publishable"), parsed: parsedIngestionRepoValue }),
  v.object({ status: v.literal("skipped"), reason: v.string(), repo: ingestionRepoValue }),
);

export const publishedArtifactValue = v.object({
  repo: v.string(),
  format: v.string(),
  trust: v.union(v.literal("official"), v.literal("vendor"), v.literal("community")),
  confidence: v.union(v.literal("verified"), v.literal("inferred"), v.literal("needs_review")),
  kinds: v.array(v.union(v.literal("mac"), v.literal("cpu"), v.literal("cuda"), v.literal("dgx"))),
  runtimes: v.array(v.string()),
  minVramGb: v.number(),
  recVramGb: v.number(),
  vramEstimate: v.optional(vramEstimateValue),
  deltas: benchmarkDeltasValue,
  measured: v.boolean(),
  qualityRank: v.number(),
  variant: v.string(),
  gated: v.optional(v.boolean()),
  vramEstimated: v.optional(v.boolean()),
  lastUpdatedAt: v.optional(v.number()),
});

export const publishedArtifactSummaryValue = v.object({
  repo: v.string(),
  format: v.string(),
  variant: v.string(),
  runtimes: v.array(v.string()),
  recVramGb: v.number(),
});

const familyIdentityFields = {
  id: v.string(),
  name: v.string(),
  vendor: v.string(),
  tags: v.string(),
  category: v.optional(modelCategoryValue),
  capabilities: v.optional(v.array(modelCapabilityValue)),
};

const releaseIdentityFields = {
  id: v.string(),
  name: v.string(),
  date: v.string(),
  ctx: v.string(),
  license: v.string(),
  category: v.optional(modelCategoryValue),
  capabilities: v.optional(v.array(modelCapabilityValue)),
};

const sizeFields = {
  label: v.string(),
  paramsB: v.number(),
  activeParamsB: v.optional(v.number()),
  isMoe: v.optional(v.boolean()),
  variants: v.array(v.string()),
  context: v.optional(v.string()),
  updated: v.optional(v.string()),
  category: v.optional(modelCategoryValue),
  capabilities: v.optional(v.array(modelCapabilityValue)),
};

const summaryFields = {
  id: v.string(),
  slug: v.string(),
  family: v.object(familyIdentityFields),
  release: v.object(releaseIdentityFields),
  size: v.object(sizeFields),
  name: v.string(),
  effectiveDate: v.string(),
  dateLabel: v.string(),
  updated: v.boolean(),
  timestamp: v.number(),
  context: v.string(),
  artifacts: v.array(publishedArtifactSummaryValue),
  quantizations: v.array(v.string()),
  providers: v.array(v.string()),
  category: modelCategoryValue,
  capabilities: v.array(modelCapabilityValue),
};

export const publishedCatalogSummaryValue = v.object(summaryFields);

const recipeHardwareValue = v.object({ id: v.string(), label: v.string() });
const recipeVariantValue = v.object({
  key: v.string(),
  modelId: v.string(),
  precision: v.string(),
  minimumVramGb: v.optional(v.number()),
  minimumVllmVersion: v.optional(v.string()),
  description: v.optional(v.string()),
});

const recipeReferenceFields = {
  provider: v.literal("vllm"),
  upstreamId: v.string(),
  title: v.string(),
  publisher: v.string(),
  description: v.string(),
  recipeUrl: v.string(),
  sourceUrl: v.string(),
  sourceSha: v.string(),
  upstreamUpdatedAt: v.optional(v.number()),
  minimumVllmVersion: v.optional(v.string()),
  difficulty: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
  tasks: v.array(v.string()),
  features: v.array(v.string()),
  verifiedHardware: v.array(recipeHardwareValue),
  variants: v.array(recipeVariantValue),
  artifactRepos: v.array(v.string()),
};
export const recipeReferenceValue = v.object(recipeReferenceFields);
export const parsedRecipeReferenceValue = v.object({
  ...recipeReferenceFields,
  contentHash: v.string(),
});

const materialChangeValue = v.object({
  id: v.string(),
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
  dateLabel: v.string(),
  title: v.string(),
  summary: v.string(),
  sourceLabel: v.string(),
  sourceUrls: v.array(v.string()),
  reviewStatus: v.union(v.literal("automatic"), v.literal("reviewed")),
});

export const modelIntroductionValue = v.object({
  heading: v.string(),
  summary: v.string(),
  paragraphs: v.array(v.string()),
  highlights: v.array(v.object({ label: v.string(), value: v.string() })),
  sourceLabel: v.string(),
  sourceUrl: v.string(),
  sourceSha: v.optional(v.string()),
});

const runReportValue = v.object({
  id: v.string(),
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
});

export const publishedCatalogEntryValue = v.object({
  ...summaryFields,
  artifacts: v.array(publishedArtifactValue),
  release: v.object({
    ...releaseIdentityFields,
    benchmarkRefs: v.optional(v.array(benchmarkReferenceValue)),
  }),
  size: v.object({
    ...sizeFields,
    scores: v.optional(v.record(v.string(), benchmarkScoresValue)),
    benchmarkRefs: v.optional(v.array(benchmarkReferenceValue)),
  }),
  benchmarkRefs: v.array(benchmarkReferenceValue),
  introduction: v.optional(modelIntroductionValue),
  recipeReferences: v.optional(v.array(recipeReferenceValue)),
  materialChanges: v.optional(v.array(materialChangeValue)),
  runReports: v.optional(v.array(runReportValue)),
});

export const publishedCatalogListValue = v.object({
  entries: v.array(publishedCatalogSummaryValue),
  syncedAt: v.number(),
  revision: v.string(),
});
