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
