/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { classifyHuggingFaceRepo } from "../src/lib/atlas/huggingface";
import { MODEL_ENTRIES } from "../src/lib/atlas/models";
import { publishableEntry } from "../src/lib/atlas/published";

const modules = import.meta.glob("./**/*.*s");

async function monitoredTest() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("monitoredSources", {
      owner: "Qwen",
      ownerKey: "qwen",
      displayName: "Qwen",
      role: "creator",
      enabled: true,
      familyIds: ["qwen"],
    });
  });
  return t;
}

describe("webhook ingestion", () => {
  beforeEach(() => {
    process.env.HF_WEBHOOK_SECRET = "test-secret";
  });

  it("rejects an invalid secret before accepting the body", async () => {
    const t = await monitoredTest();
    const response = await t.fetch("/webhooks/huggingface", {
      method: "POST",
      headers: { "X-Webhook-Secret": "wrong", "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(response.status).toBe(401);
  });

  it("accepts the previous secret during rotation", async () => {
    process.env.HF_WEBHOOK_SECRET_PREVIOUS = "previous-secret";
    const t = await monitoredTest();
    const response = await t.fetch("/webhooks/huggingface", {
      method: "POST",
      headers: { "X-Webhook-Secret": "previous-secret", "Content-Type": "application/json" },
      body: JSON.stringify({
        event: { scope: "repo", action: "update" },
        repo: { id: "stable", name: "qwen/Qwen3-8B", type: "model", headSha: "sha" },
      }),
    });
    expect(response.status).toBe(202);
    delete process.env.HF_WEBHOOK_SECRET_PREVIOUS;
  });

  it("accepts a signed main-branch delivery and ignores pull-request-only activity", async () => {
    const t = await monitoredTest();
    const payload = {
      event: { scope: "repo.content", action: "update" },
      repo: { id: "stable", name: "Qwen/Qwen3-8B", type: "model", headSha: "sha" },
      updatedRefs: [{ ref: "refs/heads/main", newSha: "sha" }],
    };
    const response = await t.fetch("/webhooks/huggingface", {
      method: "POST",
      headers: { "X-Webhook-Secret": "test-secret", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, status: "accepted" });

    const ignored = await t.fetch("/webhooks/huggingface", {
      method: "POST",
      headers: { "X-Webhook-Secret": "test-secret", "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, updatedRefs: [{ ref: "refs/pull/8/head", newSha: "pr" }] }),
    });
    expect(ignored.status).toBe(202);
    expect(await ignored.json()).toMatchObject({ accepted: false, status: "ignored" });
  });

  it("accepts a valid delivery and makes a replay an idempotent no-op", async () => {
    const t = await monitoredTest();
    const args = {
      dedupeKey: "stable:repo:update:sha",
      repoId: "stable",
      repoName: "Qwen/Qwen3-8B",
      owner: "Qwen",
      scope: "repo",
      action: "update",
      headSha: "sha",
      payload: {},
      receivedAt: 1_000,
    };
    expect(await t.mutation(internal.webhooks.receive, args)).toMatchObject({ status: "accepted" });
    expect(await t.mutation(internal.webhooks.receive, { ...args, receivedAt: 2_000 })).toMatchObject({ status: "duplicate" });
    const events = await t.run(async (ctx) => await ctx.db.query("webhookEvents").collect());
    expect(events).toHaveLength(1);
    const state = await t.run(async (ctx) => await ctx.db.query("catalogState").first());
    expect(state?.lastWebhookAt).toBe(2_000);
  });

  it("coalesces a burst by stable repository ID and retains the newest event", async () => {
    const t = await monitoredTest();
    const first = {
      dedupeKey: "stable:repo:update:a",
      repoId: "stable",
      repoName: "Qwen/Qwen3-8B",
      owner: "Qwen",
      scope: "repo",
      action: "update",
      headSha: "a",
      payload: {},
      receivedAt: 1_000,
    };
    await t.mutation(internal.webhooks.receive, first);
    expect(await t.mutation(internal.webhooks.receive, {
      ...first,
      dedupeKey: "stable:repo:delete:b",
      repoName: "Qwen/Qwen3-Renamed-8B",
      action: "delete",
      headSha: "b",
      receivedAt: 15_000,
    })).toMatchObject({ status: "coalesced" });
    expect(await t.mutation(internal.webhooks.receive, { ...first, dedupeKey: "other", owner: "unknown", repoName: "unknown/model" })).toMatchObject({ status: "unmonitored" });
    const events = await t.run(async (ctx) => await ctx.db.query("webhookEvents").collect());
    expect(events).toHaveLength(2);
    expect(events.find((event) => event.status === "pending")).toMatchObject({
      repoName: "Qwen/Qwen3-Renamed-8B",
      action: "delete",
      headSha: "b",
      receivedAt: 15_000,
    });
  });

  it("retains a delete tombstone and removes only the unavailable artifact", async () => {
    const t = await monitoredTest();
    const entry = MODEL_ENTRIES.find((candidate) => candidate.artifacts.length > 1)!;
    const removedRepo = entry.artifacts[0].repo;
    await t.run(async (ctx) => {
      await ctx.db.insert("sourceRepositories", {
        repoId: removedRepo,
        repoName: removedRepo,
        owner: removedRepo.split("/")[0],
        aliases: [],
        private: false,
        gated: false,
        disabled: false,
        tags: [],
        files: [],
        baseModels: [],
        status: "published",
        missingCount: 0,
        lastSeenAt: 1,
      });
      await ctx.db.insert("catalogEntries", {
        slug: entry.slug,
        familyId: entry.family.id,
        releaseId: entry.release.id,
        sizeLabel: entry.size.label,
        sourceRepos: entry.artifacts.map((artifact) => artifact.repo),
        updatedAt: entry.timestamp,
        payload: publishableEntry(entry),
        publishedAt: 1,
        sourceRevision: "seed",
      });
    });
    expect(await t.mutation(internal.sync.removeRepository, {
      repoName: removedRepo,
      explicit: true,
      now: 2,
    })).toEqual({ removed: true });
    const state = await t.run(async (ctx) => ({
      source: await ctx.db.query("sourceRepositories").first(),
      entry: await ctx.db.query("catalogEntries").first(),
    }));
    expect(state.source).toMatchObject({ status: "missing", missingCount: 3 });
    expect((state.entry!.payload as { artifacts: Array<{ repo: string }> }).artifacts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ repo: removedRepo })]),
    );
  });

  it("applies protected catalog overrides after automatic metadata", async () => {
    const t = await monitoredTest();
    const entry = MODEL_ENTRIES.find((candidate) =>
      candidate.artifacts.some((artifact) => artifact.repo === "Qwen/Qwen3-8B"),
    )!;
    const payload = publishableEntry(entry);
    const runId = await t.run(async (ctx) => {
      await ctx.db.insert("catalogEntries", {
        slug: entry.slug,
        familyId: entry.family.id,
        releaseId: entry.release.id,
        sizeLabel: entry.size.label,
        sourceRepos: entry.artifacts.map((artifact) => artifact.repo),
        updatedAt: entry.timestamp,
        payload,
        publishedAt: 1,
        sourceRevision: "seed",
      });
      await ctx.db.insert("catalogOverrides", {
        entityType: "catalog_entry",
        entityKey: entry.slug,
        patch: { name: "Protected model name" },
        reason: "test operator correction",
        updatedAt: 1,
      });
      return await ctx.db.insert("syncRuns", {
        kind: "webhook",
        status: "running",
        startedAt: 1,
        discovered: 1,
        changed: 0,
        published: 0,
        skipped: 0,
        failed: 0,
        retries: 0,
      });
    });
    const raw = {
      id: "Qwen/Qwen3-8B",
      author: "Qwen",
      sha: "new-sha",
      lastModified: "2026-07-20T00:00:00Z",
      pipeline_tag: "text-generation",
      tags: ["license:apache-2.0"],
      siblings: [{ rfilename: "model.safetensors" }],
      safetensors: { parameters: { BF16: 8_000_000_000 } },
      cardData: { license: "apache-2.0" },
      config: { max_position_embeddings: 32768 },
    };
    const classification = classifyHuggingFaceRepo(raw, {
      owner: "Qwen",
      role: "creator",
      familyIds: ["qwen"],
    });
    await t.mutation(internal.sync.applyRepoResult, {
      classification,
      sourceOwner: "Qwen",
      repoKey: "stable-qwen-8b",
      runId,
      now: 2,
    });
    const published = await t.query(api.catalog.getBySlug, { slug: entry.slug });
    expect(published).toMatchObject({ name: "Protected model name" });
  });

  it("records health alerts only on state transitions", async () => {
    const t = convexTest(schema, modules);
    const staleCheck = {
      checks: [{ kind: "catalog_stale" as const, stale: true, message: "stale" }],
      now: 100,
    };
    expect(await t.mutation(internal.health.recordHealth, staleCheck)).toEqual({
      activated: [{ kind: "catalog_stale", message: "stale" }],
      resolved: [],
    });
    expect(await t.mutation(internal.health.recordHealth, { ...staleCheck, now: 200 })).toEqual({
      activated: [],
      resolved: [],
    });
    expect(await t.mutation(internal.health.recordHealth, {
      checks: [{ kind: "catalog_stale", stale: false, message: "healthy" }],
      now: 300,
    })).toEqual({
      activated: [],
      resolved: [{ kind: "catalog_stale", message: "healthy" }],
    });
  });
});
