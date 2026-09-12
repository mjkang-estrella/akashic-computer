import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  matchesSourceRules,
  normalizeHuggingFaceRepo,
  compactClassification,
  normalizeOwnerKey,
} from "../src/lib/atlas/huggingface";
import {
  classifyWithWeightMetadata,
  fetchRepo,
  listReposPage,
  retryDelayForError,
} from "./huggingFaceClient";
import { sourceRule } from "./catalogReconciliation";
import { completeAuditSource, createAudit } from "./auditState";
import { ingestRepository } from "./catalogIngestion";
import { ingestionClassificationValue } from "./catalogValues";
import {
  AUDIT_LEASE_MS,
  AUDIT_MAX_ATTEMPTS,
  AUDIT_MAX_PAGES,
  AUDIT_PAGE_SIZE,
  AUDIT_REPO_PACE_MS,
  auditRepositoryValue,
  sourceAuditJobValue,
  AUDIT_CONCURRENCY,
  AUDIT_CAPACITY_DELAY_MS,
} from "./auditValues";

const leaseArgs = { jobId: v.id("sourceAuditJobs"), leaseToken: v.number() };

async function activeJob(
  ctx: MutationCtx,
  jobId: Id<"sourceAuditJobs">,
  leaseToken: number,
) {
  const job = await ctx.db.get(jobId);
  if (!job || job.status !== "running" || job.leaseToken !== leaseToken)
    return null;
  const run = await ctx.db.get(job.runId);
  return run?.status === "running" ? job : null;
}

async function continueJob(
  ctx: MutationCtx,
  job: Doc<"sourceAuditJobs">,
  patch: Partial<Doc<"sourceAuditJobs">>,
  delay = 0,
) {
  const nextWakeAt = Date.now() + delay;
  await ctx.db.patch(job._id, {
    ...patch,
    status: "pending",
    nextWakeAt,
    attempt: 0,
  });
  // The checkpoint and its continuation commit together.
  await ctx.scheduler.runAt(nextWakeAt, internal.audit.processSource, {
    jobId: job._id,
  });
}

async function completeJob(
  ctx: MutationCtx,
  job: Doc<"sourceAuditJobs">,
  error?: string,
) {
  const success = !error && job.counters.failed === 0;
  const now = Date.now();
  await ctx.db.patch(job._id, {
    status: success ? "success" : "failed",
    completedAt: now,
    ...(error ? { lastError: error } : {}),
  });
  await completeAuditSource(ctx, {
    runId: job.runId,
    owner: job.owner,
    success,
    now,
    discovered: job.counters.discovered,
    changed: job.counters.changed,
    published: job.counters.published,
    skipped: job.counters.skipped,
    retries: job.counters.retries,
    message:
      error ??
      (success
        ? undefined
        : `${job.counters.failed} repositories failed; ${job.lastError ?? "inspect source job"}`),
  });
}

export const claimSource = internalMutation({
  args: { jobId: v.id("sourceAuditJobs") },
  returns: v.union(v.null(), sourceAuditJobValue),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    const now = Date.now();
    if (
      !job ||
      !["pending", "running"].includes(job.status) ||
      job.nextWakeAt > now
    )
      return null;
    const run = await ctx.db.get(job.runId);
    if (!run || run.status !== "running") {
      await ctx.db.patch(jobId, {
        status: "failed",
        completedAt: now,
        lastError: "Audit is no longer active",
      });
      return null;
    }
    const active = await ctx.db
      .query("sourceAuditJobs")
      .withIndex("by_run_and_status_and_next_wake", (q) =>
        q.eq("runId", job.runId).eq("status", "running").gt("nextWakeAt", now),
      )
      .take(AUDIT_CONCURRENCY);
    if (active.length >= AUDIT_CONCURRENCY) {
      await ctx.db.patch(jobId, {
        status: "pending",
        nextWakeAt: now + AUDIT_CAPACITY_DELAY_MS,
      });
      await ctx.scheduler.runAfter(
        AUDIT_CAPACITY_DELAY_MS,
        internal.audit.processSource,
        { jobId },
      );
      return null;
    }
    const patch = {
      status: "running" as const,
      nextWakeAt: now + AUDIT_LEASE_MS,
      leaseToken: job.leaseToken + 1,
    };
    await ctx.db.patch(jobId, patch);
    return { ...job, ...patch };
  },
});

export const checkpointPage = internalMutation({
  args: {
    ...leaseArgs,
    repositories: v.array(auditRepositoryValue),
    nextCursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await activeJob(ctx, args.jobId, args.leaseToken);
    if (!job || job.phase !== "listing") return null;
    if (args.repositories.length > AUDIT_PAGE_SIZE)
      throw new Error("Audit page exceeds repository bound");
    await continueJob(ctx, job, {
      phase: args.repositories.length
        ? "repositories"
        : args.nextCursor
          ? "listing"
          : "missing",
      repositories: args.repositories,
      offset: 0,
      cursor: args.nextCursor,
      pages: job.pages + 1,
      counters: {
        ...job.counters,
        discovered: job.counters.discovered + args.repositories.length,
      },
    });
    return null;
  },
});

async function checkpointRepositoryStep(
  ctx: MutationCtx,
  job: Doc<"sourceAuditJobs">,
  args: {
    repoName: string;
    result: "unchanged" | "published" | "skipped";
    changed: boolean;
  },
) {
  const prior = await ctx.db
    .query("sourceRepositories")
    .withIndex("by_repo_name", (q) => q.eq("repoName", args.repoName))
    .first();
  if (prior)
    await ctx.db.patch(prior._id, { lastSeenAt: Date.now(), missingCount: 0 });
  const offset = job.offset + 1;
  const hasMore = offset < job.repositories.length;
  await continueJob(
    ctx,
    job,
    {
      offset: hasMore ? offset : 0,
      repositories: hasMore ? job.repositories : [],
      phase: hasMore ? "repositories" : job.cursor ? "listing" : "missing",
      counters: {
        ...job.counters,
        changed: job.counters.changed + (args.changed ? 1 : 0),
        published:
          job.counters.published + (args.result === "published" ? 1 : 0),
        skipped: job.counters.skipped + (args.result === "skipped" ? 1 : 0),
      },
    },
    args.result === "unchanged" ? 0 : AUDIT_REPO_PACE_MS,
  );
}

export const checkpointRepository = internalMutation({
  args: {
    ...leaseArgs,
    repoName: v.string(),
    result: v.union(
      v.literal("unchanged"),
      v.literal("published"),
      v.literal("skipped"),
    ),
    changed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await activeJob(ctx, args.jobId, args.leaseToken);
    if (
      job?.phase === "repositories" &&
      job.repositories[job.offset]?.id === args.repoName
    ) {
      await checkpointRepositoryStep(ctx, job, args);
    }
    return null;
  },
});

export const applyRepository = internalMutation({
  args: {
    ...leaseArgs,
    repoName: v.string(),
    classification: ingestionClassificationValue,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await activeJob(ctx, args.jobId, args.leaseToken);
    if (
      !job ||
      job.phase !== "repositories" ||
      job.repositories[job.offset]?.id !== args.repoName
    )
      return null;
    const result = await ingestRepository(ctx, {
      classification: args.classification,
      sourceOwner: job.owner,
      runId: job.runId,
      repoKey: args.repoName,
      now: Date.now(),
      auditJobId: job._id,
      auditLeaseToken: job.leaseToken,
    });
    await checkpointRepositoryStep(ctx, job, {
      repoName: args.repoName,
      result: result.status,
      changed: result.status === "published" && result.changed,
    });
    return null;
  },
});

export const sweepMissing = internalMutation({
  args: leaseArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await activeJob(ctx, args.jobId, args.leaseToken);
    if (!job || job.phase !== "missing") return null;
    // A partial listing or failed hydration must never be interpreted as deletion.
    if (job.counters.failed) {
      await completeJob(ctx, job);
      return null;
    }
    const page = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_owner", (q) => q.eq("owner", job.owner))
      .paginate({ numItems: AUDIT_PAGE_SIZE, cursor: job.cursor });
    for (const repo of page.page) {
      if (repo.lastSeenAt >= job.startedAt) continue;
      await ctx.scheduler.runAfter(0, internal.sync.removeRepository, {
        repoName: repo.repoName,
        explicit: false,
        now: Date.now(),
        runId: job.runId,
        auditStartedAt: job.startedAt,
      });
    }
    if (page.isDone) await completeJob(ctx, job);
    else await continueJob(ctx, job, { cursor: page.continueCursor });
    return null;
  },
});

export const retrySource = internalMutation({
  args: { ...leaseArgs, message: v.string(), delayMs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await activeJob(ctx, args.jobId, args.leaseToken);
    if (!job) return null;
    const now = Date.now();
    if (job.attempt >= AUDIT_MAX_ATTEMPTS - 1) {
      if (job.phase !== "repositories") {
        await completeJob(ctx, job, args.message);
        return null;
      }
      // A bad repository does not prevent the rest of an organization from updating.
      const offset = job.offset + 1;
      const hasMore = offset < job.repositories.length;
      await continueJob(
        ctx,
        job,
        {
          offset: hasMore ? offset : 0,
          repositories: hasMore ? job.repositories : [],
          phase: hasMore ? "repositories" : job.cursor ? "listing" : "missing",
          counters: { ...job.counters, failed: job.counters.failed + 1 },
          lastError: args.message,
        },
        AUDIT_REPO_PACE_MS,
      );
      return null;
    }
    const nextWakeAt = now + Math.max(30_000, args.delayMs);
    await ctx.db.patch(job._id, {
      status: "pending",
      nextWakeAt,
      attempt: job.attempt + 1,
      counters: { ...job.counters, retries: job.counters.retries + 1 },
      lastError: args.message,
    });
    const source = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) =>
        q.eq("ownerKey", normalizeOwnerKey(job.owner)),
      )
      .first();
    if (source)
      await ctx.db.patch(source._id, {
        lastAuditAt: now,
        lastError: args.message,
        nextRetryAt: nextWakeAt,
      });
    await ctx.scheduler.runAt(nextWakeAt, internal.audit.processSource, {
      jobId: job._id,
    });
    return null;
  },
});

export const processSource = internalAction({
  args: { jobId: v.id("sourceAuditJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }): Promise<null> => {
    const job = await ctx.runMutation(internal.audit.claimSource, { jobId });
    if (!job) return null;
    const lease = { jobId, leaseToken: job.leaseToken };
    try {
      const source = await ctx.runQuery(internal.sync.sourceByOwner, {
        owner: job.owner,
      });
      if (!source?.enabled)
        throw new Error(`Source ${job.owner} is not enabled`);
      const rule = sourceRule(source);
      if (job.phase === "listing") {
        if (job.pages >= AUDIT_MAX_PAGES)
          throw new Error(
            "Source exceeds the audit pagination policy; missing reconciliation was not run",
          );
        const page = await listReposPage(job.owner, job.cursor);
        const repositories = page.repositories
          .map(normalizeHuggingFaceRepo)
          .filter((repo) => repo.id && matchesSourceRules(repo.id, rule))
          .map((repo) => ({ id: repo.id, sha: repo.sha }));
        await ctx.runMutation(internal.audit.checkpointPage, {
          ...lease,
          repositories,
          nextCursor: page.nextCursor,
        });
      } else if (job.phase === "repositories") {
        const repo = job.repositories[job.offset];
        if (!repo) throw new Error("Audit repository checkpoint is invalid");
        const prior = await ctx.runQuery(internal.sync.sourceRepoByName, {
          repoName: repo.id,
        });
        if (prior?.headSha && prior.headSha === repo.sha) {
          await ctx.runMutation(internal.audit.checkpointRepository, {
            ...lease,
            repoName: repo.id,
            result: "unchanged",
            changed: false,
          });
        } else {
          const response = await fetchRepo(repo.id);
          if (!response.data)
            throw new Error(
              `Repository metadata unavailable: ${repo.id} (${response.status})`,
            );
          const classification = compactClassification(
            await classifyWithWeightMetadata(response.data, rule),
          );
          await ctx.runMutation(internal.audit.applyRepository, {
            ...lease,
            repoName: repo.id,
            classification,
          });
        }
      } else await ctx.runMutation(internal.audit.sweepMissing, lease);
    } catch (error) {
      await ctx.runMutation(internal.audit.retrySource, {
        ...lease,
        message: error instanceof Error ? error.message : String(error),
        delayMs: retryDelayForError(error, job.attempt, 60_000),
      });
    }
    return null;
  },
});

/** Recover crashes and expired leases; retries do not depend on another source. */
export const recoverSources = internalMutation({
  args: {},
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const pages = await Promise.all(
      ["pending", "running"].map((status) =>
        ctx.db
          .query("sourceAuditJobs")
          .withIndex("by_status_and_next_wake", (q) =>
            q
              .eq("status", status as "pending" | "running")
              .lte("nextWakeAt", now),
          )
          .take(50),
      ),
    );
    let scheduled = 0;
    for (const job of pages.flat()) {
      const run = await ctx.db.get(job.runId);
      if (!run || run.status !== "running") {
        await ctx.db.patch(job._id, {
          status: "failed",
          completedAt: now,
          lastError: "Audit is no longer active",
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.audit.processSource, {
          jobId: job._id,
        });
        scheduled += 1;
      }
    }
    // createAudit handles version upgrades and abandoned runs without replacing healthy work.
    const running = await ctx.db
      .query("syncRuns")
      .withIndex("by_status_and_kind", (q) =>
        q.eq("status", "running").eq("kind", "audit"),
      )
      .first();
    if (running) await createAudit(ctx);
    return { scheduled };
  },
});
