import { consumeAccountLimit, accountIsAdmin } from "./accountPolicy";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ownedConversation, requireOwner, terminal } from "./workspaceAccess";

export const identity = query({
  args: {},
  handler: async (ctx) => {
    if (!(await ctx.auth.getUserIdentity())) return null;
    const id = await requireOwner(ctx);
    const user = await ctx.db.get(id);
    const account = await ctx.db.query("accountOwners").withIndex("by_user", (q) => q.eq("userId", id)).unique();
    return { id, name: user?.name ?? "Personal workspace", role: account && accountIsAdmin(account) ? "admin" as const : "member" as const };
  },
});
export const runningDeployment = query({
  args: { repo: v.string() },
  handler: async (ctx, { repo }) => {
    const ownerId = await requireOwner(ctx);
    const ds = await ctx.db
      .query("deployments")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(100);
    for (const d of ds) {
      if (d.artifactRepo !== repo || d.status !== "online") continue;
      const c = await ctx.db.get(d.connectorId);
      if (c && !c.revokedAt && Date.now() - c.lastSeenAt < 60000)
        return { id: d._id, model: d.model };
    }
    return null;
  },
});
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    const connectors = await ctx.db
      .query("connectors")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(30);
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(200);
    const deployments = await ctx.db
      .query("deployments")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(100);
    return {
      connectors: connectors.map((c) => ({
        id: c._id,
        name: c.name,
        lastSeenAt: c.lastSeenAt,
        revoked: !!c.revokedAt,
      })),
      devices,
      deployments,
    };
  },
});
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    return ctx.db
      .query("conversations")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(100);
  },
});
export const getConversation = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    const ownerId = await requireOwner(ctx);
    const conversation = await ownedConversation(ctx, id, ownerId);
    const messages = await ctx.db
      .query("workspaceMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
      .order("desc")
      .take(100);
    const jobs = await ctx.db
      .query("workspaceJobs")
      .withIndex("by_conversation", (q) => q.eq("conversationId", id))
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
export const createConversation = mutation({
  args: {
    deploymentId: v.id("deployments"),
    mode: v.union(v.literal("chat"), v.literal("agent")),
  },
  handler: async (ctx, a) => {
    const ownerId = await requireOwner(ctx);
    const d = await ctx.db.get(a.deploymentId);
    if (!d || d.ownerId !== ownerId) throw new Error("Deployment not found.");
    const c = await ctx.db.get(d.connectorId);
    if (!c || c.revokedAt) throw new Error("Connector is unavailable.");
    await consumeAccountLimit(ctx, ownerId, "session/job creations", 60);
    return ctx.db.insert("conversations", {
      ownerId,
      connectorId: d.connectorId,
      deploymentId: d._id,
      title: "New session",
      mode: a.mode,
      updatedAt: Date.now(),
    });
  },
});
export const submitJob = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
    key: v.string(),
    maxTokens: v.number(),
  },
  handler: async (ctx, a) => {
    const ownerId = await requireOwner(ctx);
    const c = await ownedConversation(ctx, a.conversationId, ownerId);
    if (
      !a.text.trim() ||
      a.text.length > 16000 ||
      a.key.length < 8 ||
      a.key.length > 100 ||
      !Number.isInteger(a.maxTokens) ||
      a.maxTokens < 128 ||
      a.maxTokens > 8192
    )
      throw new Error("Invalid message or output budget.");
    const old = await ctx.db
      .query("workspaceJobs")
      .withIndex("by_owner_key", (q) =>
        q.eq("ownerId", ownerId).eq("key", a.key),
      )
      .unique();
    if (old) {
      if (
        old.conversationId !== c._id ||
        old.prompt !== a.text ||
        old.maxTokens !== a.maxTokens
      )
        throw new Error("Request key conflict.");
      return old._id;
    }
    const jobs = await ctx.db
      .query("workspaceJobs")
      .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
      .order("desc")
      .take(30);
    if (jobs.some((j) => !terminal(j.status)))
      throw new Error("Wait for or cancel the active job.");
    const connector = await ctx.db.get(c.connectorId);
    if (!connector || connector.revokedAt)
      throw new Error("Connector is revoked.");
    await consumeAccountLimit(ctx, ownerId, "session/job creations", 60);
    const id = await ctx.db.insert("workspaceJobs", {
      ownerId,
      connectorId: c.connectorId,
      conversationId: c._id,
      deploymentId: c.deploymentId,
      key: a.key,
      prompt: a.text,
      maxTokens: a.maxTokens,
      status: "queued",
      rounds: 0,
      promptTokens: 0,
      completionTokens: 0,
      lastSequence: 0,
    });
    await ctx.db.insert("workspaceMessages", {
      ownerId,
      conversationId: c._id,
      jobId: id,
      role: "user",
      content: a.text,
      partial: false,
    });
    await ctx.db.patch(c._id, {
      updatedAt: Date.now(),
      ...(c.title === "New session" ? { title: a.text.slice(0, 58) } : {}),
    });
    return id;
  },
});
export const cancelJob = mutation({
  args: { id: v.id("workspaceJobs") },
  handler: async (ctx, { id }) => {
    const ownerId = await requireOwner(ctx);
    const job = await ctx.db.get(id);
    if (!job || job.ownerId !== ownerId) throw new Error("Job not found.");
    if (!terminal(job.status))
      await ctx.db.patch(id, {
        status: job.status === "queued" ? "cancelled" : "cancelling",
        ...(job.status === "queued" ? { finishedAt: Date.now() } : {}),
      });
  },
});
export const approveEnrollment = mutation({
  args: { codeHash: v.string() },
  handler: async (ctx, { codeHash }) => {
    const ownerId = await requireOwner(ctx);
    const e = await ctx.db
      .query("enrollments")
      .withIndex("by_code", (q) => q.eq("codeHash", codeHash))
      .unique();
    if (
      !e ||
      e.ownerId !== ownerId ||
      !e.credentialHash ||
      e.expiresAt < Date.now() ||
      e.connectorId
    )
      throw new Error("Code expired, invalid, or already used.");
    const existing = await ctx.db
      .query("connectors")
      .withIndex("by_owner_and_revoked", (q) => q.eq("ownerId", ownerId).eq("revokedAt", undefined))
      .take(10);
    if (existing.length >= 10) throw new Error("Connector limit reached.");
    const id = await ctx.db.insert("connectors", {
      ownerId,
      name: e.name,
      credentialHash: e.credentialHash,
      lastSeenAt: 0,
    });
    await ctx.db.patch(e._id, { connectorId: id });
    return id;
  },
});
export const beginEnrollment = mutation({
  args: { codeHash: v.string() },
  handler: async (ctx, { codeHash }) => {
    const ownerId = await requireOwner(ctx);
    await consumeAccountLimit(ctx, ownerId, "enrollments", 10);
    if (!/^[a-f0-9]{64}$/.test(codeHash)) throw new Error("Invalid code.");
    const old = await ctx.db
      .query("enrollments")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc").take(100);
    for (const e of old) if (!e.connectorId) await ctx.db.delete(e._id);
    return ctx.db.insert("enrollments", {
      ownerId,
      codeHash,
      credentialHash: "",
      name: "Waiting for computer",
      expiresAt: Date.now() + 600000,
    });
  },
});
export const pendingEnrollment = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    const rows = await ctx.db
      .query("enrollments")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(10);
    const e = rows.find((x) => !x.connectorId && x.expiresAt > Date.now());
    return e
      ? {
          name: e.name,
          ready: !!e.credentialHash,
          codeHash: e.codeHash,
          expiresAt: e.expiresAt,
        }
      : null;
  },
});
export const revokeConnector = mutation({
  args: { id: v.id("connectors") },
  handler: async (ctx, { id }) => {
    const ownerId = await requireOwner(ctx);
    const c = await ctx.db.get(id);
    if (!c || c.ownerId !== ownerId) throw new Error("Connector not found.");
    await ctx.db.patch(id, { revokedAt: Date.now() });
    for (const status of ["queued", "running", "cancelling"] as const) {
      const jobs = await ctx.db
        .query("workspaceJobs")
        .withIndex("by_connector_status", (q) =>
          q.eq("connectorId", id).eq("status", status),
        )
        .take(100);
      for (const j of jobs)
        await ctx.db.patch(j._id, {
          status: j.status === "queued" ? "cancelled" : "interrupted",
          error:
            "Connector revoked. Local execution must reconcile before any further work.",
          finishedAt: Date.now(),
        });
    }
  },
});

export const accessPolicy = query({
  args: {}, returns: v.object({ signup: v.union(v.literal("github"), v.literal("single_owner")) }),
  handler: async () => ({ signup: process.env.WORKSPACE_ACCESS_MODE === "github" ? "github" as const : "single_owner" as const }),
});
