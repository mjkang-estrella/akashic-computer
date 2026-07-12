import type {
  Artifact,
  Family,
  FitVerdict,
  Release,
  RigPreset,
  RigProfile,
  SizeNode,
} from "./types";

const OFFICIAL_ORGS: Record<string, string> = {
  qwen: "Qwen",
  deepseek: "deepseek-ai",
  llama: "meta-llama",
  gemma: "google",
  mistral: "mistralai",
  nemotron: "nvidia",
};

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

/** First-party reference artifact for models without a curated artifact list. */
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
  ];
}

function officialReferenceArtifact(
  repo: string,
  paramsB: number,
  format = "BF16",
): Artifact {
  const bytesPerParam = format.startsWith("FP8") ? 1.1 : 2.2;
  return {
    repo,
    format,
    trust: "official",
    confidence: "verified",
    kinds: ["cuda", "dgx"],
    runtimes: ["vLLM", "SGLang", "Transformers"],
    minVramGb: Math.max(2, Math.round(paramsB * bytesPerParam)),
    recVramGb: Math.max(3, Math.round(paramsB * bytesPerParam * 1.15)),
    deltas: zeroDeltas(),
    measured: true,
    qualityRank: 0,
  };
}

function qwen3Artifacts(size: SizeNode, variant: string): Artifact[] {
  const r = Math.round;
  const suffix = variant === "Base" ? "-Base" : "";
  const model = `Qwen3-${size.label}${suffix}`;
  const reference = officialReferenceArtifact(`Qwen/${model}`, size.paramsB);

  if (variant === "Base") return [reference];

  const intFormat =
    size.paramsB <= 2
      ? { suffix: "GPTQ-Int8", label: "GPTQ INT8", factor: 1.1 }
      : size.label === "30B-A3B" || size.label === "235B-A22B"
        ? { suffix: "GPTQ-Int4", label: "GPTQ INT4", factor: 0.62 }
        : { suffix: "AWQ", label: "AWQ INT4", factor: 0.62 };

  return [
    reference,
    {
      ...officialReferenceArtifact(`Qwen/${model}-FP8`, size.paramsB, "FP8"),
      measured: false,
      deltas: unknownDeltas(),
      qualityRank: 1,
    },
    {
      repo: `Qwen/${model}-${intFormat.suffix}`,
      format: intFormat.label,
      trust: "official",
      confidence: "verified",
      kinds: ["cuda", "dgx"],
      runtimes: ["vLLM", "SGLang"],
      minVramGb: Math.max(2, r(size.paramsB * intFormat.factor + 2)),
      recVramGb: Math.max(3, r(size.paramsB * (intFormat.factor + 0.12) + 3)),
      deltas: unknownDeltas(),
      measured: false,
      qualityRank: 2,
    },
    {
      repo: `Qwen/${model}-GGUF`,
      format: "GGUF",
      trust: "official",
      confidence: "verified",
      kinds: ["mac", "cpu", "cuda"],
      runtimes: ["llama.cpp", "Ollama", "LM Studio"],
      minVramGb: Math.max(2, r(size.paramsB * 0.66 + 2)),
      recVramGb: Math.max(3, r(size.paramsB * 0.8 + 3)),
      deltas: unknownDeltas(),
      measured: false,
      qualityRank: 3,
    },
  ];
}

function historicalArtifacts(
  release: Release,
  size: SizeNode,
  variant: string,
): Artifact[] | null {
  if (release.id === "q3") return qwen3Artifacts(size, variant);

  if (release.id === "r1") {
    return [officialReferenceArtifact("deepseek-ai/DeepSeek-R1", size.paramsB, "FP8 (native)")];
  }

  if (release.id === "r1-distill") {
    const model = `DeepSeek-R1-Distill-${variant}-${size.label}`;
    return [officialReferenceArtifact(`deepseek-ai/${model}`, size.paramsB)];
  }

  if (release.id === "l33" || release.id === "l32") {
    const version = release.id === "l33" ? "3.3" : "3.2";
    const suffix = variant === "Instruct" ? "-Instruct" : "";
    return [
      officialReferenceArtifact(
        `meta-llama/Llama-${version}-${size.label}${suffix}`,
        size.paramsB,
      ),
    ];
  }

  if (release.id === "g3") {
    return [
      officialReferenceArtifact(
        `google/gemma-3-${size.label.toLowerCase()}-${variant.toLowerCase()}`,
        size.paramsB,
      ),
    ];
  }

  if (release.id === "ms31") {
    return [
      officialReferenceArtifact(
        `mistralai/Mistral-Small-3.1-${size.label}-${variant}-2503`,
        size.paramsB,
      ),
    ];
  }

  return null;
}

export function artifactsFor(
  family: Family,
  release: Release,
  size: SizeNode,
  variant: string,
): Artifact[] {
  const curated = size.curatedArtifacts?.[variant];
  if (curated) return curated;
  const historical = historicalArtifacts(release, size, variant);
  if (historical) return historical;
  const model = `${release.name.replace(/[ .]/g, "")}-${size.label.split(" ").pop()}-${variant}`;
  return generatedArtifacts(
    OFFICIAL_ORGS[family.id] ?? family.vendor.split(" ")[0],
    model,
    size.paramsB,
  );
}
