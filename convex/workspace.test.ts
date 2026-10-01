/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, it, expect, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob("./**/*.*s");
beforeEach(() => vi.stubEnv("ALLOWED_GITHUB_USER_ID", "54899956"));
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
      githubId: "54899956",
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
