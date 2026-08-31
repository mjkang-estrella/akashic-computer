import type {
  BenchDef,
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

export const RIG_PRESETS: RigPreset[] = [
  { id: "vram16", label: "16 GB", gb: 16, kind: "cuda" },
  { id: "vram24", label: "24 GB", gb: 24, kind: "cuda" },
  { id: "vram48", label: "48 GB", gb: 48, kind: "cuda" },
  { id: "vram80", label: "80 GB", gb: 80, kind: "cuda" },
  { id: "vram128", label: "128 GB", gb: 128, kind: "cuda" },
  { id: "vram256", label: "256 GB", gb: 256, kind: "cuda" },
  { id: "vram384", label: "384 GB", gb: 384, kind: "cuda" },
];

export const DEFAULT_PRESET_ID = "vram384";
