import { artifactsFor, zeroDeltas, unknownDeltas } from "./fit";
import { modelDisplayName } from "./naming";
import type {
  Artifact,
  BenchCategory,
  BenchDef,
  BenchKey,
  CompareModel,
  Family,
  RigPreset,
} from "./types";

export const BENCHES: BenchDef[] = [
  { key: "mmlu", label: "MMLU-Pro", source: "lmarena", category: "general" },
  { key: "ifeval", label: "IFEval", source: "vendor card", category: "general" },
  { key: "gpqa", label: "GPQA-Diamond", source: "vendor card", category: "reasoning" },
  { key: "hle", label: "HLE", source: "scale leaderboard", category: "reasoning" },
  { key: "aime", label: "AIME 2026", source: "vendor card", category: "math" },
  { key: "math500", label: "MATH-500", source: "vendor card", category: "math" },
  { key: "lcb", label: "LiveCodeBench v7", source: "lcb leaderboard", category: "coding" },
  { key: "swe", label: "SWE-bench Verified", source: "swebench.com", category: "coding" },
];

export const BENCH_CATEGORIES: { id: BenchCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "reasoning", label: "Reasoning" },
  { id: "math", label: "Math" },
  { id: "coding", label: "Coding" },
];

/** One headline benchmark per category, shown when no category is picked. */
export const HEADLINE_BENCHES: BenchKey[] = ["mmlu", "gpqa", "aime", "lcb"];

export const RIG_PRESETS: RigPreset[] = [
  { id: "vram16", label: "16 GB", gb: 16, kind: "cuda" },
  { id: "vram24", label: "24 GB", gb: 24, kind: "cuda" },
  { id: "vram48", label: "48 GB", gb: 48, kind: "cuda" },
  { id: "vram80", label: "80 GB", gb: 80, kind: "cuda" },
  { id: "vram128", label: "128 GB", gb: 128, kind: "cuda" },
  { id: "vram256", label: "256 GB", gb: 256, kind: "cuda" },
];

export const DEFAULT_PRESET_ID = "vram48";

/** Hand-curated flagship path: Qwen 3.6 27B Instruct, measured deltas with provenance. */
const QWEN36_27B_INSTRUCT: Artifact[] = [
  {
    repo: "Qwen/Qwen3.6-27B-Instruct",
    format: "BF16",
    trust: "official",
    confidence: "verified",
    kinds: ["cuda", "dgx"],
    runtimes: ["vLLM", "SGLang", "Transformers"],
    minVramGb: 56,
    recVramGb: 64,
    deltas: zeroDeltas(),
    measured: true,
    qualityRank: 0,
  },
  {
    repo: "Qwen/Qwen3.6-27B-Instruct-FP8",
    format: "FP8",
    trust: "official",
    confidence: "verified",
    kinds: ["cuda", "dgx"],
    runtimes: ["vLLM", "SGLang"],
    minVramGb: 28,
    recVramGb: 32,
    deltas: { mmlu: -0.2, ifeval: -0.1, gpqa: -0.3, hle: -0.2, aime: -0.5, math500: -0.4, lcb: -0.2, swe: -0.3 },
    measured: true,
    qualityRank: 1,
  },
  {
    repo: "nvidia/Qwen3.6-27B-Instruct-NVFP4",
    format: "NVFP4",
    trust: "vendor",
    confidence: "verified",
    kinds: ["cuda", "dgx"],
    runtimes: ["TensorRT-LLM", "vLLM"],
    minVramGb: 18,
    recVramGb: 24,
    deltas: { mmlu: -0.7, ifeval: -0.5, gpqa: -1.1, hle: -0.6, aime: -1.9, math500: -1.4, lcb: -0.8, swe: -1.1 },
    measured: true,
    qualityRank: 2,
  },
];

function nvidiaArtifact(
  repo: string,
  format: string,
  minVramGb: number,
  recVramGb: number,
  runtimes: string[],
  kinds: Artifact["kinds"] = ["cuda", "dgx"],
): Artifact {
  const isReference = format === "BF16";
  const qualityRank = format === "BF16" ? 0 : format === "FP8" ? 1 : 2;

  return {
    repo,
    format,
    trust: "official",
    confidence: "verified",
    kinds,
    runtimes,
    minVramGb,
    recVramGb,
    deltas: isReference ? zeroDeltas() : unknownDeltas(),
    measured: isReference,
    qualityRank,
  };
}

const NEMOTRON3_4B: Artifact[] = [
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16",
    "BF16",
    9,
    12,
    ["vLLM", "TensorRT-LLM", "Transformers"],
  ),
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Nano-4B-FP8",
    "FP8",
    5,
    8,
    ["vLLM", "TensorRT-LLM"],
  ),
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF",
    "GGUF",
    3,
    5,
    ["llama.cpp", "Ollama", "LM Studio"],
    ["mac", "cpu", "cuda"],
  ),
];

const NEMOTRON3_NANO_30B: Artifact[] = [
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
    "BF16",
    66,
    72,
    ["vLLM", "TensorRT-LLM", "Transformers"],
  ),
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8",
    "FP8",
    34,
    40,
    ["vLLM", "TensorRT-LLM"],
  ),
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4",
    "NVFP4",
    20,
    24,
    ["vLLM", "TensorRT-LLM"],
  ),
];

const NEMOTRON3_SUPER_120B: Artifact[] = [
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16",
    "BF16",
    260,
    300,
    ["vLLM", "TensorRT-LLM"],
  ),
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-FP8",
    "FP8",
    132,
    160,
    ["vLLM", "TensorRT-LLM"],
  ),
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
    "NVFP4",
    72,
    80,
    ["vLLM", "TensorRT-LLM"],
  ),
];

const NEMOTRON3_ULTRA_550B: Artifact[] = [
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16",
    "BF16",
    1200,
    1400,
    ["vLLM", "TensorRT-LLM"],
  ),
  nvidiaArtifact(
    "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-NVFP4",
    "NVFP4",
    350,
    400,
    ["vLLM", "TensorRT-LLM"],
  ),
];

export const FAMILIES: Family[] = [
  {
    id: "qwen",
    name: "Qwen",
    vendor: "Alibaba",
    tags: "reasoning, coding, long context",
    releases: [
      {
        id: "q36",
        name: "Qwen 3.6",
        date: "May 2026",
        ctx: "262K",
        license: "Apache-2.0",
        sizes: [
          { label: "4B", paramsB: 4, variants: ["Instruct", "Base"] },
          {
            label: "9B",
            paramsB: 9,
            variants: ["Instruct", "Base"],
            scores: { Instruct: { mmlu: 68.2, ifeval: 81.2, gpqa: 47.9, hle: 7.4, aime: 49.4, math500: 87.1, lcb: 35.1, swe: 24.3 } },
          },
          {
            label: "27B",
            paramsB: 27,
            variants: ["Instruct", "Base", "Coder"],
            scores: { Instruct: { mmlu: 75.5, ifeval: 86.4, gpqa: 58.3, hle: 12.8, aime: 63.1, math500: 92.4, lcb: 44.3, swe: 38.6 } },
            curatedArtifacts: { Instruct: QWEN36_27B_INSTRUCT },
          },
          {
            label: "80B-A13B",
            paramsB: 80,
            variants: ["Instruct"],
            scores: { Instruct: { mmlu: 79.9, ifeval: 89.1, gpqa: 66.4, hle: 18.9, aime: 72.8, math500: 95.2, lcb: 52.6, swe: 49.8 } },
          },
          { label: "235B-A22B", paramsB: 235, variants: ["Instruct"] },
        ],
      },
      {
        id: "q35",
        name: "Qwen 3.5",
        date: "Nov 2025",
        ctx: "128K",
        license: "Apache-2.0",
        sizes: [
          { label: "7B", paramsB: 7, variants: ["Instruct", "Base"] },
          { label: "32B", paramsB: 32, variants: ["Instruct", "Base", "Coder"] },
          { label: "72B", paramsB: 72, variants: ["Instruct"] },
        ],
      },
      {
        id: "q3",
        name: "Qwen 3",
        date: "Apr 2025",
        ctx: "32K",
        license: "Apache-2.0",
        sizes: [
          { label: "0.6B", paramsB: 0.6, variants: ["Instruct", "Base"] },
          { label: "1.7B", paramsB: 1.7, variants: ["Instruct", "Base"] },
          { label: "4B", paramsB: 4, variants: ["Instruct", "Base"] },
          { label: "8B", paramsB: 8, variants: ["Instruct", "Base"] },
          { label: "14B", paramsB: 14, variants: ["Instruct", "Base"] },
          { label: "30B-A3B", paramsB: 30, variants: ["Instruct", "Base"] },
          { label: "32B", paramsB: 32, variants: ["Instruct"] },
          { label: "235B-A22B", paramsB: 235, variants: ["Instruct"] },
        ],
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    vendor: "DeepSeek AI",
    tags: "MoE reasoning, code",
    releases: [
      {
        id: "v33",
        name: "DeepSeek V3.3",
        date: "Mar 2026",
        ctx: "164K",
        license: "MIT",
        sizes: [
          {
            label: "671B-A37B",
            paramsB: 671,
            variants: ["Chat", "Reasoner"],
            scores: { Chat: { mmlu: 82.1, ifeval: 88.7, gpqa: 69.8, hle: 22.4, aime: 76.5, math500: 96.0, lcb: 57.2, swe: 55.4 } },
          },
        ],
      },
      {
        id: "r2l",
        name: "R2-Lite",
        date: "Jan 2026",
        ctx: "128K",
        license: "MIT",
        sizes: [
          {
            label: "16B",
            paramsB: 16,
            variants: ["Reasoner"],
            scores: { Reasoner: { mmlu: 70.4, ifeval: 79.8, gpqa: 55.2, hle: 14.6, aime: 66.0, math500: 93.3, lcb: 41.8, swe: 31.7 } },
          },
        ],
      },
      {
        id: "r1",
        name: "R1",
        date: "Jan 2025",
        ctx: "128K",
        license: "MIT",
        sizes: [
          { label: "671B-A37B", paramsB: 671, variants: ["Reasoner"] },
        ],
      },
      {
        id: "r1-distill",
        name: "R1 Distill",
        date: "Jan 2025",
        ctx: "128K",
        license: "MIT",
        sizes: [
          { label: "1.5B", paramsB: 1.5, variants: ["Qwen"] },
          { label: "7B", paramsB: 7, variants: ["Qwen"] },
          { label: "8B", paramsB: 8, variants: ["Llama"] },
          { label: "14B", paramsB: 14, variants: ["Qwen"] },
          { label: "32B", paramsB: 32, variants: ["Qwen"] },
          { label: "70B", paramsB: 70, variants: ["Llama"] },
        ],
      },
    ],
  },
  {
    id: "llama",
    name: "Llama",
    vendor: "Meta",
    tags: "general foundation models",
    releases: [
      {
        id: "l41",
        name: "Llama 4.1",
        date: "Feb 2026",
        ctx: "1M",
        license: "Llama Community",
        sizes: [
          {
            label: "Scout 109B-A17B",
            paramsB: 109,
            variants: ["Instruct"],
            scores: { Instruct: { mmlu: 71.3, ifeval: 84.9, gpqa: 53.7, hle: 9.2, aime: 44.2, math500: 84.6, lcb: 38.9, swe: 28.1 } },
          },
          { label: "Maverick 400B-A17B", paramsB: 400, variants: ["Instruct"] },
        ],
      },
      {
        id: "l33",
        name: "Llama 3.3",
        date: "Dec 2024",
        ctx: "128K",
        license: "Llama Community",
        sizes: [{ label: "70B", paramsB: 70, variants: ["Instruct"] }],
      },
      {
        id: "l32",
        name: "Llama 3.2",
        date: "Sep 2024",
        ctx: "128K",
        license: "Llama Community",
        sizes: [
          { label: "1B", paramsB: 1, variants: ["Instruct", "Base"] },
          { label: "3B", paramsB: 3, variants: ["Instruct", "Base"] },
        ],
      },
    ],
  },
  {
    id: "gemma",
    name: "Gemma",
    vendor: "Google",
    tags: "efficient open models",
    releases: [
      {
        id: "g35",
        name: "Gemma 3.5",
        date: "Apr 2026",
        ctx: "128K",
        license: "Gemma Terms",
        sizes: [
          { label: "4B", paramsB: 4, variants: ["IT", "PT"] },
          { label: "12B", paramsB: 12, variants: ["IT", "PT"] },
          {
            label: "27B",
            paramsB: 27,
            variants: ["IT", "PT"],
            scores: { IT: { mmlu: 72.6, ifeval: 85.6, gpqa: 52.4, hle: 10.7, aime: 47.5, math500: 88.9, lcb: 37.4, swe: 30.5 } },
          },
        ],
      },
      {
        id: "g3",
        name: "Gemma 3",
        date: "Mar 2025",
        ctx: "128K",
        license: "Gemma Terms",
        sizes: [
          { label: "1B", paramsB: 1, variants: ["IT", "PT"] },
          { label: "4B", paramsB: 4, variants: ["IT", "PT"] },
          { label: "12B", paramsB: 12, variants: ["IT", "PT"] },
          { label: "27B", paramsB: 27, variants: ["IT", "PT"] },
        ],
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    vendor: "Mistral AI",
    tags: "European open weights",
    releases: [
      {
        id: "ms33",
        name: "Mistral Small 3.3",
        date: "Jun 2026",
        ctx: "128K",
        license: "Apache-2.0",
        sizes: [
          {
            label: "24B",
            paramsB: 24,
            variants: ["Instruct", "Base"],
            scores: { Instruct: { mmlu: 70.9, ifeval: 83.2, gpqa: 50.1, hle: 8.8, aime: 41.7, math500: 85.7, lcb: 36.6, swe: 26.9 } },
          },
        ],
      },
      {
        id: "ms31",
        name: "Mistral Small 3.1",
        date: "Mar 2025",
        ctx: "128K",
        license: "Apache-2.0",
        sizes: [
          { label: "24B", paramsB: 24, variants: ["Instruct", "Base"] },
        ],
      },
    ],
  },
  {
    id: "nemotron",
    name: "Nemotron",
    vendor: "NVIDIA",
    tags: "reasoning, agentic, inference optimized",
    releases: [
      {
        id: "n3",
        name: "Nemotron 3",
        date: "2025–2026",
        ctx: "Varies",
        license: "NVIDIA Open Model",
        sizes: [
          {
            label: "Nano 4B",
            paramsB: 4,
            variants: ["Instruct"],
            curatedArtifacts: { Instruct: NEMOTRON3_4B },
          },
          {
            label: "Nano 30B-A3B",
            paramsB: 30,
            variants: ["Instruct"],
            curatedArtifacts: { Instruct: NEMOTRON3_NANO_30B },
          },
          {
            label: "Super 120B-A12B",
            paramsB: 120,
            variants: ["Instruct"],
            curatedArtifacts: { Instruct: NEMOTRON3_SUPER_120B },
          },
          {
            label: "Ultra 550B-A55B",
            paramsB: 550,
            variants: ["Instruct"],
            curatedArtifacts: { Instruct: NEMOTRON3_ULTRA_550B },
          },
        ],
      },
    ],
  },
];

/** Every size+variant with sourced reference scores appears in the Compare tab. */
export const COMPARE_MODELS: CompareModel[] = FAMILIES.flatMap((family) =>
  family.releases.flatMap((release) =>
    release.sizes.flatMap((size) =>
      size.variants.flatMap((variant) => {
        const scores = size.scores?.[variant];
        if (!scores) return [];
        return [
          {
            id: `${family.id}-${release.id}-${size.label}-${variant}`,
            name: modelDisplayName(family, release, size),
            family,
            release,
            size,
            variant,
            scores,
            artifacts: artifactsFor(family, release, size, variant),
          },
        ];
      }),
    ),
  ),
);
