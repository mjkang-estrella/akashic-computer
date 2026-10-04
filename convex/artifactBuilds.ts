import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query, internalMutation, internalAction, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { artifactBuildValue } from "./artifactValues";
import type { ArtifactBuild } from "../src/lib/atlas/artifactBuilds";
import { clean } from "./catalogReconciliation";

export async function storeArtifactBuilds(ctx: MutationCtx, modelSlug: string, builds: ArtifactBuild[], now: number) {
  if (builds.length > 256) throw new Error("Too many artifact builds");
  for (const build of builds) {
    const source = await ctx.db.query("sourceRepositories").withIndex("by_repo_name", (q) => q.eq("repoName", build.repo)).first();
    const existing = await ctx.db.query("artifactBuilds").withIndex("by_key", (q) => q.eq("key", build.key)).unique();
    if (existing) {
      // Identity repair may reassign the model; never remove the pinned manifest.
      await ctx.db.patch(existing._id, clean({ ...build, modelSlug, sourceRepositoryId: source?._id, observedAt: now }));
    } else await ctx.db.insert("artifactBuilds", clean({ ...build, modelSlug, sourceRepositoryId: source?._id, observedAt: now }));
  }
}

function publicBuild(build: ArtifactBuild): ArtifactBuild {
  const { modelSlug, key, repo, revision, label, files, bytes, complete, container, quantization,
    precisionBits, effectiveBits, mtp, baseModels, architecture, sourceUrl } = build;
  return clean({ modelSlug, key, repo, revision, label, files, bytes, complete, container, quantization,
    precisionBits, effectiveBits, mtp, baseModels, architecture, sourceUrl });
}
export const list = query({
  args: { repo: v.string(), revision: v.optional(v.string()), includeHistory: v.optional(v.boolean()), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(artifactBuildValue),
  handler: async (ctx, args) => {
    const source = await ctx.db.query("sourceRepositories").withIndex("by_repo_name", (q) => q.eq("repoName", args.repo)).first();
    if (!source || source.private || source.status !== "published")
      return { page: [], isDone: true, continueCursor: "" };
    const revision = args.revision ?? source.headSha ?? "";
    const result = args.includeHistory ? await ctx.db.query("artifactBuilds")
      .withIndex("by_repo_and_revision", (q) => q.eq("repo", args.repo))
      .paginate({ ...args.paginationOpts, numItems: Math.min(50, args.paginationOpts.numItems) })
      : await ctx.db.query("artifactBuilds")
      .withIndex("by_repo_and_revision", (q) => q.eq("repo", args.repo).eq("revision", revision))
      .paginate({ ...args.paginationOpts, numItems: Math.min(50, args.paginationOpts.numItems) });
    return { ...result, page: result.page.map(publicBuild) };
  },
});
export const get = query({
  args: { key: v.string() }, returns: v.union(v.null(), artifactBuildValue),
  handler: async (ctx, { key }) => {
    const build = await ctx.db.query("artifactBuilds").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!build) return null;
    const source = build.sourceRepositoryId ? await ctx.db.get(build.sourceRepositoryId)
      : await ctx.db.query("sourceRepositories").withIndex("by_repo_name", (q) => q.eq("repoName", build.repo)).first();
    return source && !source.private ? publicBuild(build) : null;
  },
});

/** Operator-triggered, resumable rehydration; not installed as a recurring job. */
export const refreshBatch = internalAction({
  args: { cursor: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, { cursor }) => {
    await ctx.runMutation(internal.artifactBuilds.scheduleRefreshPage, { cursor: cursor ?? null });
    return null;
  },
});
export const scheduleRefreshPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("sourceRepositories").paginate({ cursor, numItems: 10 });
    let delay = 0;
    for (const source of page.page) if (source.status === "published" && !source.private) {
      await ctx.scheduler.runAfter(delay, internal.sync.refreshRepository, { repoName: source.repoName });
      delay += 2000;
    }
    if (!page.isDone) await ctx.scheduler.runAfter(Math.max(delay, 2000), internal.artifactBuilds.scheduleRefreshPage, { cursor: page.continueCursor });
    return null;
  },
});
