import { ingestRepository, repositoryIngestionArgs, repositoryIngestionResultValue } from "./catalogIngestion";
import { createAudit, completeAuditSource } from "./auditState";
import { normalizeCatalogEntry } from "../src/lib/atlas/published";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  compactClassification,
  normalizeHuggingFaceRepo,
  normalizeOwnerKey,
} from "../src/lib/atlas/huggingface";
import { uploaderDisplay } from "../src/lib/atlas/naming";
import { scheduleCatalogSnapshotRefresh } from "./catalogSnapshot";
import {
  classifyWithWeightMetadata,
  fetchRepo,
  retryDelayForError,
} from "./huggingFaceClient";
import { clean, sourceRule } from "./catalogReconciliation";

const sourceRuleResultValue = v.union(v.null(), v.object({
  owner: v.string(),
  role: v.union(v.literal("creator"), v.literal("artifact_provider"), v.literal("creator_provider")),
  enabled: v.boolean(),
  familyIds: v.array(v.string()),
  includePatterns: v.optional(v.array(v.string())),
  excludePatterns: v.optional(v.array(v.string())),
}));

const eventResultValue = v.union(v.null(), v.object({
  status: v.union(v.literal("pending"), v.literal("superseded"), v.literal("processed"), v.literal("ignored"), v.literal("failed")),
  owner: v.string(),
  repoId: v.string(),
  repoName: v.string(),
  scope: v.string(),
  action: v.string(),
}));

const runResultValue = v.union(v.null(), v.object({
  status: v.union(v.literal("running"), v.literal("success"), v.literal("degraded"), v.literal("failed")),
  expectedSources: v.optional(v.number()),
  completedSources: v.optional(v.number()),
  sourceOwners: v.optional(v.array(v.string())),
  sourcePaceMs: v.optional(v.number()),
  discovered: v.number(),
  changed: v.number(),
  published: v.number(),
  skipped: v.number(),
  failed: v.number(),
  retries: v.number(),
}));

const sourceRepoResultValue = v.union(v.null(), v.object({
  repoId: v.string(),
  repoName: v.string(),
  headSha: v.optional(v.string()),
  weightManifestHash: v.optional(v.string()),
  weightsLastModifiedAt: v.optional(v.number()),
}));

export const sourceByOwner = internalQuery({
  args: { owner: v.string() },
  returns: sourceRuleResultValue,
  handler: async (ctx, args) => {
    const byKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.owner)))
      .first();
    const source = byKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
    return source ? {
      owner: source.owner,
      role: source.role,
      enabled: source.enabled,
      familyIds: source.familyIds,
      includePatterns: source.includePatterns,
      excludePatterns: source.excludePatterns,
    } : null;
  },
});

export const eventById = internalQuery({
  args: { eventId: v.id("webhookEvents") },
  returns: eventResultValue,
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    return event ? {
      status: event.status,
      owner: event.owner,
      repoId: event.repoId,
      repoName: event.repoName,
      scope: event.scope,
      action: event.action,
    } : null;
  },
});

export const syncRunById = internalQuery({
  args: { runId: v.id("syncRuns") },
  returns: runResultValue,
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    return run ? {
      status: run.status,
      expectedSources: run.expectedSources,
      completedSources: run.completedSources,
      sourceOwners: run.sourceOwners,
      sourcePaceMs: run.sourcePaceMs,
      discovered: run.discovered,
      changed: run.changed,
      published: run.published,
      skipped: run.skipped,
      failed: run.failed,
      retries: run.retries,
    } : null;
  },
});

export const sourceRepoByName = internalQuery({
  args: { repoName: v.string() },
  returns: sourceRepoResultValue,
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", args.repoName))
      .unique();
    return repo ? {
      repoId: repo.repoId,
      repoName: repo.repoName,
      headSha: repo.headSha,
      weightManifestHash: repo.weightManifestHash,
      weightsLastModifiedAt: repo.weightsLastModifiedAt,
    } : null;
  },
});

export const sourceRepoById = internalQuery({
  args: { repoId: v.string() },
  returns: sourceRepoResultValue,
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_id", (q) => q.eq("repoId", args.repoId))
      .first();
    return repo ? {
      repoId: repo.repoId,
      repoName: repo.repoName,
      headSha: repo.headSha,
      weightManifestHash: repo.weightManifestHash,
      weightsLastModifiedAt: repo.weightsLastModifiedAt,
    } : null;
  },
});

export const startWebhookRun = internalMutation({
  args: { owner: v.string(), now: v.number() },
  returns: v.id("syncRuns"),
  handler: async (ctx, args) =>
    await ctx.db.insert("syncRuns", {
      kind: "webhook",
      sourceOwner: args.owner,
      status: "running",
      startedAt: args.now,
      discovered: 1,
      changed: 0,
      published: 0,
      skipped: 0,
      failed: 0,
      retries: 0,
    }),
});

export const applyRepoResult = internalMutation({
  args: repositoryIngestionArgs,
  returns: repositoryIngestionResultValue,
  handler: ingestRepository,
});

export const finishWebhookRun = internalMutation({
  args: { runId: v.id("syncRuns"), now: v.number(), success: v.boolean(), message: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    await ctx.db.patch(args.runId, clean({
      status: args.success ? "success" as const : "failed" as const,
      completedAt: args.now,
      failed: args.success ? run.failed : run.failed + 1,
      message: args.message,
    }));
    return null;
  },
});

export const completeUnchangedWebhook = internalMutation({
  args: { eventId: v.id("webhookEvents"), runId: v.id("syncRuns"), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now, nextRetryAt: undefined });
    await ctx.db.patch(args.runId, {
      status: "success",
      completedAt: args.now,
      message: "Repository SHA already processed",
    });
    return null;
  },
});

export const scheduleWebhookRetry = internalMutation({
  args: {
    eventId: v.id("webhookEvents"),
    runId: v.id("syncRuns"),
    attempt: v.number(),
    error: v.string(),
    delayMs: v.number(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== "pending") return null;
    const run = await ctx.db.get(args.runId);
    if (run) await ctx.db.patch(args.runId, { retries: run.retries + 1, message: args.error });
    await ctx.db.patch(args.eventId, {
      error: args.error,
      nextRetryAt: args.now + args.delayMs,
    });
    await ctx.scheduler.runAfter(
      args.delayMs,
      internal.sync.processWebhook,
      { eventId: args.eventId, attempt: args.attempt + 1, runId: args.runId },
    );
    return null;
  },
});

export const failWebhook = internalMutation({
  args: { eventId: v.id("webhookEvents"), runId: v.id("syncRuns"), error: v.string(), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== "pending") return null;
    await ctx.db.patch(args.eventId, { status: "failed", error: args.error, processedAt: args.now, nextRetryAt: undefined });
    const run = await ctx.db.get(args.runId);
    if (run) {
      await ctx.db.patch(args.runId, {
        status: "failed",
        completedAt: args.now,
        failed: run.failed + 1,
        message: args.error,
      });
    }
    return null;
  },
});

export const removeRepository = internalMutation({
  args: {
    repoName: v.string(),
    explicit: v.boolean(),
    now: v.number(),
    eventId: v.optional(v.id("webhookEvents")),
    auditStartedAt: v.optional(v.number()),
    runId: v.optional(v.id("syncRuns")),
  },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", args.repoName))
      .unique();
    if (!source) return { removed: false };

    if (args.runId && !args.explicit) {
      const run = await ctx.db.get(args.runId);
      if (!run || run.cancelledAt || source.lastMissingAuditId === args.runId) return { removed: false };
      if (args.auditStartedAt !== undefined && source.lastSeenAt >= args.auditStartedAt) return { removed: false };
    }
    const missingCount = args.explicit ? 3 : source.missingCount + 1;
    await ctx.db.patch(source._id, {
      missingCount,
      ...(args.runId && !args.explicit ? { lastMissingAuditId: args.runId } : {}),
      status: missingCount >= 3 ? "missing" : source.status,
      lastIngestedAt: args.now,
    });
    if (missingCount >= 3) {
      const artifacts = await ctx.db
        .query("artifacts")
        .withIndex("by_repo", (q) => q.eq("huggingFaceRepo", args.repoName))
        .take(101);
      if (artifacts.length > 100) throw new Error("Repository exceeds the 100-artifact removal bound");
      for (const artifact of artifacts) await ctx.db.patch(artifact._id, { available: false, lastSyncedAt: args.now });
      const variants = await Promise.all(artifacts.map((artifact) => ctx.db.get(artifact.variantId)));
      const sizeIds = [...new Set(variants.filter(Boolean).map((variant) => variant!.sizeId))];
      const sizes = await Promise.all(sizeIds.map((sizeId) => ctx.db.get(sizeId)));
      const affectedSlugs = [...new Set(sizes.filter(Boolean).map((size) => size!.slug))];
      const entries = (await Promise.all(
        affectedSlugs.map((slug) =>
          ctx.db
            .query("catalogEntries")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique(),
        ),
      )).filter((entry) => entry !== null);
      let catalogChanged = false;
      for (const entry of entries) {
        const payload = normalizeCatalogEntry(entry.payload);
        const remaining = payload.artifacts.filter((artifact) => artifact.repo !== args.repoName);
        if (remaining.length === payload.artifacts.length) continue;
        catalogChanged = true;
        if (remaining.length === 0) {
          await ctx.db.delete(entry._id);
        } else {
          const nextPayload = {
            ...payload,
            artifacts: remaining,
            quantizations: [...new Set(remaining.map((artifact) => artifact.format))],
            providers: [...new Set(remaining.map((artifact) => uploaderDisplay(artifact.repo)))].sort(),
          };
          await ctx.db.patch(entry._id, {
            payload: nextPayload,
            sourceRepos: remaining.map((artifact) => artifact.repo),
            publishedAt: args.now,
            sourceRevision: `removed:${args.repoName}:${args.now}`,
          });
        }
      }
      if (catalogChanged) {
        const state = await ctx.db
          .query("catalogState")
          .withIndex("by_key", (q) => q.eq("key", "public"))
          .unique();
        const stateValue = {
          key: "public",
          revision: `removed:${args.repoName}:${args.now}`,
          syncedAt: args.now,
          lastWebhookAt: args.eventId ? args.now : state?.lastWebhookAt,
          lastSuccessfulAuditAt: state?.lastSuccessfulAuditAt,
        };
        const stateId = state
          ? (await ctx.db.patch(state._id, clean(stateValue)), state._id)
          : await ctx.db.insert("catalogState", clean(stateValue));
        await scheduleCatalogSnapshotRefresh(
          ctx,
          stateId,
          state?.snapshotRefreshScheduledAt,
          args.now,
          5_000,
        );
      }
    }
    if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now, nextRetryAt: undefined });
    if (args.runId) {
      const run = await ctx.db.get(args.runId);
      if (run?.kind === "webhook") await ctx.db.patch(args.runId, { changed: run.changed + 1 });
    }
    return { removed: missingCount >= 3 };
  },
});

export const processWebhook = internalAction({
  args: {
    eventId: v.id("webhookEvents"),
    attempt: v.number(),
    runId: v.optional(v.id("syncRuns")),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const event = await ctx.runQuery(internal.sync.eventById, { eventId: args.eventId });
    if (!event || event.status !== "pending") return null;
    const runId = args.runId ?? (await ctx.runMutation(internal.sync.startWebhookRun, { owner: event.owner, now: Date.now() }));
    try {
      if (event.action === "delete") {
        const result = await fetchRepo(event.repoName);
        if (result.status === 404) {
          await ctx.runMutation(internal.sync.removeRepository, {
            repoName: event.repoName,
            explicit: true,
            now: Date.now(),
            eventId: args.eventId,
            runId,
          });
          await ctx.runMutation(internal.sync.finishWebhookRun, { runId, now: Date.now(), success: true });
          return null;
        }
        if (!result.data) throw new Error(`Delete confirmation failed with HTTP ${result.status}`);
      }
      const response = await fetchRepo(event.repoName);
      if (!response.data) throw new Error(`Hugging Face repo fetch failed: ${response.status}`);
      const normalized = normalizeHuggingFaceRepo(response.data);
      const prior = await ctx.runQuery(internal.sync.sourceRepoById, { repoId: event.repoId });
      if (
        !event.scope.startsWith("repo.config") &&
        prior?.headSha &&
        prior.headSha === normalized.sha &&
        prior.repoName === normalized.id &&
        prior.weightManifestHash &&
        prior.weightsLastModifiedAt
      ) {
        await ctx.runMutation(internal.sync.completeUnchangedWebhook, {
          eventId: args.eventId,
          runId,
          now: Date.now(),
        });
        return null;
      }
      const source = await ctx.runQuery(internal.sync.sourceByOwner, { owner: event.owner });
      if (!source?.enabled) throw new Error(`Source ${event.owner} is no longer monitored`);
      const classification = compactClassification(
        await classifyWithWeightMetadata(response.data, sourceRule(source)),
      );
      await ctx.runMutation(internal.sync.applyRepoResult, {
        classification,
        sourceOwner: event.owner,
        repoKey: event.repoId,
        runId,
        eventId: args.eventId,
        now: Date.now(),
      });
      await ctx.runMutation(internal.sync.finishWebhookRun, { runId, now: Date.now(), success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (args.attempt < 2) {
        const delayMs = retryDelayForError(error, args.attempt, 30_000);
        await ctx.runMutation(internal.sync.scheduleWebhookRetry, {
          eventId: args.eventId,
          runId,
          attempt: args.attempt,
          error: message,
          delayMs,
          now: Date.now(),
        });
      } else {
        await ctx.runMutation(internal.sync.failWebhook, {
          eventId: args.eventId,
          runId,
          error: message,
          now: Date.now(),
        });
      }
    }
    return null;
  },
});

export const startDailyAudit = internalMutation({
  args: { paceMs: v.optional(v.number()) },
  returns: v.object({ scheduled: v.boolean(), runId: v.id("syncRuns") }),
  handler: async (ctx, args) => createAudit(ctx, args.paceMs),
});

export const cancelRunningAudit = internalMutation({
  args: { reason: v.string(), now: v.number() },
  returns: v.object({ cancelled: v.boolean(), runId: v.union(v.id("syncRuns"), v.null()) }),
  handler: async (ctx, args) => {
    const runningAudit = await ctx.db
      .query("syncRuns")
      .withIndex("by_status_and_kind", (q) => q.eq("status", "running").eq("kind", "audit"))
      .first();
    if (!runningAudit) return { cancelled: false, runId: null };
    await ctx.db.patch(runningAudit._id, {
      status: "degraded",
      completedAt: args.now,
      cancelledAt: args.now,
      message: args.reason,
    });
    return { cancelled: true, runId: runningAudit._id };
  },
});

export const recordAuditRetry = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    owner: v.string(),
    message: v.string(),
    nextRetryAt: v.number(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "running") return null;
    await ctx.db.patch(args.runId, { retries: run.retries + 1, message: args.message });
    const sourceByKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.owner)))
      .first();
    const source = sourceByKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
    if (source) {
      await ctx.db.patch(source._id, {
        lastAuditAt: args.now,
        lastError: args.message,
        consecutiveFailures: (source.consecutiveFailures ?? 0) + 1,
        nextRetryAt: args.nextRetryAt,
      });
    }
    return null;
  },
});

export const markAuditMissing = internalMutation({
  args: { owner: v.string(), seen: v.array(v.string()), runId: v.id("syncRuns"), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "running" || run.auditVersion === 2) return null;

    const seen = new Set(args.seen);
    const repos = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .take(2_000);
    for (const repo of repos) {
      if (seen.has(repo.repoName)) {
        if (repo.missingCount !== 0) await ctx.db.patch(repo._id, { missingCount: 0, lastSeenAt: args.now });
      } else {
        await ctx.scheduler.runAfter(0, internal.sync.removeRepository, {
          repoName: repo.repoName,
          explicit: false,
          now: args.now,
          runId: args.runId,
        });
      }
    }
    return null;
  },
});

export const finishAuditSource = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    owner: v.string(),
    success: v.boolean(),
    discovered: v.number(),
    changed: v.number(),
    published: v.number(),
    skipped: v.number(),
    message: v.optional(v.string()),
    nextRetryAt: v.optional(v.number()),
    now: v.number(),
  },
  returns: v.union(v.null(), v.object({
    nextOwner: v.union(v.string(), v.null()),
    paceMs: v.number(),
  })),
  handler: async (ctx, args) => completeAuditSource(ctx, args),
});

/** Compatibility endpoint for actions queued before the checkpointed runner shipped. */
export const auditSource = internalAction({
  args: { runId: v.id("syncRuns"), owner: v.string(), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await ctx.runMutation(internal.audit.recoverSources, {});
    return null;
  },
});

/** Operator-only reingestion after identity-rule changes, even when the SHA is unchanged. */
export const refreshRepository = internalAction({
  args: { repoName: v.string() },
  returns: v.null(),
  handler: async (ctx, { repoName }): Promise<null> => {
    const owner = repoName.split("/")[0];
    const source = await ctx.runQuery(internal.sync.sourceByOwner, { owner });
    if (!source?.enabled) throw new Error("Source is not enabled");
    const runId = await ctx.runMutation(internal.sync.startWebhookRun, { owner, now: Date.now() });
    try {
      const response = await fetchRepo(repoName);
      if (!response.data) throw new Error(`Repository fetch failed: ${response.status}`);
      const classification = compactClassification(await classifyWithWeightMetadata(response.data, sourceRule(source)));
      if (classification.status !== "publishable") throw new Error(`Repository cannot be published: ${classification.reason}`);
      const result = await ctx.runMutation(internal.sync.applyRepoResult, {
        classification, sourceOwner: owner, runId, now: Date.now(),
      });
      if (result.status !== "published") throw new Error(result.reason);
      await ctx.runMutation(internal.sync.finishWebhookRun, { runId, now: Date.now(), success: true });
    } catch (error) {
      await ctx.runMutation(internal.sync.finishWebhookRun, {
        runId, now: Date.now(), success: false, message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    return null;
  },
});
