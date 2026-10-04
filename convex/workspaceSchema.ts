import { defineTable } from "convex/server";
import { v } from "convex/values";

export const jobState = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("cancelling"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("interrupted"),
);
export const workspaceTables = {
  accountLimits: defineTable({
    ownerId: v.id("users"), kind: v.string(), windowStart: v.number(), count: v.number(),
  }).index("by_owner_and_kind", ["ownerId", "kind"]),
  accountOwners: defineTable({
    userId: v.id("users"),
    githubId: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"))),
    role: v.optional(v.union(v.literal("member"), v.literal("admin"))),
    importedReportCount: v.optional(v.number()),
  }).index("by_user", ["userId"]).index("by_github_id", ["githubId"]),
  enrollments: defineTable({
    ownerId: v.id("users"),
    codeHash: v.string(),
    credentialHash: v.string(),
    name: v.string(),
    expiresAt: v.number(),
    connectorId: v.optional(v.id("connectors")),
  })
    .index("by_code", ["codeHash"])
    .index("by_owner", ["ownerId"]),
  connectors: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    credentialHash: v.string(),
    lastSeenAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_credential", ["credentialHash"])
    .index("by_owner_and_revoked", ["ownerId", "revokedAt"]),
  devices: defineTable({
    ownerId: v.id("users"),
    connectorId: v.id("connectors"),
    localId: v.string(),
    name: v.string(),
    role: v.string(),
    state: v.string(),
    status: v.string(),
    observedAt: v.optional(v.number()),
    hardware: v.optional(v.string()),
    memoryTotal: v.optional(v.number()),
    memoryAvailable: v.optional(v.number()),
    group: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_connector", ["connectorId"])
    .index("by_owner", ["ownerId"]),
  deployments: defineTable({
    ownerId: v.id("users"),
    connectorId: v.id("connectors"),
    localId: v.string(),
    model: v.string(),
    status: v.string(),
    observedAt: v.number(),
    artifactRepo: v.optional(v.string()),
  })
    .index("by_connector", ["connectorId"])
    .index("by_owner", ["ownerId"]),
  conversations: defineTable({
    ownerId: v.id("users"),
    connectorId: v.id("connectors"),
    deploymentId: v.id("deployments"),
    title: v.string(),
    mode: v.union(v.literal("chat"), v.literal("agent")),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_connector", ["connectorId"]),
  workspaceMessages: defineTable({
    ownerId: v.id("users"),
    conversationId: v.id("conversations"),
    jobId: v.id("workspaceJobs"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    partial: v.boolean(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_job", ["jobId"]),
  workspaceJobs: defineTable({
    ownerId: v.id("users"),
    connectorId: v.id("connectors"),
    conversationId: v.id("conversations"),
    deploymentId: v.id("deployments"),
    key: v.string(),
    prompt: v.string(),
    maxTokens: v.number(),
    status: jobState,
    leaseId: v.optional(v.string()),
    leaseUntil: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    model: v.optional(v.string()),
    rounds: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    lastSequence: v.number(),
  })
    .index("by_connector_status", ["connectorId", "status"])
    .index("by_conversation", ["conversationId"])
    .index("by_owner_key", ["ownerId", "key"]),
  jobOutput: defineTable({
    jobId: v.id("workspaceJobs"),
    content: v.string(),
    events: v.array(v.object({ tool: v.string(), status: v.string() })),
  }).index("by_job", ["jobId"]),
};
