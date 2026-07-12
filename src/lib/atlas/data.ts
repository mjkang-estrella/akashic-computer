import { FAMILIES } from "./catalog";
import { artifactsFor } from "./fit";
import { modelDisplayName } from "./naming";
import type {
  BenchCategory,
  BenchDef,
  BenchKey,
  CompareModel,
  RigPreset,
} from "./types";

export { FAMILIES } from "./catalog";

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
