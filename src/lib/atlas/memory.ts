export type CachePrecision = "bf16" | "f16" | "q8_0" | "q4_0" | "unknown";
export interface MemoryArchitecture {
  mainLayers: number;
  growingLayers: number | null;
  kvHeads: number | null;
  keyDim: number | null;
  valueDim: number | null;
  kvLoraRank?: number;
  ropeDim?: number;
  nativeContext: number | null;
  mtpLayers?: number;
  sourceUrl?: string;
}
export interface MemoryComponent {
  key: "weights" | "kv" | "recurrent" | "draft" | "workspace" | "reserve";
  label: string;
  bytes: number | null;
  basis: string;
}
export interface MemoryEstimate {
  components: MemoryComponent[];
  knownSubtotalBytes: number;
  totalBytes: number | null;
}
const rec = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {};
const positive = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null;

export function architectureFromConfig(raw: Record<string, unknown>, sourceUrl?: string): MemoryArchitecture | undefined {
  const c = Object.keys(rec(raw.text_config)).length ? rec(raw.text_config) : raw;
  const layers = positive(c.num_hidden_layers ?? c.n_layer ?? c.num_layers);
  if (!layers) return undefined;
  const types = Array.isArray(c.layer_types) ? c.layer_types : null;
  // An incomplete/malformed layer map is unknown, not evidence that all layers grow.
  const growing = types
    ? types.length === layers && types.every((t) => typeof t === "string" &&
      ["full_attention", "sliding_attention", "linear_attention", "deepseek_sparse_attention"].includes(t))
      ? types.filter((t) => t !== "linear_attention").length : null
    : layers;
  const heads = positive(c.num_attention_heads ?? c.n_head);
  const dim = positive(c.head_dim) ?? (positive(c.hidden_size ?? c.n_embd) && heads
    ? Number(c.hidden_size ?? c.n_embd) / heads : null);
  const rank = positive(c.kv_lora_rank);
  return {
    mainLayers: layers, growingLayers: growing,
    kvHeads: positive(c.num_key_value_heads) ?? heads,
    keyDim: positive(c.key_head_dim) ?? dim, valueDim: positive(c.value_head_dim) ?? dim,
    nativeContext: positive(c.max_position_embeddings ?? c.max_sequence_length ?? c.seq_length),
    ...(rank ? { kvLoraRank: rank, ropeDim: Number(c.qk_rope_head_dim ?? 0) } : {}),
    ...(typeof (c.mtp_num_hidden_layers ?? c.num_nextn_predict_layers) === "number"
      ? { mtpLayers: Number(c.mtp_num_hidden_layers ?? c.num_nextn_predict_layers) } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  };
}

/** Row padding/block scales included; allocator padding and draft state are separate. */
function rowBytes(elements: number, precision: CachePrecision): number | null {
  if (precision === "bf16" || precision === "f16") return elements * 2;
  if (precision === "q8_0") return Math.ceil(elements / 32) * 34;
  if (precision === "q4_0") return Math.ceil(elements / 32) * 18;
  return null;
}
export function mainKvBytes(a: MemoryArchitecture | undefined, tokens: number, concurrency: number,
  k: CachePrecision, v: CachePrecision): number | null {
  if (!a || a.growingLayers === null || !Number.isSafeInteger(tokens) || tokens <= 0 ||
      !Number.isSafeInteger(concurrency) || concurrency <= 0) return null;
  if (a.growingLayers === 0) return 0;
  if (a.kvLoraRank) {
    // Quantized MLA layout is runtime-specific. Retain the known BF16 latent-cache formula.
    if (k !== "bf16" || v !== "bf16") return null;
    return a.growingLayers * (a.kvLoraRank + (a.ropeDim ?? 0)) * 2 * tokens * concurrency;
  }
  if (!a.kvHeads || !a.keyDim || !a.valueDim) return null;
  const key = rowBytes(a.keyDim, k), value = rowBytes(a.valueDim, v);
  if (key === null || value === null) return null;
  return a.growingLayers * a.kvHeads * (key + value) * tokens * concurrency;
}
export function estimateDeploymentMemory(input: {
  weightBytes: number | null; architecture?: MemoryArchitecture;
  contextTokens: number; concurrency: number; k: CachePrecision; v: CachePrecision;
  reserveBytes?: number | null; mtp: boolean;
}): MemoryEstimate {
  const a = input.architecture;
  const components: MemoryComponent[] = [
    { key: "weights", label: "Weights", bytes: input.weightBytes, basis: "Download bytes; resident allocation may differ" },
    { key: "kv", label: "Main KV cache", bytes: mainKvBytes(a, input.contextTokens, input.concurrency, input.k, input.v), basis: "Estimated growing attention cache; allocator padding excluded. Sliding-window layers conservatively use full context." },
    { key: "recurrent", label: "Recurrent state", bytes: a && a.growingLayers === a.mainLayers ? 0 : null, basis: "Runtime-specific linear-attention state" },
    { key: "draft", label: "MTP / draft state", bytes: input.mtp ? null : 0, basis: "Separate from main KV" },
    { key: "workspace", label: "Runtime workspace", bytes: null, basis: "Runtime-specific buffers and resident-weight overhead" },
    { key: "reserve", label: "OS / other use", bytes: input.reserveBytes ?? null, basis: "User-supplied reserve" },
  ];
  return { components, knownSubtotalBytes: components.reduce((sum, c) => sum + (c.bytes ?? 0), 0),
    totalBytes: components.every((c) => c.bytes !== null) ? components.reduce((sum, c) => sum + c.bytes!, 0) : null };
}
export function memoryBytesLabel(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return "Unknown";
  return (bytes / 1e9).toLocaleString("en-US", { maximumFractionDigits: 3 }) + " GB (" +
    (bytes / 2 ** 30).toLocaleString("en-US", { maximumFractionDigits: 3 }) + " GiB)";
}
