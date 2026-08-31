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

export function fitOf(artifact: Artifact, rig: RigProfile): FitVerdict {
  if (rig.gb >= artifact.recVramGb) {
    return { level: "runs", text: `Fits within ${rig.gb} GB` };
  }
  if (rig.gb >= artifact.minVramGb) {
    return { level: "tight", text: `May fit within ${rig.gb} GB` };
  }
  return { level: "no", text: `Needs ${artifact.minVramGb}+ GB` };
}
