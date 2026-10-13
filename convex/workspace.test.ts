/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, it, expect, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob("./**/*.*s");
beforeEach(() => { vi.stubEnv("ALLOWED_GITHUB_USER_ID", "54899956"); vi.stubEnv("WORKSPACE_ACCESS_MODE", "github"); });
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { name: "Owner" });
    const other = await ctx.db.insert("users", { name: "Other" });
    await ctx.db.insert("accountOwners", {
      userId: owner,
      githubId: "54899956",
    });
    await ctx.db.insert("accountOwners", {
      userId: other,
      githubId: "99999999",
    });
    const connector = await ctx.db.insert("connectors", {
      ownerId: owner,
      name: "Mac",
      credentialHash: "a".repeat(64),
      lastSeenAt: Date.now(),
    });
    const second = await ctx.db.insert("connectors", {
      ownerId: other,
      name: "Other",
      credentialHash: "b".repeat(64),
      lastSeenAt: Date.now(),
    });
    const deployment = await ctx.db.insert("deployments", {
      ownerId: owner,
      connectorId: connector,
      localId: "local-model",
      model: "local-model",
      status: "online",
      observedAt: Date.now(),
    });
    return { owner, other, connector, second, deployment };
  });
  return {
    t,
    ids,
    owner: t.withIdentity({ subject: ids.owner + "|session" }),
    other: t.withIdentity({ subject: ids.other + "|other-session" }),
  };
}
describe("account workspace", () => {
  it("requires login and isolates account data", async () => {
    const { t, owner, other, ids } = await setup();
    await expect(t.query(api.workspace.overview, {})).rejects.toThrow();
    expect(
      (await owner.query(api.workspace.overview, {})).connectors,
    ).toHaveLength(1);
    const id = await owner.mutation(api.workspace.createConversation, {
      deploymentId: ids.deployment,
      mode: "chat",
    });
    await expect(
      other.query(api.workspace.getConversation, { id }),
    ).rejects.toThrow(/not found/);
  });
  it("denies accounts after allowlist changes", async () => {
    const { owner } = await setup();
    vi.stubEnv("WORKSPACE_ACCESS_MODE", "single_owner");
    vi.stubEnv("ALLOWED_GITHUB_USER_ID", "another");
    await expect(owner.query(api.workspace.overview, {})).rejects.toThrow(
      /not allowed/,
    );
  });
  it("enrollment requires owner approval and rejects reuse and expiry", async () => {
    const { t, owner, other } = await setup();
    const hash = "c".repeat(64);
    await owner.mutation(api.workspace.beginEnrollment, { codeHash: hash });
    const id = await t.mutation(internal.connector.enroll, {
      codeHash: hash,
      credentialHash: "d".repeat(64),
      name: "Laptop",
    });
    expect(
      (
        await t.query(internal.connector.enrollmentStatus, {
          id,
          credentialHash: "d".repeat(64),
        })
      ).status,
    ).toBe("pending");
    await expect(
      other.mutation(api.workspace.approveEnrollment, { codeHash: hash }),
    ).rejects.toThrow();
    await owner.mutation(api.workspace.approveEnrollment, { codeHash: hash });
    await expect(
      owner.mutation(api.workspace.approveEnrollment, { codeHash: hash }),
    ).rejects.toThrow();
    await owner.mutation(api.workspace.beginEnrollment, {
      codeHash: "e".repeat(64),
    });
    await t.run(async (ctx) => {
      const e = await ctx.db
        .query("enrollments")
        .withIndex("by_code", (q) => q.eq("codeHash", "e".repeat(64)))
        .unique();
      await ctx.db.patch(e!._id, { expiresAt: 0 });
    });
    await expect(
      t.mutation(internal.connector.enroll, {
        codeHash: "e".repeat(64),
        credentialHash: "f".repeat(64),
        name: "Expired",
      }),
    ).rejects.toThrow();
  });
  it("deduplicates requests, never reassigns a lease, and confines progress", async () => {
    const { t, owner, ids } = await setup();
    const id = await owner.mutation(api.workspace.createConversation, {
      deploymentId: ids.deployment,
      mode: "agent",
    });
    const args = {
      conversationId: id,
      text: "Inspect",
      key: "request-one",
      maxTokens: 512,
    };
    const job = await owner.mutation(api.workspace.submitJob, args);
    expect(await owner.mutation(api.workspace.submitJob, args)).toBe(job);
    await expect(
      owner.mutation(api.workspace.submitJob, { ...args, text: "Other" }),
    ).rejects.toThrow();
    const first = await t.mutation(internal.connector.claim, {
      credentialHash: "a".repeat(64),
      leaseId: "lease-first",
    });
    const second = await t.mutation(internal.connector.claim, {
      credentialHash: "a".repeat(64),
      leaseId: "lease-second",
    });
    expect(second!.job.leaseId).toBe(first!.job.leaseId);
    expect(second!.reconcile).toBe(true);
    await expect(
      t.mutation(internal.connector.progress, {
        credentialHash: "b".repeat(64),
        jobId: job,
        leaseId: "lease-first",
        sequence: 1,
        content: "bad",
        events: [],
        rounds: 1,
        promptTokens: 1,
        completionTokens: 1,
        status: "completed",
      }),
    ).rejects.toThrow();
  });
  it.each(["unavailable", "missing", "other-connector"])("retires a queued job with a %s deployment so later jobs can run", async (state) => {
    const { t, owner, ids } = await setup();
    const conversationId = await owner.mutation(api.workspace.createConversation, {
      deploymentId: ids.deployment, mode: "chat",
    });
    const blocked = await owner.mutation(api.workspace.submitJob, {
      conversationId, text: "First", key: "unavailable-first", maxTokens: 512,
    });
    const online = await t.run(async (ctx) => {
      const id = await ctx.db.insert("deployments", {
        ownerId: ids.owner, connectorId: ids.connector, localId: "online-model",
        model: "online-model", status: "online", observedAt: Date.now(),
      });
      if (state === "missing") await ctx.db.delete(ids.deployment);
      else await ctx.db.patch(ids.deployment, state === "unavailable"
        ? { status: "unavailable" } : { connectorId: ids.second });
      return id;
    });
    const nextConversation = await owner.mutation(api.workspace.createConversation, {
      deploymentId: online, mode: "chat",
    });
    const next = await owner.mutation(api.workspace.submitJob, {
      conversationId: nextConversation, text: "Next", key: "online-next", maxTokens: 512,
    });
    const args = { credentialHash: "a".repeat(64), leaseId: "next-lease" };
    expect(await t.mutation(internal.connector.claim, args)).toBeNull();
    const failed = await t.run((ctx) => ctx.db.get(blocked));
    expect(failed).toMatchObject({ status: "failed", error: expect.stringContaining("unavailable"), finishedAt: expect.any(Number) });
    expect(failed?.leaseId).toBeUndefined();
    const claimed = await t.mutation(internal.connector.claim, args);
    expect(claimed?.job._id).toBe(next);
    expect(claimed?.job.status).toBe("running");
    expect(claimed?.reconcile).toBe(false);
  });
  it("cancellation wins against late completion and completion is idempotent", async () => {
    const { t, owner, ids } = await setup();
    const id = await owner.mutation(api.workspace.createConversation, {
      deploymentId: ids.deployment,
      mode: "chat",
    });
    const job = await owner.mutation(api.workspace.submitJob, {
      conversationId: id,
      text: "Hello",
      key: "request-cancel",
      maxTokens: 512,
    });
    await t.mutation(internal.connector.claim, {
      credentialHash: "a".repeat(64),
      leaseId: "lease",
    });
    await owner.mutation(api.workspace.cancelJob, { id: job });
    const a = {
      credentialHash: "a".repeat(64),
      jobId: job,
      leaseId: "lease",
      sequence: 1,
      content: "partial",
      events: [],
      rounds: 1,
      promptTokens: 5,
      completionTokens: 5,
      status: "completed" as const,
    };
    expect((await t.mutation(internal.connector.progress, a)).status).toBe(
      "cancelled",
    );
    await t.mutation(internal.connector.progress, a);
    const result = await owner.query(api.workspace.getConversation, { id });
    expect(result.messages.filter((m) => m.role === "assistant")).toHaveLength(
      1,
    );
    expect(result.messages.at(-1)?.partial).toBe(true);
  });
  it("revocation prevents heartbeat, claims, and desktop account access", async () => {
    const { t, owner, ids } = await setup();
    await owner.mutation(api.workspace.revokeConnector, { id: ids.connector });
    await expect(
      t.mutation(internal.connector.claim, {
        credentialHash: "a".repeat(64),
        leaseId: "lease",
      }),
    ).rejects.toThrow(/revoked/);
    await expect(
      t.mutation(internal.connector.heartbeat, {
        credentialHash: "a".repeat(64),
        devices: [],
        deployments: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.query(internal.connectorClient.read, {
        credentialHash: "a".repeat(64),
        operation: "sessions",
      }),
    ).rejects.toThrow();
  });
  it("desktop connector cannot access another connector's conversation", async () => {
    const { t, owner, ids } = await setup();
    const id = await owner.mutation(api.workspace.createConversation, {
      deploymentId: ids.deployment,
      mode: "chat",
    });
    await expect(
      t.query(internal.connectorClient.read, {
        credentialHash: "b".repeat(64),
        operation: "session",
        conversationId: id,
      }),
    ).rejects.toThrow();
  });
});

describe("controller relocation", () => {
  it("renames the connector while retaining account and deployment identities", async () => {
    const { t, ids } = await setup();
    await t.mutation(internal.connector.heartbeat, {
      credentialHash: "a".repeat(64),
      name: "ZimaBoard controller",
      devices: [],
      deployments: [
        { localId: "local-model", model: "local-model", status: "online" },
      ],
    });
    const result = await t.query(internal.connectorClient.read, {
      credentialHash: "a".repeat(64),
      operation: "overview",
    });
    expect(result).toMatchObject({
      connectors: [{ id: ids.connector, name: "ZimaBoard controller" }],
      deployments: [{ _id: ids.deployment }],
    });
  });
  it("delegates atomically, deduplicates retries, and confines results and cancellation", async () => {
    const { t, owner } = await setup();
    const request = {
      credentialHash: "a".repeat(64),
      operation: "delegate" as const,
      text: "Inspect Zima",
      key: "delegation-test",
      maxTokens: 512,
    };
    const first = await t.mutation(internal.connectorClient.write, request);
    expect(await t.mutation(internal.connectorClient.write, request)).toEqual(
      first,
    );
    await expect(
      t.mutation(internal.connectorClient.write, {
        ...request,
        text: "Changed",
      }),
    ).rejects.toThrow(/conflict/);
    const claim = await t.mutation(internal.connector.claim, {
      credentialHash: request.credentialHash,
      leaseId: "zima-lease",
    });
    const jobId = claim!.job._id;
    await expect(
      t.query(internal.connectorClient.read, {
        credentialHash: "b".repeat(64),
        operation: "job",
        jobId,
      }),
    ).rejects.toThrow(/not found/);
    await expect(
      t.mutation(internal.connectorClient.write, {
        credentialHash: "b".repeat(64),
        operation: "cancel",
        jobId,
      }),
    ).rejects.toThrow(/not found/);
    await t.mutation(internal.connector.progress, {
      credentialHash: request.credentialHash,
      jobId,
      leaseId: "zima-lease",
      sequence: 1,
      content: "Zima observed",
      events: [],
      rounds: 2,
      promptTokens: 15,
      completionTokens: 20,
      status: "completed",
    });
    expect(
      await t.query(internal.connectorClient.read, {
        credentialHash: request.credentialHash,
        operation: "job",
        jobId,
      }),
    ).toMatchObject({
      id: `cloud:${jobId}`,
      status: "succeeded",
      output: "Zima observed",
      usage: { prompt_tokens: 15, completion_tokens: 20 },
    });
    expect(await owner.query(api.workspace.listConversations, {})).toHaveLength(
      1,
    );
  });
});

describe("workspace I/O isolation", () => {
  it("keeps inventory documents unchanged on repeated and presence-only heartbeats", async () => {
    const { t, owner, ids } = await setup();
    const args = { credentialHash: "a".repeat(64), devices: [{ localId: "device", name: "Mac", role: "controller", state: "observed", status: "online", observedAt: 10 }],
      deployments: [{ localId: "local-model", model: "local-model", status: "online" }] };
    await t.mutation(internal.connector.heartbeat, args);
    const before = await owner.query(api.workspace.inventory, {});
    await t.mutation(internal.connector.heartbeat, { ...args, devices: [{ ...args.devices[0], observedAt: 20 }] });
    expect(await owner.query(api.workspace.inventory, {})).toEqual(before);
    await t.mutation(internal.connector.heartbeat, { credentialHash: args.credentialHash });
    expect(await owner.query(api.workspace.inventory, {})).toEqual(before);
    expect((await owner.query(api.workspace.connectorPresence, {}))[0].id).toBe(ids.connector);
    await t.mutation(internal.connector.heartbeat, { ...args, devices: [], deployments: [] });
    const removed = await owner.query(api.workspace.inventory, {});
    expect(removed.devices[0].status).toBe("not-reported");
    expect(removed.deployments[0].status).toBe("unavailable");
  });

  it("paginates history separately, protects new queries, and preserves output on keepalive", async () => {
    const { t, owner, other, ids } = await setup();
    const id = await owner.mutation(api.workspace.createConversation, { deploymentId: ids.deployment, mode: "chat" });
    const jobId = await owner.mutation(api.workspace.submitJob, { conversationId: id, text: "hello", key: "io-isolation", maxTokens: 512 });
    await t.mutation(internal.connector.claim, { credentialHash: "a".repeat(64), leaseId: "io-lease" });
    await t.run(async ctx => {
      for (let i = 0; i < 65; i++) await ctx.db.insert("workspaceMessages", {
        ownerId: ids.owner, conversationId: id, jobId, role: "user", content: `history-${i}`, partial: false,
      });
    });
    const paginationOpts = { cursor: null, numItems: 30 };
    const first = await owner.query(api.workspace.conversationMessages, { id, paginationOpts });
    expect(first.page).toHaveLength(30);
    expect(first.isDone).toBe(false);
    const second = await owner.query(api.workspace.conversationMessages, { id, paginationOpts: { cursor: first.continueCursor, numItems: 30 } });
    expect(second.page).toHaveLength(30);
    expect(new Set([...first.page, ...second.page].map(m => m._id)).size).toBe(60);
    const progress = { credentialHash: "a".repeat(64), jobId, leaseId: "io-lease", sequence: 1,
      content: "streamed text", events: [{ tool: "inspect", status: "done" }], rounds: 1, promptTokens: 2, completionTokens: 3, status: "running" as const };
    await t.mutation(internal.connector.progress, progress);
    const keepalive = { ...progress, content: undefined, events: undefined };
    await t.mutation(internal.connector.progress, { ...keepalive, sequence: 2 });
    expect((await owner.query(api.workspace.conversationProgress, { id })).progress[0]).toMatchObject({ content: "streamed text", events: progress.events });
    expect(await owner.query(api.workspace.conversationMessages, { id, paginationOpts })).toEqual(first);
    await expect(other.query(api.workspace.conversationMessages, { id, paginationOpts })).rejects.toThrow(/not found/);
    await expect(other.query(api.workspace.conversationProgress, { id })).rejects.toThrow(/not found/);
    await expect(other.query(api.workspace.conversationInfo, { id })).rejects.toThrow(/not found/);
    expect((await other.query(api.workspace.inventory, {})).devices).toHaveLength(0);
    await expect(t.mutation(internal.connector.progress, { ...keepalive, sequence: 3, status: "completed" })).rejects.toThrow(/Final output required/);
    await t.mutation(internal.connector.progress, { ...progress, sequence: 3, status: "completed" });
    expect((await owner.query(api.workspace.conversationProgress, { id })).progress).toHaveLength(0);
    expect((await owner.query(api.workspace.conversationMessages, { id, paginationOpts })).page[0].content).toBe("streamed text");
  });
});

it("presence-only heartbeats write one document regardless of inventory size", async () => {
  const { t } = await setup();
  const full = {
    credentialHash: "a".repeat(64),
    devices: Array.from({ length: 80 }, (_, i) => ({ localId: `device-${i}`, name: `Device ${i}`, role: "worker", state: "observed", status: "online" })),
    deployments: [],
  };
  await t.mutation(internal.connector.heartbeat, full);
  const presence = await t.mutation(async ctx => {
    await ctx.runMutation(internal.connector.heartbeat, { credentialHash: full.credentialHash });
    return ctx.meta.getTransactionMetrics();
  });
  expect(presence.documentsWritten.used).toBe(1);
  expect(presence.documentsRead.used).toBeLessThan(5);
  const unchanged = await t.mutation(async ctx => {
    await ctx.runMutation(internal.connector.heartbeat, full);
    return ctx.meta.getTransactionMetrics();
  });
  expect(unchanged.documentsWritten.used).toBe(1);
});

it("retires large historical inventories in pages without overwriting a newer report", async () => {
  vi.useFakeTimers();
  try {
    const { t, ids } = await setup();
    await t.run(async ctx => {
      for (let i = 0; i < 205; i++) await ctx.db.insert("devices", {
        ownerId: ids.owner, connectorId: ids.connector, localId: `old-${i}`, name: `Old ${i}`, role: "worker", state: "observed", status: "online",
      });
    });
    await t.mutation(internal.connector.heartbeat, { credentialHash: "a".repeat(64), devices: [] });
    await t.mutation(internal.connector.heartbeat, { credentialHash: "a".repeat(64), devices: [
      { localId: "old-204", name: "Returned", role: "worker", state: "observed", status: "online" },
    ] });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const devices = await t.run(ctx => ctx.db.query("devices").collect());
    expect(devices.filter(d => d.status === "online").map(d => d.localId)).toEqual(["old-204"]);
    expect(devices).toHaveLength(205);
  } finally { vi.useRealTimers(); }
});
