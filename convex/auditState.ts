import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { normalizeOwnerKey } from "../src/lib/atlas/huggingface";
import { scheduleCatalogSnapshotRefresh } from "./catalogSnapshot";
import {
  AUDIT_MAX_AGE_MS,
  AUDIT_VERSION,
  emptyAuditCounters,
  MAX_MONITORED_SOURCES,
} from "./auditValues";

export async function createAudit(ctx: MutationCtx, paceMs?: number) {
  const now = Date.now();
  const running = await ctx.db
    .query("syncRuns")
    .withIndex("by_status_and_kind", (q) =>
      q.eq("status", "running").eq("kind", "audit"),
    )
    .first();
  if (running) {
    if (
      running.auditVersion === AUDIT_VERSION &&
      now - running.startedAt < AUDIT_MAX_AGE_MS
    ) {
      return { scheduled: false, runId: running._id };
    }
    // Upgrade a legacy chain or retire an abandoned run without touching its catalog.
    await ctx.db.patch(running._id, {
      status: "degraded",
      completedAt: now,
      cancelledAt: now,
      message: "Replaced legacy or expired audit with resumable source jobs",
    });
  }
  const sources = await ctx.db
    .query("monitoredSources")
    .withIndex("by_enabled", (q) => q.eq("enabled", true))
    .take(MAX_MONITORED_SOURCES + 1);
  if (sources.length > MAX_MONITORED_SOURCES)
    throw new Error(
      "Monitored source bound exceeded; increase the audit policy before adding sources",
    );
  sources.sort((a, b) => a.owner.localeCompare(b.owner));
  const pace = Math.max(5_000, Math.min(paceMs ?? 30_000, 60_000));
  const runId = await ctx.db.insert("syncRuns", {
    kind: "audit",
    status: sources.length ? "running" : "success",
    startedAt: now,
    ...(sources.length ? {} : { completedAt: now }),
    ...emptyAuditCounters(),
    expectedSources: sources.length,
    completedSources: 0,
    sourceOwners: sources.map((source) => source.owner),
    sourcePaceMs: pace,
    auditVersion: AUDIT_VERSION,
    completedSourceOwners: [],
  });
  for (const [index, source] of sources.entries()) {
    const nextWakeAt = now + index * pace;
    const jobId = await ctx.db.insert("sourceAuditJobs", {
      runId,
      owner: source.owner,
      status: "pending",
      phase: "listing",
      startedAt: now,
      nextWakeAt,
      leaseToken: 0,
      attempt: 0,
      cursor: null,
      repositories: [],
      offset: 0,
      pages: 0,
      counters: emptyAuditCounters(),
    });
    await ctx.scheduler.runAt(nextWakeAt, internal.audit.processSource, {
      jobId,
    });
  }
  return { scheduled: true, runId };
}

export interface AuditSourceCompletion {
  runId: Id<"syncRuns">;
  owner: string;
  success: boolean;
  discovered: number;
  changed: number;
  published: number;
  skipped: number;
  retries?: number;
  message?: string;
  nextRetryAt?: number;
  now: number;
}

/** One transaction owns source freshness, run totals, and snapshot publication. */
export async function completeAuditSource(
  ctx: MutationCtx,
  args: AuditSourceCompletion,
) {
  const run = await ctx.db.get(args.runId);
  if (!run || run.status !== "running") return null;
  const ownerKey = normalizeOwnerKey(args.owner);
  const completedOwners = run.completedSourceOwners ?? [];
  if (completedOwners.includes(ownerKey)) return null;
  if (
    run.sourceOwners &&
    !run.sourceOwners.some((owner) => normalizeOwnerKey(owner) === ownerKey)
  )
    return null;
  const source = await ctx.db
    .query("monitoredSources")
    .withIndex("by_owner_key", (q) => q.eq("ownerKey", ownerKey))
    .first();
  if (!source) return null;
  await ctx.db.patch(source._id, {
    lastAuditAt: args.now,
    lastSuccessAt: args.success ? args.now : source.lastSuccessAt,
    lastError: args.success ? undefined : args.message,
    consecutiveFailures: args.success
      ? 0
      : (source.consecutiveFailures ?? 0) + 1,
    nextRetryAt: args.success ? undefined : args.nextRetryAt,
  });
  const completedSources = (run.completedSources ?? 0) + 1;
  const failed = run.failed + (args.success ? 0 : 1);
  const changed = run.changed + args.changed;
  const complete = completedSources >= (run.expectedSources ?? 0);
  await ctx.db.patch(run._id, {
    completedSources,
    completedSourceOwners: [...completedOwners, ownerKey],
    discovered: run.discovered + args.discovered,
    changed,
    published: run.published + args.published,
    skipped: run.skipped + args.skipped,
    failed,
    retries: run.retries + (args.retries ?? 0),
    status: complete ? (failed ? "degraded" : "success") : "running",
    ...(complete ? { completedAt: args.now } : {}),
    message: args.success
      ? run.message
      : `${args.owner}: ${args.message ?? "source audit failed"}`,
  });

  // Publish partial successful work promptly, even while another source retries.
  const state = await ctx.db
    .query("catalogState")
    .withIndex("by_key", (q) => q.eq("key", "public"))
    .unique();
  const value = {
    key: "public",
    revision: args.changed
      ? `audit:${run._id}:${args.owner}:${args.now}`
      : (state?.revision ?? `audit:${args.now}`),
    syncedAt: args.now,
    ...(complete
      ? {
          lastCompletedAuditAt: args.now,
          ...(failed
            ? { lastDegradedAuditAt: args.now }
            : { lastSuccessfulAuditAt: args.now }),
        }
      : {}),
  };
  const stateId = state
    ? (await ctx.db.patch(state._id, value), state._id)
    : await ctx.db.insert("catalogState", value);
  await scheduleCatalogSnapshotRefresh(
    ctx,
    stateId,
    state?.snapshotRefreshScheduledAt,
    args.now,
    5_000,
  );
  return {
    nextOwner:
      run.auditVersion === AUDIT_VERSION || complete
        ? null
        : (run.sourceOwners?.[completedSources] ?? null),
    paceMs: run.sourcePaceMs ?? 30_000,
  };
}
