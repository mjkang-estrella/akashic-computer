import { query } from "./_generated/server";
import { v } from "convex/values";

const STATE_KEY = "public";

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const [documents, state] = await Promise.all([
      ctx.db.query("catalogEntries").collect(),
      ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
        .unique(),
    ]);
    const entries = documents
      .sort((a, b) => b.updatedAt - a.updatedAt || a.slug.localeCompare(b.slug))
      .map((document) => document.payload);
    return {
      entries,
      syncedAt: state?.syncedAt ?? null,
      revision: state?.revision ?? "unseeded",
    };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return document?.payload ?? null;
  },
});

export const status = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [state, latestAudit, pendingWebhooks, failedWebhooks, activeAlerts] = await Promise.all([
      ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
        .unique(),
      ctx.db
        .query("syncRuns")
        .withIndex("by_kind_started", (q) => q.eq("kind", "audit"))
        .order("desc")
        .first(),
      ctx.db
        .query("webhookEvents")
        .withIndex("by_received")
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect(),
      ctx.db
        .query("webhookEvents")
        .withIndex("by_received")
        .filter((q) => q.eq(q.field("status"), "failed"))
        .take(100),
      ctx.db
        .query("catalogHealthAlerts")
        .filter((q) => q.eq(q.field("active"), true))
        .collect(),
    ]);
    const oldestPending = pendingWebhooks.reduce<number | null>(
      (oldest, event) => (oldest === null || event.receivedAt < oldest ? event.receivedAt : oldest),
      null,
    );
    return {
      revision: state?.revision ?? "unseeded",
      syncedAt: state?.syncedAt ?? null,
      lastWebhookAt: state?.lastWebhookAt ?? null,
      lastSuccessfulAuditAt: state?.lastSuccessfulAuditAt ?? null,
      latestAudit: latestAudit
        ? {
            status: latestAudit.status,
            startedAt: latestAudit.startedAt,
            completedAt: latestAudit.completedAt ?? null,
            message: latestAudit.message ?? null,
            expectedSources: latestAudit.expectedSources ?? null,
            completedSources: latestAudit.completedSources ?? null,
            discovered: latestAudit.discovered,
            changed: latestAudit.changed,
            published: latestAudit.published,
            skipped: latestAudit.skipped,
            failed: latestAudit.failed,
            retries: latestAudit.retries,
          }
        : null,
      pendingWebhookCount: pendingWebhooks.length,
      failedWebhookCount: failedWebhooks.length,
      activeAlerts: activeAlerts.map((alert) => ({
        kind: alert.kind,
        message: alert.message,
        firstDetectedAt: alert.firstDetectedAt,
      })),
      webhookStale: oldestPending !== null && now - oldestPending > 10 * 60 * 1000,
      catalogStale:
        !state?.lastSuccessfulAuditAt || now - state.lastSuccessfulAuditAt > 26 * 60 * 60 * 1000,
    };
  },
});
