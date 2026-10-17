import type {
  Artifact,
  ContextChoice,
  FitVerdict,
  RigPreset,
  RigProfile,
  VramEstimateDetails,
} from "./types";

/** Null means no budget: catalog surfaces then show memory estimates without fit judgments. */
export function resolveProfile(
  presets: RigPreset[],
  presetId: string | null,
  manualGb: number | null,
): RigProfile | null {
  if (manualGb && manualGb > 0) {
    return { gb: manualGb, kind: "generic", label: `${manualGb} GB budget`, manual: true };
  }
  const preset = presetId ? presets.find((p) => p.id === presetId) : undefined;
  if (!preset) return null;
  return {
    gb: preset.gb, kind: preset.kind, manual: false,
    label: preset.group ? preset.label : `${preset.gb} GB`,
    ...(preset.detail ? { detail: preset.detail } : {}),
  };
}

export function contextLabel(tokens: number): string {
  if (tokens >= 1_048_576 && tokens % 1_048_576 === 0) return `${tokens / 1_048_576}M`;
  if (tokens >= 1024 && tokens % 1024 === 0) return `${tokens / 1024}K`;
  return tokens.toLocaleString("en-US");
}

/**
 * The catalog estimate is computed at native context. The growing-cache formula is linear
 * in tokens (sliding-window layers conservatively count full context), so a shorter context
 * scales it proportionally. Requests beyond native context are capped at native.
 */
export function kvCacheAt(estimate: VramEstimateDetails, context: ContextChoice) {
  const native = estimate.contextTokens;
  const tokens = context === "native" ? native : Math.min(context, native);
  const nativeBytes = estimate.kvCacheBytes ?? estimate.kvCacheGb * 1e9;
  return {
    bytes: Math.round(nativeBytes * (tokens / native)),
    tokens,
    capped: context !== "native" && context > native,
  };
}

const gbLabel = (bytes: number) => {
  const gb = bytes / 1e9;
  return Number(gb < 10 ? gb.toFixed(1) : gb.toFixed(0)).toString();
};

/**
 * A memory budget is not a runtime/hardware topology specification. Without a context,
 * only a weight-only deficit is reported; with one, the BF16 KV estimate at that context is
 * added. Neither case certifies that an artifact runs.
 */
export function fitOf(
  artifact: Artifact,
  rig: RigProfile | null,
  options: { context?: ContextChoice } = {},
): FitVerdict {
  if (!rig) return { level: "unset", text: "No memory budget set" };
  const estimate = artifact.vramEstimate;
  const weightGb = estimate?.weightGb;
  if (weightGb && rig.gb < weightGb) {
    return { level: "no", text: `Weights alone exceed ${rig.gb} GB; offload not assessed` };
  }
  if (estimate && options.context !== undefined) {
    const kv = kvCacheAt(estimate, options.context);
    if (rig.gb < estimate.weightGb + kv.bytes / 1e9) {
      return {
        level: "no",
        text: `Weights + ${options.context === "native" || kv.capped ? "native-context" : contextLabel(kv.tokens)} BF16 KV exceed ${rig.gb} GB; offload not assessed`,
      };
    }
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

export function memoryAssumptions(artifact: Artifact, context: ContextChoice = "native"): string {
  const estimate = artifact.vramEstimate;
  if (!estimate) return "Weight and KV breakdown unknown; exact file not selected.";
  const kv = kvCacheAt(estimate, context);
  const capped = kv.capped ? ` (native maximum; ${contextLabel(context as number)} exceeds it)` : "";
  return `+ ${gbLabel(kv.bytes)} GB KV estimate · ${kv.tokens.toLocaleString("en-US")} tokens${capped} · concurrency ${estimate.concurrency} · ${estimate.kvCacheDtype}`;
}
