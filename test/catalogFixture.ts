import type { ModelEntry, ModelArtifact } from "../src/lib/atlas/models";
import type { Artifact, Family, Release, SizeNode } from "../src/lib/atlas/types";

const deltas: Artifact["deltas"] = {
  mmlu: null,
  ifeval: null,
  gpqa: null,
  hle: null,
  aime: null,
  math500: null,
  lcb: null,
  swe: null,
};

export function artifact(repo: string, format = "BF16", variant = "Instruct"): ModelArtifact {
  return {
    repo,
    format,
    variant,
    trust: "official",
    confidence: "verified",
    kinds: ["cuda", "dgx"],
    runtimes: ["vLLM"],
    minVramGb: format === "BF16" ? 18 : 6,
    recVramGb: format === "BF16" ? 22 : 8,
    deltas,
    measured: false,
    qualityRank: format === "BF16" ? 0 : 1,
    vramEstimated: true,
  };
}

export function modelEntry(options: {
  slug: string;
  repo: string;
  familyId?: string;
  familyName?: string;
  vendor?: string;
  releaseId?: string;
  releaseName?: string;
  sizeLabel?: string;
  paramsB?: number;
  artifacts?: ModelArtifact[];
  variants?: string[];
}): ModelEntry {
  const family: Family = {
    id: options.familyId ?? "qwen",
    name: options.familyName ?? "Qwen",
    vendor: options.vendor ?? "Alibaba",
    tags: "reasoning, coding",
    releases: [],
  };
  const size: SizeNode = {
    label: options.sizeLabel ?? "8B",
    paramsB: options.paramsB ?? 8,
    variants: options.variants ?? ["Instruct"],
  };
  const release: Release = {
    id: options.releaseId ?? "qwen3",
    name: options.releaseName ?? "Qwen 3",
    date: "2026-01-01",
    ctx: "32K",
    license: "Apache-2.0",
    sizes: [size],
  };
  family.releases = [release];
  const artifacts = options.artifacts ?? [artifact(options.repo)];
  return {
    id: options.slug,
    slug: options.slug,
    family,
    release,
    size,
    name: `${release.name} ${size.label}`,
    effectiveDate: "2026-01-01",
    dateLabel: "2026-01-01",
    updated: false,
    timestamp: Date.parse("2026-01-01T00:00:00Z"),
    context: "32K",
    artifacts,
    quantizations: [...new Set(artifacts.map((item) => item.format))],
    providers: [...new Set(artifacts.map((item) => item.repo.split("/")[0]))],
    category: "language",
    capabilities: ["general", "reasoning"],
    benchmarkRefs: [],
    deploymentRecipes: [],
    materialChanges: [],
    runReports: [],
  };
}

export const QWEN_ENTRY = modelEntry({
  slug: "qwen-qwen3-8b",
  repo: "Qwen/Qwen3-8B",
  artifacts: [
    artifact("Qwen/Qwen3-8B"),
    artifact("nvidia/Qwen3-8B-NVFP4", "NVFP4"),
  ],
});

export const MINIMAX_H3_ENTRY = modelEntry({
  slug: "minimax-h3-33b",
  repo: "MiniMaxAI/MiniMax-H3",
  familyId: "minimax",
  familyName: "MiniMax",
  vendor: "MiniMax",
  releaseId: "h3",
  releaseName: "MiniMax H3",
  sizeLabel: "33B",
  paramsB: 33,
  variants: ["FL2VA", "Ref2VA"],
  artifacts: [
    artifact("MiniMaxAI/MiniMax-H3", "BF16", "FL2VA"),
    artifact("MiniMaxAI/MiniMax-H3", "BF16", "Ref2VA"),
  ],
});

export const CATALOG_FIXTURES = [
  QWEN_ENTRY,
  MINIMAX_H3_ENTRY,
  modelEntry({ slug: "deepseek-r1-70b", repo: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B", familyId: "deepseek", familyName: "DeepSeek", vendor: "DeepSeek AI", releaseId: "r1", releaseName: "DeepSeek R1", sizeLabel: "70B", paramsB: 70 }),
];
