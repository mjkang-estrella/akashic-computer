import { v } from "convex/values";
const backend = v.union(v.literal("vulkan"), v.literal("cuda"), v.literal("rocm"), v.literal("metal"), v.literal("cpu"), v.literal("unknown"));
const platform = v.union(v.literal("linux-x64"), v.literal("linux-arm64"), v.literal("mac-arm64"), v.literal("windows-x64"), v.literal("unknown"));
const thinking = v.union(v.literal("on"), v.literal("off"), v.literal("unknown"));
const optNum = v.optional(v.number()), optText = v.optional(v.string());
export const cacheValue = v.union(v.literal("bf16"), v.literal("f16"), v.literal("q8_0"), v.literal("q4_0"), v.literal("unknown"));
export const computerValue = v.object({
  name: v.string(), revision: v.number(), platform, cpu: optText, backends: v.array(backend),
  devices: v.array(v.object({ id: v.string(), name: v.string(), architecture: optText })),
  pools: v.array(v.object({ id: v.string(), label: v.string(),
    kind: v.union(v.literal("unified"), v.literal("host"), v.literal("device")),
    capacityBytes: optNum, usableBytes: optNum, accessibleBytes: optNum, deviceIds: v.array(v.string()) })),
  topology: optText, source: v.union(v.literal("manual"), v.literal("observed"), v.literal("template")),
  observedAt: optNum,
  environment: v.optional(v.object({ os: optText, kernel: optText, driver: optText, powerProfile: optText })),
});
export const workloadValue = v.object({
  name: v.string(), revision: v.number(),
  taskFocus: v.union(v.literal("general"), v.literal("coding"), v.literal("reasoning"), v.literal("long-context"), v.literal("other")),
  totalMemoryBytes: v.number(), contextTokens: v.number(), concurrency: v.number(), thinking,
  reserveBytes: optNum, desiredDecodeTps: optNum, desiredTtftSeconds: optNum,
});
export const runtimeValue = v.object({
  name: v.string(), version: v.string(), backend, platform, archiveUrl: optText, archiveSha256: optText,
});
export const settingsValue = v.object({
  device: optText,
  contextTokens: v.number(), concurrency: v.number(), cacheK: cacheValue, cacheV: cacheValue,
  draftCacheK: cacheValue, draftCacheV: cacheValue,
  mtp: v.union(v.literal("off"), v.literal("draft-mtp"), v.literal("unknown")), draftMax: v.number(),
  thinking, temperature: optNum, seed: optNum, topP: optNum, topK: optNum,
  flashAttention: thinking, offload: v.union(v.literal("all"), v.literal("partial"), v.literal("cpu"), v.literal("unknown")),
  threads: optNum, batch: optNum, ubatch: optNum, chatTemplate: optText,
  reasoningFormat: v.optional(v.union(v.literal("deepseek"), v.literal("none"), v.literal("unknown"))),
});
export const deploymentValue = v.object({
  id: v.string(), label: v.string(), buildKey: v.string(), modelSlug: v.string(), artifactRepo: v.string(),
  runtime: runtimeValue, computer: computerValue, workload: workloadValue, settings: settingsValue,
});
export const protocolValue = v.object({
  id: optText, dataset: optText, datasetRevision: optText, promptSetHash: optText, promptSetId: optText, tokenizer: optText,
  tool: optText, toolVersion: optText, referenceRepo: optText, referenceRevision: optText,
  kldDirection: v.optional(v.union(v.literal("reference-to-quant"), v.literal("quant-to-reference"), v.literal("unknown"))),
  top1Definition: optText, sampleCount: optNum, warmups: optNum, repeatsPerPrompt: optNum,
  cache: v.union(v.literal("disabled"), v.literal("cold"), v.literal("warm"), v.literal("unknown")),
  order: v.optional(v.array(v.string())),
  aggregation: v.union(v.literal("median-across-prompts"), v.literal("median-repeated-trials"), v.literal("single-trial"), v.literal("source-reported")),
});
export const evidenceValue = v.object({
  schemaVersion: v.literal(2), id: v.string(), modelSlug: v.string(), artifactRepo: v.string(), buildKey: optText,
  kind: v.union(v.literal("fidelity"), v.literal("performance")),
  source: v.object({ label: v.string(), url: optText, origin: v.union(v.literal("published"), v.literal("local_import")),
    measuredAt: optNum, limitations: v.array(v.string()) }),
  protocol: protocolValue, deployment: v.optional(deploymentValue),
  fidelity: v.optional(v.object({ kld: optNum,
    top1: v.optional(v.object({ value: v.number(), unit: v.union(v.literal("fraction"), v.literal("percent")) })),
    uncertainty: v.optional(v.object({ value: v.number(),
      kind: v.union(v.literal("standard-deviation"), v.literal("standard-error"), v.literal("confidence-interval"), v.literal("unknown")),
      description: optText })) })),
  trials: v.optional(v.array(v.object({
    caseId: v.string(), repetition: optNum, promptTokens: v.number(), generatedTokens: v.number(),
    cachedTokens: optNum, decodeTps: optNum, prefillTps: optNum, prefillSeconds: optNum, ttftSeconds: optNum,
    wallSeconds: optNum, finishReason: v.union(v.literal("length"), v.literal("stop"), v.literal("error"), v.literal("unknown")),
    thinkingTokens: optNum, draftTokens: optNum, acceptedTokens: optNum,
  }))),
  memory: v.optional(v.array(v.object({
    kind: v.union(v.literal("snapshot"), v.literal("peak")),
    scope: v.union(v.literal("system"), v.literal("process"), v.literal("gpu")),
    bytes: v.number(), method: v.string(), measuredAt: optNum, sampleIntervalMs: optNum, durationSeconds: optNum, swapBytes: optNum,
  }))),
});
export const comparisonValue = v.object({
  name: v.string(), configurations: v.array(deploymentValue),
  selectedConfigurationId: optText, rationale: v.string(), evidenceIds: v.array(v.string()),
});
