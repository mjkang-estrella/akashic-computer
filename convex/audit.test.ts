/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { AUDIT_LEASE_MS } from "./auditValues";
import {
  compactClassification,
  classifyHuggingFaceRepo,
} from "../src/lib/atlas/huggingface";

const modules = import.meta.glob("./**/*.*s");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-12T00:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function setup(owners = ["Qwen"]) {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const owner of owners)
      await ctx.db.insert("monitoredSources", {
        owner,
        ownerKey: owner.toLowerCase(),
        displayName: owner,
        enabled: true,
        role: "creator",
        familyIds: ["qwen"],
      });
  });
  const { runId } = await t.mutation(internal.sync.startDailyAudit, {
    paceMs: 5_000,
  });
  const jobs = await t.run(async (ctx) =>
    ctx.db
      .query("sourceAuditJobs")
      .withIndex("by_run_and_owner", (q) => q.eq("runId", runId))
      .take(100),
  );
  return { t, runId, jobs };
}

describe("resumable source audits", () => {
  it("completes a recovered deletion webhook for an untracked repository", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("author=")
          ? Response.json([])
          : new Response("", { status: 404 }),
      ),
    );
    const { t } = await setup();
    const eventId = await t.run((ctx) =>
      ctx.db.insert("webhookEvents", {
        dedupeKey: "deleted-unknown",
        repoId: "Qwen/unknown",
        repoName: "Qwen/unknown",
        owner: "Qwen",
        scope: "repo",
        action: "delete",
        status: "pending",
        receivedAt: Date.now() - 11 * 60_000,
      }),
    );
    expect(await t.mutation(internal.webhooks.recoverPending, {})).toEqual({
      scheduled: 1,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await t.run((ctx) => ctx.db.get(eventId))).toMatchObject({
      status: "processed",
      processedAt: expect.any(Number),
    });
    expect(
      (await t.query(api.catalog.healthSummary, { now: Date.now() }))
        .webhookStale,
    ).toBe(false);
  });

  it("rehydrates legacy ingestion once before skipping an unchanged SHA", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("author="))
        return Response.json([{ id: "Qwen/Qwen3-8B", sha: "commit" }]);
      if (url.includes("/resolve/")) return new Response("", { status: 404 });
      if (url.includes("/tree/")) return Response.json([]);
      return Response.json({
        id: "Qwen/Qwen3-8B",
        author: "Qwen",
        sha: "commit",
        pipeline_tag: "text-generation",
        siblings: [{ rfilename: "model.safetensors" }],
        safetensors: { parameters: { BF16: 8e9 } },
        cardData: { license: "apache-2.0" },
      });
    });
    vi.stubGlobal("fetch", fetch);
    const { t } = await setup();
    const repoId = await t.run((ctx) =>
      ctx.db.insert("sourceRepositories", {
        repoId: "Qwen/Qwen3-8B",
        repoName: "Qwen/Qwen3-8B",
        owner: "Qwen",
        headSha: "commit",
        private: false,
        gated: false,
        disabled: false,
        status: "published",
        missingCount: 0,
        lastSeenAt: Date.now() - 1,
      }),
    );
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect((await t.run((ctx) => ctx.db.get(repoId)))!.ingestionVersion).toBe(
      2,
    );
    await t.mutation(internal.sync.startDailyAudit, {});
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      fetch.mock.calls.filter(([url]) =>
        url.includes("/api/models/Qwen/Qwen3-8B?"),
      ),
    ).toHaveLength(1);
  });

  it("fences an expired worker when another source takes its lane", async () => {
    const { t, jobs } = await setup(["One", "Two", "Three", "Four"]);
    vi.setSystemTime(Date.now() + 30_000);
    const original = (await t.mutation(internal.audit.claimSource, {
      jobId: jobs[0]._id,
    }))!;
    vi.setSystemTime(Date.now() + AUDIT_LEASE_MS + 1);
    expect(
      await t.mutation(internal.audit.claimSource, { jobId: jobs[3]._id }),
    ).not.toBeNull();
    await t.mutation(internal.audit.checkpointPage, {
      jobId: jobs[0]._id,
      leaseToken: original.leaseToken,
      repositories: [{ id: "Four/stale", sha: "old" }],
      nextCursor: null,
    });
    expect((await t.run((ctx) => ctx.db.get(jobs[0]._id)))!.phase).toBe(
      "listing",
    );
  });

  it("continues after a poisoned repository and preserves records from an incomplete source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("author="))
          return Response.json([
            { id: "Qwen/broken", sha: "new" },
            { id: "Qwen/healthy", sha: "same" },
          ]);
        return new Response("", {
          status: 500,
          headers: { "Retry-After": "30" },
        });
      }),
    );
    const { t, runId } = await setup();
    const oldId = await t.run(async (ctx) => {
      const fields = {
        owner: "Qwen",
        private: false,
        gated: false,
        disabled: false,
        status: "skipped" as const,
        missingCount: 2,
        lastSeenAt: Date.now() - 1,
      };
      await ctx.db.insert("sourceRepositories", {
        ...fields,
        repoId: "Qwen/healthy",
        repoName: "Qwen/healthy",
        headSha: "same",
        ingestionVersion: 2,
      });
      return ctx.db.insert("sourceRepositories", {
        ...fields,
        repoId: "Qwen/old",
        repoName: "Qwen/old",
      });
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({
      status: "degraded",
      completedSources: 1,
      failed: 1,
    });
    expect((await t.run((ctx) => ctx.db.get(oldId)))!.missingCount).toBe(2);
    const healthy = await t.run((ctx) =>
      ctx.db
        .query("sourceRepositories")
        .withIndex("by_repo_name", (q) => q.eq("repoName", "Qwen/healthy"))
        .first(),
    );
    expect(healthy!.missingCount).toBe(0);
  });

  it("recovers abandoned webhooks while honoring future retry times", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => {
      const fields = {
        repoId: "Qwen/model",
        repoName: "Qwen/model",
        owner: "Qwen",
        scope: "repo.content",
        action: "update",
        status: "pending" as const,
        receivedAt: Date.now() - 11 * 60_000,
      };
      await ctx.db.insert("webhookEvents", {
        ...fields,
        dedupeKey: "abandoned",
      });
      await ctx.db.insert("webhookEvents", {
        ...fields,
        dedupeKey: "waiting",
        nextRetryAt: Date.now() + 60_000,
      });
    });
    expect(await t.mutation(internal.webhooks.recoverPending, {})).toEqual({
      scheduled: 1,
    });
    expect(await t.mutation(internal.webhooks.recoverPending, {})).toEqual({
      scheduled: 0,
    });
  });

  it("creates independent jobs, rejects duplicate starts, and finishes sources once", async () => {
    const { t, runId, jobs } = await setup(["Qwen", "Other"]);
    expect(jobs).toHaveLength(2);
    expect(await t.mutation(internal.sync.startDailyAudit, {})).toEqual({
      scheduled: false,
      runId,
    });
    const args = {
      runId,
      owner: "Qwen",
      success: true,
      now: Date.now(),
      discovered: 2,
      changed: 1,
      published: 1,
      skipped: 1,
    };
    await t.mutation(internal.sync.finishAuditSource, args);
    expect(await t.mutation(internal.sync.finishAuditSource, args)).toBeNull();
    const run = await t.run((ctx) => ctx.db.get(runId));
    expect(run).toMatchObject({
      status: "running",
      completedSources: 1,
      discovered: 2,
    });
    await t.mutation(internal.sync.finishAuditSource, {
      ...args,
      owner: "Other",
      success: false,
      message: "Upstream unavailable",
    });
    expect(
      (await t.query(api.catalog.healthSummary, { now: Date.now() }))
        .freshSourceCount,
    ).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({
      status: "degraded",
      completedSources: 2,
      failed: 1,
    });
  });

  it("recovers expired leases and rejects stale checkpoint writes", async () => {
    const { t, jobs } = await setup();
    const jobId = jobs[0]._id;
    const claim = (await t.mutation(internal.audit.claimSource, { jobId }))!;
    expect(await t.mutation(internal.audit.claimSource, { jobId })).toBeNull();
    vi.setSystemTime(Date.now() + AUDIT_LEASE_MS + 1);
    const recovered = (await t.mutation(internal.audit.claimSource, {
      jobId,
    }))!;
    expect(recovered.leaseToken).toBeGreaterThan(claim.leaseToken);
    await t.mutation(internal.audit.checkpointPage, {
      jobId,
      leaseToken: claim.leaseToken,
      repositories: [{ id: "Qwen/stale", sha: "s" }],
      nextCursor: null,
    });
    expect((await t.run((ctx) => ctx.db.get(jobId)))!.repositories).toEqual([]);
    await t.mutation(internal.audit.checkpointPage, {
      jobId,
      leaseToken: recovered.leaseToken,
      repositories: [{ id: "Qwen/model", sha: "s" }],
      nextCursor: null,
    });
    expect((await t.run((ctx) => ctx.db.get(jobId)))!.repositories[0].id).toBe(
      "Qwen/model",
    );
  });

  it("bounds concurrent upstream work across independently scheduled sources", async () => {
    const { t, jobs } = await setup(["One", "Two", "Three", "Four"]);
    vi.setSystemTime(Date.now() + 30_000);
    for (const job of jobs.slice(0, 3))
      expect(
        await t.mutation(internal.audit.claimSource, { jobId: job._id }),
      ).not.toBeNull();
    expect(
      await t.mutation(internal.audit.claimSource, { jobId: jobs[3]._id }),
    ).toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.get(jobs[3]._id)))!.nextWakeAt,
    ).toBeGreaterThan(Date.now());
  });

  it("does not count the same audit miss twice or remove a repository seen by a newer update", async () => {
    const { t, runId } = await setup();
    const startedAt = Date.now();
    const repoId = await t.run((ctx) =>
      ctx.db.insert("sourceRepositories", {
        repoId: "Qwen/old",
        repoName: "Qwen/old",
        owner: "Qwen",
        private: false,
        gated: false,
        disabled: false,
        status: "skipped",
        missingCount: 0,
        lastSeenAt: startedAt - 1,
      }),
    );
    const args = {
      repoName: "Qwen/old",
      explicit: false,
      now: Date.now(),
      runId,
      auditStartedAt: startedAt,
    };
    await t.mutation(internal.sync.removeRepository, args);
    await t.mutation(internal.sync.removeRepository, args);
    expect((await t.run((ctx) => ctx.db.get(repoId)))!.missingCount).toBe(1);
    await t.run((ctx) =>
      ctx.db.patch(repoId, {
        lastMissingAuditId: undefined,
        lastSeenAt: startedAt + 1,
      }),
    );
    await t.mutation(internal.sync.removeRepository, args);
    expect((await t.run((ctx) => ctx.db.get(repoId)))!.missingCount).toBe(1);
  });

  it("commits ingestion and progress atomically, making a checkpoint replay harmless", async () => {
    const { t, runId, jobs } = await setup();
    const jobId = jobs[0]._id;
    const claim = (await t.mutation(internal.audit.claimSource, { jobId }))!;
    await t.mutation(internal.audit.checkpointPage, {
      jobId,
      leaseToken: claim.leaseToken,
      repositories: [{ id: "Qwen/Qwen3-8B", sha: "commit" }],
      nextCursor: null,
    });
    const repoClaim = (await t.mutation(internal.audit.claimSource, {
      jobId,
    }))!;
    const classification = compactClassification(
      classifyHuggingFaceRepo(
        {
          id: "Qwen/Qwen3-8B",
          author: "Qwen",
          sha: "commit",
          pipeline_tag: "text-generation",
          siblings: [{ rfilename: "model.safetensors" }],
          safetensors: { parameters: { BF16: 8e9 } },
          cardData: { license: "apache-2.0" },
        },
        { owner: "Qwen", role: "creator", familyIds: ["qwen"] },
      ),
    );
    const args = {
      jobId,
      leaseToken: repoClaim.leaseToken,
      repoName: "Qwen/Qwen3-8B",
      classification,
    };
    await t.mutation(internal.audit.applyRepository, args);
    await t.mutation(internal.audit.applyRepository, args);
    const job = (await t.run((ctx) => ctx.db.get(jobId)))!;
    expect(job).toMatchObject({
      phase: "missing",
      counters: { changed: 1, published: 1 },
    });
    expect(
      await t.run(async (ctx) => ctx.db.query("catalogEntries").take(10)),
    ).toHaveLength(1);
    await t.mutation(internal.sync.cancelRunningAudit, {
      reason: "Operator cancelled",
      now: Date.now(),
    });
    expect(
      await t.mutation(internal.sync.finishAuditSource, {
        runId,
        owner: "Qwen",
        success: true,
        discovered: 1,
        changed: 1,
        published: 1,
        skipped: 0,
        now: Date.now(),
      }),
    ).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(runId)))!.completedSources).toBe(0);
  });

  it("continues a healthy source while another retries, without repeating its listing", async () => {
    const calls: string[] = [];
    let failures = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes("author=Other") && failures++ === 0)
          return new Response("", {
            status: 429,
            headers: { "Retry-After": "30" },
          });
        return Response.json([]);
      }),
    );
    const { t, runId } = await setup(["Qwen", "Other"]);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({
      status: "success",
      completedSources: 2,
      retries: 1,
    });
    expect(calls.filter((url) => url.includes("author=Qwen"))).toHaveLength(1);
    expect(calls.filter((url) => url.includes("author=Other"))).toHaveLength(2);
    expect(
      (await t.query(api.catalog.healthSummary, { now: Date.now() })).level,
    ).toBe("healthy");
  });

  it("upgrades a legacy audit instead of allowing it to block all future runs", async () => {
    const t = convexTest(schema, modules);
    const oldId = await t.run((ctx) =>
      ctx.db.insert("syncRuns", {
        kind: "audit",
        status: "running",
        startedAt: Date.now(),
        discovered: 0,
        changed: 0,
        published: 0,
        skipped: 0,
        failed: 0,
        retries: 0,
      }),
    );
    const replacement = await t.mutation(internal.sync.startDailyAudit, {});
    expect(replacement.scheduled).toBe(true);
    expect(
      (await t.run((ctx) => ctx.db.get(oldId)))!.cancelledAt,
    ).toBeDefined();
  });
});
