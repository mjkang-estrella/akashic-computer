import type {
  BenchDef,
  ContextChoice,
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

export const RIG_PRESETS: RigPreset[] = [8, 12, 16, 24, 32, 48, 80, 128, 256, 384].map((gb) => ({
  id: `vram${gb}`, label: `${gb} GB`, gb, kind: "generic" as const,
}));

/** Apple's default GPU allocation limit is roughly two thirds of unified memory up to 36 GB, three quarters above. */
function macPreset(unifiedGb: number): RigPreset {
  const gb = Math.floor(unifiedGb * (unifiedGb <= 36 ? 2 / 3 : 3 / 4));
  return {
    id: `mac${unifiedGb}`, label: `Mac · ${unifiedGb} GB unified`, gb, kind: "mac", group: "Apple silicon",
    detail: `About ${gb} GB of ${unifiedGb} GB is GPU-addressable by default (approximate macOS limit; raise it with sysctl iogpu.wired_limit_mb).`,
  };
}

/**
 * Named hardware translates a device into a memory budget. Budgets describe memory only;
 * they do not establish runtime support, bandwidth or multi-device topology.
 */
export const HARDWARE_PRESETS: RigPreset[] = [
  { id: "rtx3060", label: "RTX 3060 · 12 GB", gb: 12, kind: "cuda", group: "NVIDIA GeForce", detail: "12 GB VRAM on one GPU." },
  { id: "rtx4070", label: "RTX 4070 / 5070 · 12 GB", gb: 12, kind: "cuda", group: "NVIDIA GeForce", detail: "12 GB VRAM on one GPU." },
  { id: "rtx4060ti16", label: "RTX 4060 Ti / 5060 Ti · 16 GB", gb: 16, kind: "cuda", group: "NVIDIA GeForce", detail: "16 GB VRAM on one GPU (16 GB models only)." },
  { id: "rtx4080", label: "RTX 4080 / 5080 · 16 GB", gb: 16, kind: "cuda", group: "NVIDIA GeForce", detail: "16 GB VRAM on one GPU." },
  { id: "rtx4090", label: "RTX 3090 / 4090 · 24 GB", gb: 24, kind: "cuda", group: "NVIDIA GeForce", detail: "24 GB VRAM on one GPU." },
  { id: "rtx5090", label: "RTX 5090 · 32 GB", gb: 32, kind: "cuda", group: "NVIDIA GeForce", detail: "32 GB VRAM on one GPU." },
  { id: "rtx4090x2", label: "2× RTX 3090 / 4090 · 48 GB", gb: 48, kind: "cuda", group: "NVIDIA GeForce", detail: "48 GB across two GPUs; the model must be split across devices." },
  { id: "rtxpro6000", label: "RTX PRO 6000 Blackwell · 96 GB", gb: 96, kind: "cuda", group: "NVIDIA workstation and data center", detail: "96 GB VRAM on one GPU." },
  { id: "h100", label: "H100 · 80 GB", gb: 80, kind: "dgx", group: "NVIDIA workstation and data center", detail: "80 GB HBM on one GPU." },
  { id: "h200", label: "H200 · 141 GB", gb: 141, kind: "dgx", group: "NVIDIA workstation and data center", detail: "141 GB HBM on one GPU." },
  { id: "h100x8", label: "8× H100 · 640 GB", gb: 640, kind: "dgx", group: "NVIDIA workstation and data center", detail: "640 GB across eight GPUs; the model must be split across devices." },
  { id: "spark", label: "DGX Spark · 128 GB unified", gb: 128, kind: "dgx", group: "Unified-memory systems", detail: "128 GB shared by CPU and GPU; the operating system uses part of it." },
  { id: "strixhalo128", label: "Ryzen AI Max+ 395 · 128 GB unified", gb: 128, kind: "generic", group: "Unified-memory systems", detail: "128 GB shared by CPU and GPU (e.g. Framework Desktop). The GPU share is set in firmware or by the OS." },
  ...[16, 24, 32, 36, 48, 64, 96, 128, 192, 256, 512].map(macPreset),
];

/** New sessions start without a budget, so fit never decides which models appear relevant. */
export const DEFAULT_PRESET_ID: string | null = null;

export const CONTEXT_CHOICES: Array<{ value: ContextChoice; label: string }> = [
  { value: 8192, label: "8K" },
  { value: 32768, label: "32K" },
  { value: 131072, label: "128K" },
  { value: "native", label: "Native" },
];

export const DEFAULT_CONTEXT: ContextChoice = 32768;
