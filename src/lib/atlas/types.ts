export type BenchKey =
  | "mmlu"
  | "ifeval"
  | "gpqa"
  | "hle"
  | "aime"
  | "math500"
  | "lcb"
  | "swe";

export type BenchCategory = "general" | "reasoning" | "math" | "coding";

export interface BenchDef {
  key: BenchKey;
  label: string;
  source: string;
  category: BenchCategory;
}

export type Trust = "official" | "vendor" | "community";
export type Confidence = "verified" | "inferred" | "needs_review";
export type HardwareKind = "mac" | "cpu" | "cuda" | "dgx";

export interface VramEstimateDetails {
  weightGb: number;
  kvCacheGb: number;
  kvCacheDtype: "BF16";
  contextTokens: number;
  concurrency: 1;
  cacheMethod: "standard" | "mla";
}

export type ModelCategoryId =
  | "language"
  | "vision-documents"
  | "image-generation"
  | "video-generation"
  | "audio-speech"
  | "retrieval"
  | "3d-spatial"
  | "world-models"
  | "robotics";

export type ModelCapabilityId =
  | "general"
  | "reasoning"
  | "coding"
  | "mathematics"
  | "science"
  | "agentic"
  | "long-context"
  | "multilingual"
  | "ocr"
  | "image-understanding"
  | "video-understanding"
  | "document-qa"
  | "image-generation"
  | "image-editing"
  | "video-generation"
  | "speech-recognition"
  | "text-to-speech"
  | "music"
  | "embedding"
  | "reranking"
  | "3d-generation"
  | "robot-control"
  | "world-modeling";

export interface BenchmarkReference {
  name: string;
  result: string;
  sourceUrl: string;
  sourceLabel: string;
  measuredAt?: string;
}

export interface Artifact {
  repo: string;
  format: string;
  trust: Trust;
  confidence: Confidence;
  kinds: HardwareKind[];
  runtimes: string[];
  minVramGb: number;
  recVramGb: number;
  vramEstimate?: VramEstimateDetails;
  /** Benchmark delta vs the BF16 reference; null = no data. */
  deltas: Record<BenchKey, number | null>;
  /** True when deltas come from a measured source, false when estimated. */
  measured: boolean;
  /** Lower = closer to reference quality; retained for factual artifact ordering. */
  qualityRank: number;
}

export interface SizeNode {
  label: string;
  paramsB: number;
  activeParamsB?: number;
  isMoe?: boolean;
  variants: string[];
  /** Maximum supported context when sizes in one release differ. */
  context?: string;
  /** Most recent material update to this specific model size. */
  updated?: string;
  /** Reference (BF16) scores keyed by variant, only when a real source exists. */
  scores?: Record<string, Record<BenchKey, number>>;
  /** Hand-curated artifact lists keyed by variant; others are generated. */
  curatedArtifacts?: Record<string, Artifact[]>;
  category?: ModelCategoryId;
  capabilities?: ModelCapabilityId[];
  benchmarkRefs?: BenchmarkReference[];
}

export interface Release {
  id: string;
  name: string;
  date: string;
  ctx: string;
  license: string;
  sizes: SizeNode[];
  category?: ModelCategoryId;
  capabilities?: ModelCapabilityId[];
  benchmarkRefs?: BenchmarkReference[];
}

export interface Family {
  id: string;
  name: string;
  vendor: string;
  tags: string;
  releases: Release[];
  category?: ModelCategoryId;
  capabilities?: ModelCapabilityId[];
}

export interface RigPreset {
  id: string;
  label: string;
  gb: number;
  kind: HardwareKind;
}

export interface RigProfile {
  gb: number;
  kind: HardwareKind;
  label: string;
  manual: boolean;
}

export type FitLevel = "runs" | "tight" | "no";

export type MaterialChangeType =
  | "model_published"
  | "weights_updated"
  | "artifact_published"
  | "recipe_published"
  | "recipe_updated"
  | "runtime_support_added"
  | "license_or_access_changed";

export interface MaterialChange {
  id: string;
  modelSlug: string;
  modelName: string;
  type: MaterialChangeType;
  occurredAt: number;
  dateLabel: string;
  title: string;
  summary: string;
  sourceLabel: string;
  sourceUrls: string[];
  reviewStatus: "automatic" | "reviewed";
}

export interface RecipeHardware {
  id: string;
  label: string;
}

export interface RecipeVariant {
  key: string;
  modelId: string;
  precision: string;
  minimumVramGb?: number;
  minimumVllmVersion?: string;
  description?: string;
}

export interface RecipeReference {
  provider: "vllm";
  upstreamId: string;
  title: string;
  publisher: string;
  description: string;
  recipeUrl: string;
  sourceUrl: string;
  sourceSha: string;
  upstreamUpdatedAt?: number;
  minimumVllmVersion?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  tasks: string[];
  features: string[];
  verifiedHardware: RecipeHardware[];
  variants: RecipeVariant[];
  artifactRepos: string[];
}

export interface ModelIntroduction {
  heading: string;
  summary: string;
  paragraphs: string[];
  highlights: Array<{ label: string; value: string }>;
  sourceLabel: string;
  sourceUrl: string;
  sourceSha?: string;
}

export interface RunReport {
  id: string;
  modelSlug: string;
  artifactRepo: string;
  recipeUpstreamId?: string;
  recipeSourceSha?: string;
  hardwareProfile: string;
  runtime: string;
  runtimeVersion: string;
  testedContextTokens?: number;
  concurrency?: number;
  peakMemoryGb?: number;
  throughputTokensPerSecond?: number;
  verificationStatus: "measured" | "reproduced";
  testedAt: number;
  notes: string;
  evidenceUrl?: string;
}

export interface FitVerdict {
  level: FitLevel;
  text: string;
}

export interface CompareModel {
  id: string;
  name: string;
  family: Family;
  release: Release;
  size: SizeNode;
  variant: string;
  scores: Record<BenchKey, number>;
  artifacts: Artifact[];
}
