import type {
  Artifact,
  FitVerdict,
  RigPreset,
  RigProfile,
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

/** A memory budget is not a runtime/hardware topology specification. */
export function fitOf(artifact: Artifact, rig: RigProfile): FitVerdict {
  const weightGb = artifact.vramEstimate?.weightGb;
  if (weightGb && rig.gb < weightGb) {
    return { level: "no", text: `Weights alone exceed ${rig.gb} GB; offload not assessed` };
  }
  return { level: "tight", text: "Runtime fit unverified" };
}

export function memoryRange(min: number, max: number): string {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return "Unknown";
  return min === max ? `${min} GB` : `${min}–${max} GB`;
}

export function memoryEstimateLabel(artifact: Artifact): string {
  return artifact.vramEstimate
    ? `${artifact.vramEstimate.weightGb} GB weights`
    : `${memoryRange(artifact.minVramGb, artifact.recVramGb)} estimate`;
}

export function memoryAssumptions(artifact: Artifact): string {
  const estimate = artifact.vramEstimate;
  return estimate
    ? `+ ${estimate.kvCacheGb} GB KV estimate · ${estimate.contextTokens.toLocaleString("en-US")} tokens · concurrency ${estimate.concurrency} · ${estimate.kvCacheDtype}`
    : "Weight and KV breakdown unknown; exact file not selected.";
}
