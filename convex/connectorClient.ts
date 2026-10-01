import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { credentialConnector, terminal } from "./workspaceAccess";
export const read = internalQuery({
  args: {
    credentialHash: v.string(),
    operation: v.union(
      v.literal("overview"),
      v.literal("sessions"),
      v.literal("session"),
      v.literal("job"),
    ),
    conversationId: v.optional(v.id("conversations")),
    jobId: v.optional(v.id("workspaceJobs")),
  },
  handler: async (ctx, a) => {
    const c = await credentialConnector(ctx, a.credentialHash);
    if (a.operation === "job") {
      if (!a.jobId) throw new Error("Job required");
      const j = await ctx.db.get(a.jobId);
      if (!j || j.connectorId !== c._id || j.ownerId !== c.ownerId)
        throw new Error("Job not found");
      const output = await ctx.db
        .query("jobOutput")
        .withIndex("by_job", (q) => q.eq("jobId", j._id))
        .unique();
      const messages = await ctx.db
        .query("workspaceMessages")
        .withIndex("by_job", (q) => q.eq("jobId", j._id))
        .take(2);
      const deployment = await ctx.db.get(j.deploymentId);
      return {
        id: `cloud:${j._id}`,
        sessionId: j.conversationId,
        status: j.status === "completed" ? "succeeded" : j.status,
        output:
          messages.find((m) => m.role === "assistant")?.content ||
          output?.content ||
          "",
        events: output?.events || [],
        rounds: j.rounds,
        error: j.error,
        model: j.model || deployment?.model,
        usage: {
          prompt_tokens: j.promptTokens,
          completion_tokens: j.completionTokens,
        },
      };
    }
    if (a.operation === "overview")
      return {
        connectors: [
          { id: c._id, name: c.name, lastSeenAt: c.lastSeenAt, revoked: false },
        ],
        devices: await ctx.db
          .query("devices")
          .withIndex("by_connector", (q) => q.eq("connectorId", c._id))
          .take(200),
        deployments: await ctx.db
          .query("deployments")
          .withIndex("by_connector", (q) => q.eq("connectorId", c._id))
          .take(100),
      };
    if (a.operation === "sessions")
      return ctx.db
        .query("conversations")
        .withIndex("by_connector", (q) => q.eq("connectorId", c._id))
        .order("desc")
        .take(100);
    if (!a.conversationId) throw new Error("Conversation required");
    const conversation = await ctx.db.get(a.conversationId);
    if (
      !conversation ||
      conversation.connectorId !== c._id ||
      conversation.ownerId !== c.ownerId
    )
      throw new Error("Conversation not found");
    const messages = await ctx.db
      .query("workspaceMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .order("desc")
      .take(100);
    const jobs = await ctx.db
      .query("workspaceJobs")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .order("desc")
      .take(30);
    const progress = await Promise.all(
      jobs
        .filter((j) => !terminal(j.status))
        .map(async (j) => ({
          jobId: j._id,
          ...(await ctx.db
            .query("jobOutput")
            .withIndex("by_job", (q) => q.eq("jobId", j._id))
            .unique()),
        })),
    );
    return { conversation, messages: messages.reverse(), jobs, progress };
  },
});
export const write = internalMutation({
  args: {
    credentialHash: v.string(),
    operation: v.union(
      v.literal("create"),
      v.literal("send"),
      v.literal("cancel"),
      v.literal("delegate"),
    ),
    conversationId: v.optional(v.id("conversations")),
    jobId: v.optional(v.id("workspaceJobs")),
    deploymentId: v.optional(v.id("deployments")),
    mode: v.optional(v.union(v.literal("chat"), v.literal("agent"))),
    text: v.optional(v.string()),
    key: v.optional(v.string()),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const c = await credentialConnector(ctx, a.credentialHash);
    if (a.operation === "delegate") {
      const text = a.text || "",
        key = a.key || "",
        maxTokens = a.maxTokens ?? 8192;
      if (
        !text.trim() ||
        text.length > 16000 ||
        key.length < 8 ||
        key.length > 100 ||
        !Number.isInteger(maxTokens) ||
        maxTokens < 128 ||
        maxTokens > 8192
      )
        throw new Error("Invalid message");
      const scopedKey = `delegate:${key}`;
      const old = await ctx.db
        .query("workspaceJobs")
        .withIndex("by_owner_key", (q) =>
          q.eq("ownerId", c.ownerId).eq("key", scopedKey),
        )
        .unique();
      if (old) {
        if (
          old.connectorId !== c._id ||
          old.prompt !== text ||
          old.maxTokens !== maxTokens
        )
          throw new Error("Request key conflict");
        return {
          jobId: `cloud:${old._id}`,
          sessionId: old.conversationId,
          status: old.status,
        };
      }
      const deployments = await ctx.db
        .query("deployments")
        .withIndex("by_connector", (q) => q.eq("connectorId", c._id))
        .take(100);
      const d = deployments.find(
        (d) => d.status === "online" && d.ownerId === c.ownerId,
      );
      if (!d) throw new Error("No running deployment");
      const conversationId = await ctx.db.insert("conversations", {
        ownerId: c.ownerId,
        connectorId: c._id,
        deploymentId: d._id,
        title: text.slice(0, 58),
        mode: "agent",
        updatedAt: Date.now(),
      });
      const jobId = await ctx.db.insert("workspaceJobs", {
        ownerId: c.ownerId,
        connectorId: c._id,
        conversationId,
        deploymentId: d._id,
        key: scopedKey,
        prompt: text,
        maxTokens,
        status: "queued",
        rounds: 0,
        promptTokens: 0,
        completionTokens: 0,
        lastSequence: 0,
      });
      await ctx.db.insert("workspaceMessages", {
        ownerId: c.ownerId,
        conversationId,
        jobId,
        role: "user",
        content: text,
        partial: false,
      });
      return {
        jobId: `cloud:${jobId}`,
        sessionId: conversationId,
        status: "queued",
      };
    }
    if (a.operation === "create") {
      if (!a.deploymentId) throw new Error("Deployment required");
      const d = await ctx.db.get(a.deploymentId);
      if (!d || d.connectorId !== c._id || d.ownerId !== c.ownerId)
        throw new Error("Deployment not found");
      return ctx.db.insert("conversations", {
        ownerId: c.ownerId,
        connectorId: c._id,
        deploymentId: d._id,
        title: "New session",
        mode: a.mode || "chat",
        updatedAt: Date.now(),
      });
    }
    if (a.operation === "cancel") {
      if (!a.jobId) throw new Error("Job required");
      const j = await ctx.db.get(a.jobId);
      if (!j || j.connectorId !== c._id) throw new Error("Job not found");
      if (!terminal(j.status))
        await ctx.db.patch(j._id, {
          status: j.status === "queued" ? "cancelled" : "cancelling",
          ...(j.status === "queued" ? { finishedAt: Date.now() } : {}),
        });
      return j._id;
    }
    if (!a.conversationId) throw new Error("Conversation required");
    const conversation = await ctx.db.get(a.conversationId);
    if (
      !conversation ||
      conversation.connectorId !== c._id ||
      conversation.ownerId !== c.ownerId
    )
      throw new Error("Conversation not found");
    const text = a.text || "",
      key = a.key || "",
      maxTokens = a.maxTokens ?? 8192;
    if (
      !text.trim() ||
      text.length > 16000 ||
      key.length < 8 ||
      key.length > 100 ||
      !Number.isInteger(maxTokens) ||
      maxTokens < 128 ||
      maxTokens > 8192
    )
      throw new Error("Invalid message");
    const old = await ctx.db
      .query("workspaceJobs")
      .withIndex("by_owner_key", (q) =>
        q.eq("ownerId", c.ownerId).eq("key", key),
      )
      .unique();
    if (old) {
      if (
        old.conversationId !== conversation._id ||
        old.prompt !== text ||
        old.maxTokens !== maxTokens
      )
        throw new Error("Request key conflict");
      return old._id;
    }
    const jobs = await ctx.db
      .query("workspaceJobs")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .order("desc")
      .take(30);
    if (jobs.some((j) => !terminal(j.status)))
      throw new Error("Conversation has an active job");
    const id = await ctx.db.insert("workspaceJobs", {
      ownerId: c.ownerId,
      connectorId: c._id,
      conversationId: conversation._id,
      deploymentId: conversation.deploymentId,
      key,
      prompt: text,
      maxTokens,
      status: "queued",
      rounds: 0,
      promptTokens: 0,
      completionTokens: 0,
      lastSequence: 0,
    });
    await ctx.db.insert("workspaceMessages", {
      ownerId: c.ownerId,
      conversationId: conversation._id,
      jobId: id,
      role: "user",
      content: text,
      partial: false,
    });
    await ctx.db.patch(conversation._id, {
      updatedAt: Date.now(),
      ...(conversation.title === "New session"
        ? { title: text.slice(0, 58) }
        : {}),
    });
    return id;
  },
});
