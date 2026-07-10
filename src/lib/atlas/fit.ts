import type {
  Artifact,
  Family,
  FitVerdict,
  Release,
  RigPreset,
  RigProfile,
  SizeNode,
} from "./types";

export function resolveProfile(
  presets: RigPreset[],
  presetId: string,
  manualGb: number | null,
): RigProfile {
  if (manualGb && manualGb > 0) {
    return { gb: manualGb, kind: "cuda", label: `${manualGb} GB VRAM`, manual: true };
  }
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  return { gb: preset.gb, kind: preset.kind, label: preset.label, manual: false };
}

export function fitOf(artifact: Artifact, rig: RigProfile): FitVerdict {
  if (rig.gb >= artifact.recVramGb) {
    return { level: "runs", text: `Fits within ${rig.gb} GB` };
  }
  if (rig.gb >= artifact.minVramGb) {
    return { level: "tight", text: `May fit within ${rig.gb} GB` };
  }
  return { level: "no", text: `Needs ${artifact.minVramGb}+ GB` };
}

export function zeroDeltas(): Artifact["deltas"] {
  return { mmlu: 0, ifeval: 0, gpqa: 0, hle: 0, aime: 0, math500: 0, lcb: 0, swe: 0 };
}

export function estimatedDeltas(base: number): Artifact["deltas"] {
  return {
    mmlu: base,
    ifeval: base + 0.2,
    gpqa: base - 0.5,
    hle: base - 0.3,
    aime: base - 1.3,
    math500: base - 1.0,
    lcb: base - 0.2,
    swe: base - 0.9,
  };
}

export function unknownDeltas(): Artifact["deltas"] {
  return {
    mmlu: null,
    ifeval: null,
    gpqa: null,
    hle: null,
    aime: null,
    math500: null,
    lcb: null,
    swe: null,
  };
}

/** Generated artifact set for sizes without a curated list. Estimates are marked inferred. */
export function generatedArtifacts(org: string, model: string, paramsB: number): Artifact[] {
  const r = Math.round;
  return [
    {
      repo: `${org}/${model}`,
      format: "BF16",
      trust: "official",
      confidence: "verified",
      kinds: ["cuda", "dgx"],
      runtimes: ["vLLM", "SGLang", "Transformers"],
      minVramGb: r(paramsB * 2.2),
      recVramGb: r(paramsB * 2.5),
      deltas: zeroDeltas(),
      measured: true,
      qualityRank: 0,
    },
    {
      repo: `cpatonn/${model}-AWQ-4bit`,
      format: "AWQ INT4",
      trust: "community",
      confidence: "inferred",
      kinds: ["cuda", "dgx"],
      runtimes: ["vLLM"],
      minVramGb: r(paramsB * 0.62 + 2),
      recVramGb: r(paramsB * 0.75 + 3),
      deltas: estimatedDeltas(-1.2),
      measured: false,
      qualityRank: 3,
    },
    {
      repo: `unsloth/${model}-GGUF`,
      format: "GGUF Q4_K_M",
      trust: "community",
      confidence: "inferred",
      kinds: ["mac", "cpu", "cuda"],
      runtimes: ["llama.cpp", "Ollama", "LM Studio"],
      minVramGb: r(paramsB * 0.66 + 2),
      recVramGb: r(paramsB * 0.8 + 3),
      deltas: estimatedDeltas(-1.4),
      measured: false,
      qualityRank: 4,
    },
    {
      repo: `mlx-community/${model}-4bit`,
      format: "MLX 4-bit",
      trust: "community",
      confidence: "needs_review",
      kinds: ["mac"],
      runtimes: ["mlx-lm"],
      minVramGb: r(paramsB * 0.6 + 2),
      recVramGb: r(paramsB * 0.7 + 3),
      deltas: unknownDeltas(),
      measured: false,
      qualityRank: 5,
    },
  ];
}

export function artifactsFor(
  family: Family,
  release: Release,
  size: SizeNode,
  variant: string,
): Artifact[] {
  const curated = size.curatedArtifacts?.[variant];
  if (curated) return curated;
  const model = `${release.name.replace(/[ .]/g, "")}-${size.label.split(" ").pop()}-${variant}`;
  return generatedArtifacts(family.vendor.split(" ")[0], model, size.paramsB);
}
