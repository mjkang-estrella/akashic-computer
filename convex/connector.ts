import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { credentialConnector, terminal } from "./workspaceAccess";
import { jobState } from "./workspaceSchema";

export const enroll = internalMutation({
  args: { codeHash: v.string(), credentialHash: v.string(), name: v.string() },
  handler: async (ctx, a) => {
    if (
      a.name.length > 100 ||
      !/^[a-f0-9]{64}$/.test(a.credentialHash) ||
      !/^[a-f0-9]{64}$/.test(a.codeHash)
    )
      throw new Error("Invalid enrollment.");
    const e = await ctx.db
      .query("enrollments")
      .withIndex("by_code", (q) => q.eq("codeHash", a.codeHash))
      .unique();
    if (
      !e ||
      e.expiresAt < Date.now() ||
      e.connectorId ||
      (e.credentialHash && e.credentialHash !== a.credentialHash)
    )
      throw new Error("Enrollment code expired or already used.");
    await ctx.db.patch(e._id, {
      name: a.name,
      credentialHash: a.credentialHash,
    });
    return e._id;
  },
});
export const enrollmentStatus = internalQuery({
  args: { id: v.id("enrollments"), credentialHash: v.string() },
  handler: async (ctx, a) => {
    const e = await ctx.db.get(a.id);
    if (!e || e.credentialHash !== a.credentialHash || e.expiresAt < Date.now())
      throw new Error("Enrollment expired or invalid.");
    return e.connectorId
      ? { status: "approved", connectorId: e.connectorId }
      : { status: "pending" };
  },
});
const deviceValue = v.object({
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
});
const deploymentValue = v.object({
  localId: v.string(),
  model: v.string(),
  status: v.string(),
  artifactRepo: v.optional(v.string()),
});
export const heartbeat = internalMutation({
  args: {
    name: v.optional(v.string()),
    credentialHash: v.string(),
    devices: v.array(deviceValue),
    deployments: v.array(deploymentValue),
  },
  handler: async (ctx, a) => {
    const c = await credentialConnector(ctx, a.credentialHash);
    if (a.devices.length > 200 || a.deployments.length > 100)
      throw new Error("Inventory too large.");
    if (a.name && a.name.length > 100)
      throw new Error("Controller name too long.");
    await ctx.db.patch(c._id, {
      lastSeenAt: Date.now(),
      ...(a.name ? { name: a.name } : {}),
    });
    const current = await ctx.db
      .query("devices")
      .withIndex("by_connector", (q) => q.eq("connectorId", c._id))
      .collect();
    for (const d of a.devices) {
      const fields = { ...d, ownerId: c.ownerId, connectorId: c._id };
      const old = current.find((x) => x.localId === d.localId);
      if (old) await ctx.db.replace(old._id, fields);
      else await ctx.db.insert("devices", fields);
    }
    for (const old of current)
      if (!a.devices.some((d) => d.localId === old.localId))
        await ctx.db.patch(old._id, { status: "not-reported" });
    const prior = await ctx.db
      .query("deployments")
      .withIndex("by_connector", (q) => q.eq("connectorId", c._id))
      .collect();
    for (const d of a.deployments) {
      const fields = {
        ...d,
        ownerId: c.ownerId,
        connectorId: c._id,
        observedAt: Date.now(),
      };
      const old = prior.find((x) => x.localId === d.localId);
      if (old) await ctx.db.replace(old._id, fields);
      else await ctx.db.insert("deployments", fields);
    }
    for (const old of prior)
      if (!a.deployments.some((d) => d.localId === old.localId))
        await ctx.db.patch(old._id, { status: "unavailable" });
    return { connectorId: c._id };
  },
});
export const claim = internalMutation({
  args: { credentialHash: v.string(), leaseId: v.string() },
  handler: async (ctx, a) => {
    const c = await credentialConnector(ctx, a.credentialHash);
    // An existing lease is never assigned to a different execution. Reconnect must reconcile it.
    for (const status of ["running", "cancelling"] as const) {
      const j = await ctx.db
        .query("workspaceJobs")
        .withIndex("by_connector_status", (q) =>
          q.eq("connectorId", c._id).eq("status", status),
        )
        .first();
      if (j)
        return {
          job: j,
          reconcile: true,
          conversation: await ctx.db.get(j.conversationId),
          deployment: await ctx.db.get(j.deploymentId),
          messages: [],
        };
    }
    const j = await ctx.db
      .query("workspaceJobs")
      .withIndex("by_connector_status", (q) =>
        q.eq("connectorId", c._id).eq("status", "queued"),
      )
      .first();
    if (!j) return null;
    const d = await ctx.db.get(j.deploymentId);
    if (!d || d.connectorId !== c._id || d.status !== "online") return null;
    const patch = {
      status: "running" as const,
      leaseId: a.leaseId,
      leaseUntil: Date.now() + 45000,
      startedAt: Date.now(),
    };
    await ctx.db.patch(j._id, patch);
    const messages = await ctx.db
      .query("workspaceMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", j.conversationId),
      )
      .order("desc")
      .take(12);
    return {
      job: { ...j, ...patch },
      reconcile: false,
      conversation: await ctx.db.get(j.conversationId),
      deployment: d,
      messages: messages
        .reverse()
        .filter((m) => !m.partial)
        .map((m) => ({ role: m.role, content: m.content })),
    };
  },
});
export const progress = internalMutation({
  args: {
    credentialHash: v.string(),
    jobId: v.id("workspaceJobs"),
    leaseId: v.string(),
    sequence: v.number(),
    content: v.string(),
    events: v.array(v.object({ tool: v.string(), status: v.string() })),
    rounds: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    status: jobState,
    error: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const c = await credentialConnector(ctx, a.credentialHash);
    const j = await ctx.db.get(a.jobId);
    if (!j || j.connectorId !== c._id || j.leaseId !== a.leaseId)
      throw new Error("Invalid execution lease.");
    if (terminal(j.status)) return { status: j.status };
    if (a.sequence <= j.lastSequence) return { status: j.status };
    if (
      a.content.length > 300000 ||
      a.events.length > 36 ||
      !["running", "completed", "failed", "cancelled", "interrupted"].includes(
        a.status,
      )
    )
      throw new Error("Invalid progress update.");
    const final = terminal(a.status);
    const status =
      j.status === "cancelling"
        ? final
          ? "cancelled"
          : "cancelling"
        : a.status;
    await ctx.db.patch(j._id, {
      lastSequence: a.sequence,
      status,
      leaseUntil: Date.now() + 45000,
      rounds: a.rounds,
      promptTokens: a.promptTokens,
      completionTokens: a.completionTokens,
      ...(final ? { finishedAt: Date.now() } : {}),
      ...(a.error ? { error: a.error.slice(0, 1000) } : {}),
    });
    const output = await ctx.db
      .query("jobOutput")
      .withIndex("by_job", (q) => q.eq("jobId", j._id))
      .unique();
    if (final) {
      if (a.content)
        await ctx.db.insert("workspaceMessages", {
          ownerId: j.ownerId,
          conversationId: j.conversationId,
          jobId: j._id,
          role: "assistant",
          content: a.content,
          partial: status !== "completed",
        });
      if (output) await ctx.db.delete(output._id);
    } else if (output)
      await ctx.db.patch(output._id, { content: a.content, events: a.events });
    else
      await ctx.db.insert("jobOutput", {
        jobId: j._id,
        content: a.content,
        events: a.events,
      });
    return { status };
  },
});
