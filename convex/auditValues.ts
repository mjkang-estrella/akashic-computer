import { v } from "convex/values";

export const AUDIT_VERSION = 2;
export const AUDIT_LEASE_MS = 5 * 60_000;
export const AUDIT_MAX_AGE_MS = 6 * 60 * 60_000;
export const AUDIT_PAGE_SIZE = 100;
export const AUDIT_MAX_PAGES = 100;
export const AUDIT_MAX_ATTEMPTS = 3;
export const AUDIT_REPO_PACE_MS = 1_000;
export const AUDIT_CONCURRENCY = 3;
export const AUDIT_CAPACITY_DELAY_MS = 5_000;
export const MAX_MONITORED_SOURCES = 100;

export const auditCountersValue = v.object({
  discovered: v.number(),
  changed: v.number(),
  published: v.number(),
  skipped: v.number(),
  failed: v.number(),
  retries: v.number(),
});

export const emptyAuditCounters = () => ({
  discovered: 0,
  changed: 0,
  published: 0,
  skipped: 0,
  failed: 0,
  retries: 0,
});

export const auditRepositoryValue = v.object({
  id: v.string(),
  sha: v.string(),
});
export const sourceAuditJobFields = {
  runId: v.id("syncRuns"),
  owner: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("success"),
    v.literal("failed"),
  ),
  phase: v.union(
    v.literal("listing"),
    v.literal("repositories"),
    v.literal("missing"),
  ),
  startedAt: v.number(),
  nextWakeAt: v.number(),
  leaseToken: v.number(),
  attempt: v.number(),
  cursor: v.union(v.string(), v.null()),
  repositories: v.array(auditRepositoryValue),
  offset: v.number(),
  pages: v.number(),
  counters: auditCountersValue,
  lastError: v.optional(v.string()),
  completedAt: v.optional(v.number()),
};

export const sourceAuditJobValue = v.object({
  _id: v.id("sourceAuditJobs"),
  _creationTime: v.number(),
  ...sourceAuditJobFields,
});
