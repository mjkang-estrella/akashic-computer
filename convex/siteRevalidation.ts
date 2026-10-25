import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { isCatalogModelTag } from "../src/lib/atlas/cacheTags";

/**
 * The site caches catalog pages and reads until their Next.js cache tags are revalidated
 * (src/lib/atlas/cacheTags.ts). Mutations queue tags here when public data changes, and
 * an action posts them to the site's /api/revalidate route.
 *
 * Model tags are posted a minute after the first change, so a sync or audit touching many
 * models sends one batch. List-wide tags cover pages built from the whole list (home,
 * benchmarks, the sitemap, the site feed); the hourly flush posts those, bounding how often
 * the larger pages are rewritten, and retries anything a failed flush left behind.
 */
const MODEL_FLUSH_DELAY_MS = 60_000;
// Every model tag plus the list-wide tags; the catalog is bounded at 2,000 entries.
const MAX_PENDING = 2_100;
const TAGS_PER_REQUEST = 100;
const REQUEST_TIMEOUT_MS = 20_000;

const pendingRow = v.object({ id: v.id("siteRevalidations"), tag: v.string(), requestedAt: v.number() });

function revalidationTarget(): { url: string; secret: string } | null {
  const url = process.env.CATALOG_REVALIDATE_URL;
  const secret = process.env.CATALOG_REVALIDATE_SECRET;
  return url && secret ? { url, secret } : null;
}

/** Deployments without the site's revalidation settings, such as development, queue nothing. */
export async function queueSiteRevalidation(ctx: MutationCtx, tags: string[]): Promise<void> {
  if (!revalidationTarget() || tags.length === 0) return;
  const now = Date.now();
  // A pending model tag means a flush is already scheduled; the hourly flush recovers a lost one.
  const modelFlushScheduled = (await ctx.db
    .query("siteRevalidations")
    .withIndex("by_list_wide", (q) => q.eq("listWide", false))
    .first()) !== null;
  let queuedModelTag = false;
  for (const tag of new Set(tags)) {
    const listWide = !isCatalogModelTag(tag);
    queuedModelTag ||= !listWide;
    const existing = await ctx.db
      .query("siteRevalidations")
      .withIndex("by_tag", (q) => q.eq("tag", tag))
      .unique();
    // A newer stamp keeps the tag queued when a flush in flight already read the older one.
    if (existing) await ctx.db.patch(existing._id, { requestedAt: Math.max(now, existing.requestedAt + 1) });
    else await ctx.db.insert("siteRevalidations", { tag, listWide, requestedAt: now });
  }
  if (queuedModelTag && !modelFlushScheduled) {
    await ctx.scheduler.runAfter(MODEL_FLUSH_DELAY_MS, internal.siteRevalidation.flush, { includeListWide: false });
  }
}

export const pendingTags = internalQuery({
  args: { includeListWide: v.boolean() },
  returns: v.array(pendingRow),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("siteRevalidations")
      .withIndex("by_list_wide", (q) => q.eq("listWide", false))
      .take(MAX_PENDING);
    if (args.includeListWide) {
      rows.push(...await ctx.db
        .query("siteRevalidations")
        .withIndex("by_list_wide", (q) => q.eq("listWide", true))
        .take(MAX_PENDING));
    }
    return rows.map((row) => ({ id: row._id, tag: row.tag, requestedAt: row.requestedAt }));
  },
});

export const finishFlush = internalMutation({
  args: {
    sent: v.array(v.object({ id: v.id("siteRevalidations"), requestedAt: v.number() })),
    complete: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const row of args.sent) {
      const current = await ctx.db.get(row.id);
      if (current && current.requestedAt === row.requestedAt) await ctx.db.delete(row.id);
    }
    // Model tags queued while this flush ran saw it pending and scheduled nothing themselves.
    // After a failed request, the hourly flush retries instead.
    if (args.complete) {
      const remaining = await ctx.db
        .query("siteRevalidations")
        .withIndex("by_list_wide", (q) => q.eq("listWide", false))
        .first();
      if (remaining) {
        await ctx.scheduler.runAfter(MODEL_FLUSH_DELAY_MS, internal.siteRevalidation.flush, { includeListWide: false });
      }
    }
    return null;
  },
});

async function postTags(target: { url: string; secret: string }, tags: string[]): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${target.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
      signal: controller.signal,
    });
    if (response.ok) return true;
    console.error(`Site revalidation returned ${response.status} for ${tags.length} tags`);
  } catch (error) {
    console.error(`Site revalidation failed for ${tags.length} tags: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
  return false;
}

export const flush = internalAction({
  args: { includeListWide: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const target = revalidationTarget();
    if (!target) return null;
    const pending = await ctx.runQuery(internal.siteRevalidation.pendingTags, args);
    if (pending.length === 0) return null;
    const sent: Array<{ id: (typeof pending)[number]["id"]; requestedAt: number }> = [];
    let complete = true;
    for (let start = 0; start < pending.length; start += TAGS_PER_REQUEST) {
      const batch = pending.slice(start, start + TAGS_PER_REQUEST);
      if (!(await postTags(target, batch.map((row) => row.tag)))) {
        complete = false;
        break;
      }
      sent.push(...batch.map(({ id, requestedAt }) => ({ id, requestedAt })));
    }
    await ctx.runMutation(internal.siteRevalidation.finishFlush, { sent, complete });
    return null;
  },
});
