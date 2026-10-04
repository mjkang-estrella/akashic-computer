import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireOwner } from "./workspaceAccess";
import { accountIsAdmin, consumeAccountLimit } from "./accountPolicy";
import { evidenceValue } from "./comparisonValues";
import { parseEvidenceImport, publicationProjection } from "../src/lib/atlas/evidence";
import { stableJson } from "../src/lib/atlas/deployments";
import { clean } from "./catalogReconciliation";
import type { Id } from "./_generated/dataModel";

const row = v.object({ reportId: v.string(), evidence: evidenceValue, published: v.boolean(), consented: v.boolean() });
const page = paginationResultValidator(row);
async function administrator(ctx: QueryCtx | MutationCtx) {
  const ownerId = await requireOwner(ctx);
  const account = await ctx.db.query("accountOwners").withIndex("by_user", (q) => q.eq("userId", ownerId)).unique();
  if (!account || !accountIsAdmin(account)) throw new Error("Administrator access required.");
}
async function owned(ctx: QueryCtx | MutationCtx, id: string) {
  const ownerId = await requireOwner(ctx);
  const doc = await ctx.db.query("runReports").withIndex("by_report_id", (q) => q.eq("reportId", id)).unique();
  if (!doc || doc.ownerId !== ownerId || !doc.evidence) throw new Error("Report not found.");
  return doc;
}
export const importBatch = mutation({
  args: { json: v.string() }, returns: v.object({ inserted: v.number(), unchanged: v.number(), reportIds: v.array(v.string()) }),
  handler: async (ctx, { json }) => {
    const ownerId = await requireOwner(ctx), parsed = parseEvidenceImport(json);
    if (parsed.errors.length) throw new Error(parsed.errors.join("\n"));
    const account = await ctx.db.query("accountOwners").withIndex("by_user", (q) => q.eq("userId", ownerId)).unique();
    if (!account) throw new Error("Account not found.");
    let inserted = 0, unchanged = 0;
    const reportIds: string[] = [];
    for (const evidence of parsed.reports) {
      const prior = await ctx.db.query("runReports").withIndex("by_owner_and_external_id", (q) => q.eq("ownerId", ownerId).eq("externalId", evidence.id)).unique();
      if (prior) {
        if (stableJson(prior.evidence) !== stableJson(evidence)) throw new Error("Report ID already exists with different content: " + evidence.id);
        unchanged++; reportIds.push(prior.reportId); continue;
      }
      if ((account.importedReportCount ?? 0) + inserted >= 1000) throw new Error("Limit of 1,000 imported reports reached.");
      const model = await ctx.db.query("catalogEntries").withIndex("by_slug", (q) => q.eq("slug", evidence.modelSlug)).unique();
      if (!model) throw new Error("Unknown catalog model: " + evidence.modelSlug);
      if (evidence.buildKey) {
        const build = await ctx.db.query("artifactBuilds").withIndex("by_key", (q) => q.eq("key", evidence.buildKey!)).unique();
        if (!build || build.repo !== evidence.artifactRepo || build.modelSlug !== evidence.modelSlug)
          throw new Error("Report artifact does not match the pinned catalog build.");
      }
      const id = await ctx.db.insert("runReports", clean({
        reportId: "pending", schemaVersion: 2 as const, ownerId, externalId: evidence.id,
        modelSlug: evidence.modelSlug, artifactRepo: evidence.artifactRepo, buildKey: evidence.buildKey,
        evidence, published: false, updatedAt: Date.now(),
      }));
      await ctx.db.patch(id, { reportId: id });
      reportIds.push(id); inserted++;
    }
    if (inserted) {
      await consumeAccountLimit(ctx, ownerId, "imports", 10);
      await ctx.db.patch(account._id, { importedReportCount: (account.importedReportCount ?? 0) + inserted });
    }
    return { inserted, unchanged, reportIds };
  },
});
export const listMine = query({
  args: { buildKey: v.optional(v.string()), paginationOpts: paginationOptsValidator }, returns: page,
  handler: async (ctx, a) => {
    const ownerId = await requireOwner(ctx);
    const result = a.buildKey
      ? await ctx.db.query("runReports").withIndex("by_owner_and_build", (q) => q.eq("ownerId", ownerId).eq("buildKey", a.buildKey))
        .paginate({ ...a.paginationOpts, numItems: Math.min(a.paginationOpts.numItems, 50) })
      : await ctx.db.query("runReports").withIndex("by_owner_and_external_id", (q) => q.eq("ownerId", ownerId))
        .paginate({ ...a.paginationOpts, numItems: Math.min(a.paginationOpts.numItems, 50) });
    return { ...result, page: result.page.flatMap((r) => r.evidence
      ? [{ reportId: r.reportId, evidence: r.evidence, published: r.published, consented: !!r.consentAt }] : []) };
  },
});
export const listPublic = query({
  args: { buildKey: v.string(), paginationOpts: paginationOptsValidator }, returns: page,
  handler: async (ctx, a) => {
    const result = await ctx.db.query("runReports")
      .withIndex("by_build_and_published", (q) => q.eq("buildKey", a.buildKey).eq("published", true))
      .paginate({ ...a.paginationOpts, numItems: Math.min(a.paginationOpts.numItems, 50) });
    // Never spread a stored document into a public result.
    return { ...result, page: result.page.flatMap((r) => r.publicEvidence
      ? [{ reportId: r.reportId, evidence: r.publicEvidence, published: true, consented: true }] : []) };
  },
});
export const references = query({
  args: { reportIds: v.array(v.string()) }, returns: v.array(row),
  handler: async (ctx, { reportIds }) => {
    const ownerId = await requireOwner(ctx);
    if (reportIds.length > 100) throw new Error("At most 100 evidence references.");
    const reports = await Promise.all([...new Set(reportIds)].map((reportId) =>
      ctx.db.query("runReports").withIndex("by_report_id", (q) => q.eq("reportId", reportId)).unique()));
    return reports.flatMap((r) => {
      const evidence = r?.ownerId === ownerId ? r.evidence : r?.published ? r.publicEvidence : undefined;
      return r && evidence ? [{ reportId: r.reportId, evidence, published: r.published, consented: !!r.consentAt }] : [];
    });
  },
});
export const consentToPublication = mutation({
  args: { reportId: v.string() }, returns: evidenceValue,
  handler: async (ctx, { reportId }) => {
    const report = await owned(ctx, reportId);
    const projection = publicationProjection({ ...report.evidence!, id: reportId });
    await ctx.db.patch(report._id, { publicEvidence: clean(projection), consentAt: Date.now(), updatedAt: Date.now() });
    return projection;
  },
});
export const withdrawPublication = mutation({
  args: { reportId: v.string() }, returns: v.null(),
  handler: async (ctx, { reportId }) => {
    const report = await owned(ctx, reportId);
    await ctx.db.patch(report._id, { published: false, consentAt: undefined, publicEvidence: undefined, updatedAt: Date.now() });
    return null;
  },
});
export const publicationQueue = query({
  args: { paginationOpts: paginationOptsValidator }, returns: page,
  handler: async (ctx, { paginationOpts }) => {
    await administrator(ctx);
    const result = await ctx.db.query("runReports")
      .withIndex("by_published_and_consent", (q) => q.eq("published", false).gt("consentAt", 0))
      .paginate({ ...paginationOpts, numItems: Math.min(paginationOpts.numItems, 50) });
    return { ...result, page: result.page.flatMap((r) => r.publicEvidence
      ? [{ reportId: r.reportId, evidence: r.publicEvidence, published: false, consented: true }] : []) };
  },
});
export const publish = mutation({
  args: { reportId: v.string() }, returns: v.null(),
  handler: async (ctx, { reportId }) => {
    await administrator(ctx);
    const r = await ctx.db.query("runReports").withIndex("by_report_id", (q) => q.eq("reportId", reportId)).unique();
    if (!r?.consentAt || !r.publicEvidence) throw new Error("Owner consent and a publication projection are required.");
    await ctx.db.patch(r._id, { published: true, updatedAt: Date.now() });
    return null;
  },
});
export const remove = mutation({
  args: { reportId: v.string() }, returns: v.null(),
  handler: async (ctx, { reportId }) => {
    const r = await owned(ctx, reportId);
    await ctx.db.delete(r._id as Id<"runReports">);
    const account = await ctx.db.query("accountOwners").withIndex("by_user", (q) => q.eq("userId", r.ownerId!)).unique();
    if (account) await ctx.db.patch(account._id, { importedReportCount: Math.max(0, (account.importedReportCount ?? 0) - 1) });
    return null;
  },
});
