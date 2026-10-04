import { v } from "convex/values";
export const architectureValue = v.object({
  mainLayers: v.number(), growingLayers: v.union(v.number(), v.null()),
  kvHeads: v.union(v.number(), v.null()), keyDim: v.union(v.number(), v.null()),
  valueDim: v.union(v.number(), v.null()), nativeContext: v.union(v.number(), v.null()),
  kvLoraRank: v.optional(v.number()), ropeDim: v.optional(v.number()),
  mtpLayers: v.optional(v.number()), sourceUrl: v.optional(v.string()),
});
export const artifactFileValue = v.object({
  path: v.string(), bytes: v.union(v.number(), v.null()),
  sha256: v.optional(v.string()), gitOid: v.optional(v.string()),
});
export const buildFields = {
  key: v.string(), repo: v.string(), revision: v.string(), label: v.string(),
  files: v.array(artifactFileValue), bytes: v.union(v.number(), v.null()), complete: v.boolean(),
  container: v.union(v.literal("gguf"), v.literal("safetensors"), v.literal("other")),
  quantization: v.string(), precisionBits: v.optional(v.number()), effectiveBits: v.optional(v.number()),
  mtp: v.union(v.literal("present"), v.literal("absent"), v.literal("unknown")),
  baseModels: v.array(v.string()), architecture: v.optional(architectureValue), sourceUrl: v.string(),
};
export const artifactBuildValue = v.object(buildFields);
