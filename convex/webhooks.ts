import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { normalizeOwnerKey } from "../src/lib/atlas/huggingface";

export const receive = internalMutation({
  args: {
    dedupeKey: v.string(),
    repoId: v.string(),
    repoName: v.string(),
    owner: v.string(),
    scope: v.string(),
    action: v.string(),
    headSha: v.optional(v.string()),
    payload: v.any(),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerKey = normalizeOwnerKey(args.owner);
    const sourceByKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", ownerKey))
      .first();
    const source = sourceByKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
    if (!source?.enabled) return { status: "unmonitored" as const };

    const catalogState = await ctx.db
      .query("catalogState")
      .withIndex("by_key", (q) => q.eq("key", "public"))
      .unique();
    if (catalogState) {
      await ctx.db.patch(catalogState._id, { lastWebhookAt: args.receivedAt });
    } else {
      await ctx.db.insert("catalogState", {
        key: "public",
        revision: "unseeded",
        syncedAt: args.receivedAt,
        lastWebhookAt: args.receivedAt,
      });
    }

    const duplicate = await ctx.db
      .query("webhookEvents")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", args.dedupeKey))
      .first();
    if (duplicate) return { status: "duplicate" as const, eventId: duplicate._id };

    const pending = await ctx.db
      .query("webhookEvents")
      .withIndex("by_repo_id_status", (q) => q.eq("repoId", args.repoId).eq("status", "pending"))
      .order("desc")
      .first();
    const superseded = Boolean(pending && args.receivedAt - pending.receivedAt < 30_000);
    const eventId = await ctx.db.insert("webhookEvents", {
      ...args,
      status: superseded ? "superseded" : "pending",
    });
    if (superseded && pending) {
      await ctx.db.patch(pending._id, {
        repoName: args.repoName,
        owner: args.owner,
        scope: args.scope,
        action: args.action,
        headSha: args.headSha,
        payload: args.payload,
        receivedAt: args.receivedAt,
      });
    } else {
      await ctx.scheduler.runAfter(30_000, internal.sync.processWebhook, {
        eventId,
        attempt: 0,
      });
    }
    return { status: superseded ? "coalesced" as const : "accepted" as const, eventId };
  },
});
