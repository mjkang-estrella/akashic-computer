import { v } from "convex/values";
import { query, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOwner } from "./workspaceAccess";
import { consumeAccountLimit } from "./accountPolicy";
import { computerValue, workloadValue, comparisonValue } from "./comparisonValues";
import { computerSchema, workloadSchema, deploymentSchema } from "../src/lib/atlas/deployments";
import { clean } from "./catalogReconciliation";

async function quota(ctx: MutationCtx, table: "computerProfiles" | "workloadProfiles" | "comparisons", ownerId: Id<"users">) {
  const records = await ctx.db.query(table).withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(100);
  if (records.length >= 100) throw new Error("Limit of 100 saved " + table + " reached.");
  await consumeAccountLimit(ctx, ownerId, "saved records", 120);
}
export const profiles = query({
  args: {}, returns: v.object({
    computers: v.array(v.object({ id: v.id("computerProfiles"), profile: computerValue })),
    workloads: v.array(v.object({ id: v.id("workloadProfiles"), profile: workloadValue })),
  }),
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const [computers, workloads] = await Promise.all([
      ctx.db.query("computerProfiles").withIndex("by_owner", (q) => q.eq("ownerId", owner)).take(100),
      ctx.db.query("workloadProfiles").withIndex("by_owner", (q) => q.eq("ownerId", owner)).take(100),
    ]);
    return { computers: computers.map((d) => ({ id: d._id, profile: d.profile })),
      workloads: workloads.map((d) => ({ id: d._id, profile: d.profile })) };
  },
});
export const saveComputer = mutation({
  args: { id: v.optional(v.id("computerProfiles")), profile: computerValue }, returns: v.id("computerProfiles"),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const profile = computerSchema.parse(args.profile);
    if (args.id) {
      const prior = await ctx.db.get(args.id);
      if (!prior || prior.ownerId !== ownerId) throw new Error("Profile not found.");
      await consumeAccountLimit(ctx, ownerId, "saved records", 120);
      await ctx.db.patch(args.id, { profile: clean({ ...profile, revision: prior.profile.revision + 1 }), updatedAt: Date.now() });
      return args.id;
    }
    await quota(ctx, "computerProfiles", ownerId);
    return ctx.db.insert("computerProfiles", { ownerId, profile: clean({ ...profile, revision: 1 }), updatedAt: Date.now() });
  },
});
export const saveWorkload = mutation({
  args: { id: v.optional(v.id("workloadProfiles")), profile: workloadValue }, returns: v.id("workloadProfiles"),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    const profile = workloadSchema.parse(args.profile);
    if (args.id) {
      const prior = await ctx.db.get(args.id);
      if (!prior || prior.ownerId !== ownerId) throw new Error("Profile not found.");
      await consumeAccountLimit(ctx, ownerId, "saved records", 120);
      await ctx.db.patch(args.id, { profile: clean({ ...profile, revision: prior.profile.revision + 1 }), updatedAt: Date.now() });
      return args.id;
    }
    await quota(ctx, "workloadProfiles", ownerId);
    return ctx.db.insert("workloadProfiles", { ownerId, profile: clean({ ...profile, revision: 1 }), updatedAt: Date.now() });
  },
});
export const list = query({
  args: {}, returns: v.array(v.object({ id: v.id("comparisons"), name: v.string(), updatedAt: v.number() })),
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    return (await ctx.db.query("comparisons").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).order("desc").take(100))
      .map((d) => ({ id: d._id, name: d.value.name, updatedAt: d.updatedAt }));
  },
});
export const get = query({
  args: { id: v.id("comparisons") }, returns: v.union(v.null(), comparisonValue),
  handler: async (ctx, { id }) => {
    const owner = await requireOwner(ctx), doc = await ctx.db.get(id);
    return doc?.ownerId === owner ? doc.value : null;
  },
});
export const save = mutation({
  args: { id: v.optional(v.id("comparisons")), value: comparisonValue }, returns: v.id("comparisons"),
  handler: async (ctx, { id, value }) => {
    const ownerId = await requireOwner(ctx);
    if (!value.name.trim() || value.name.length > 200 || value.rationale.length > 5000 ||
      !value.configurations.length || value.configurations.length > 4 || value.evidenceIds.length > 100)
      throw new Error("Use a name, 1–4 configurations and a rationale under 5,000 characters.");
    const configurations = value.configurations.map((d) => deploymentSchema.parse(d));
    if (new Set(configurations.map((d) => d.id)).size !== configurations.length) throw new Error("Configuration IDs must be distinct.");
    if (value.selectedConfigurationId && !configurations.some((d) => d.id === value.selectedConfigurationId))
      throw new Error("The selected configuration is missing.");
    for (const d of configurations) {
      const build = await ctx.db.query("artifactBuilds").withIndex("by_key", (q) => q.eq("key", d.buildKey)).unique();
      if (!build || build.modelSlug !== d.modelSlug || build.repo !== d.artifactRepo) throw new Error("Exact artifact does not match its catalog model.");
    }
    for (const reportId of value.evidenceIds) {
      const report = await ctx.db.query("runReports").withIndex("by_report_id", (q) => q.eq("reportId", reportId)).unique();
      if (!report || (!report.published && report.ownerId !== ownerId)) throw new Error("Evidence not found.");
    }
    const saved = clean({ ...value, name: value.name.trim(), configurations });
    if (id) {
      const prior = await ctx.db.get(id);
      if (!prior || prior.ownerId !== ownerId) throw new Error("Comparison not found.");
      await consumeAccountLimit(ctx, ownerId, "saved records", 120);
      await ctx.db.patch(id, { value: saved, updatedAt: Date.now() });
      return id;
    }
    await quota(ctx, "comparisons", ownerId);
    return ctx.db.insert("comparisons", { ownerId, value: saved, updatedAt: Date.now() });
  },
});
export const remove = mutation({
  args: { id: v.union(v.id("comparisons"), v.id("computerProfiles"), v.id("workloadProfiles")) },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const ownerId = await requireOwner(ctx), doc = await ctx.db.get(id);
    if (!doc || doc.ownerId !== ownerId) throw new Error("Saved record not found.");
    await ctx.db.delete(id);
    return null;
  },
});
