import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  modelFamilies: defineTable({
    slug: v.string(),
    name: v.string(),
    vendor: v.string(),
    summary: v.string(),
    homepageUrl: v.optional(v.string()),
    license: v.optional(v.string()),
    modalities: v.array(v.string()),
    tags: v.array(v.string()),
  })
    .index("by_slug", ["slug"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["vendor"],
    }),

  modelReleases: defineTable({
    familyId: v.id("modelFamilies"),
    slug: v.string(),
    name: v.string(),
    version: v.optional(v.string()),
    releasedAt: v.optional(v.number()),
    contextTokens: v.optional(v.number()),
    license: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_family", ["familyId"])
    .index("by_slug", ["slug"]),

  modelVariants: defineTable({
    releaseId: v.id("modelReleases"),
    slug: v.string(),
    name: v.string(),
    parameterLabel: v.string(),
    parameterCountB: v.optional(v.number()),
    activeParameterCountB: v.optional(v.number()),
    architecture: v.optional(v.string()),
    variantKind: v.union(
      v.literal("base"),
      v.literal("instruct"),
      v.literal("reasoning"),
      v.literal("coder"),
      v.literal("vision"),
      v.literal("embedding"),
      v.literal("reranker"),
      v.literal("other"),
    ),
  })
    .index("by_release", ["releaseId"])
    .index("by_slug", ["slug"]),

  artifacts: defineTable({
    variantId: v.id("modelVariants"),
    huggingFaceRepo: v.string(),
    format: v.string(),
    quantization: v.optional(v.string()),
    dtype: v.optional(v.string()),
    uploaderKind: v.union(
      v.literal("official"),
      v.literal("vendor"),
      v.literal("community"),
      v.literal("unknown"),
    ),
    runtimeSupport: v.array(v.string()),
    minVramGb: v.optional(v.number()),
    recommendedVramGb: v.optional(v.number()),
    provenanceUrl: v.optional(v.string()),
    confidence: v.union(
      v.literal("verified"),
      v.literal("inferred"),
      v.literal("needs_review"),
    ),
  })
    .index("by_variant", ["variantId"])
    .index("by_repo", ["huggingFaceRepo"]),

  benchmarks: defineTable({
    artifactId: v.id("artifacts"),
    benchmarkName: v.string(),
    score: v.number(),
    higherIsBetter: v.boolean(),
    sourceUrl: v.string(),
    measuredAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_artifact", ["artifactId"])
    .index("by_benchmark", ["benchmarkName"]),
});
