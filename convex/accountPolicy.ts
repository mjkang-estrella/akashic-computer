import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Keep the existing owner gate until an operator explicitly enables public signup. */
export function githubAccountAllowed(githubId: string) {
  return /^[0-9]+$/.test(githubId) && (process.env.WORKSPACE_ACCESS_MODE === "github" ||
    (!!process.env.ALLOWED_GITHUB_USER_ID && githubId === process.env.ALLOWED_GITHUB_USER_ID));
}
export function accountAllowed(owner: Doc<"accountOwners"> | null) {
  return !!owner && owner.status !== "suspended" && githubAccountAllowed(owner.githubId);
}
export const accountIsAdmin = (owner: Doc<"accountOwners">) =>
  owner.status !== "suspended" && (owner.role === "admin" ||
    (owner.role === undefined && owner.githubId === process.env.ALLOWED_GITHUB_USER_ID));

/** One bounded transactional bucket per owner/operation, rather than an event log. */
export async function consumeAccountLimit(ctx: MutationCtx, ownerId: Id<"users">, kind: string, maximum: number) {
  const now = Date.now();
  const bucket = await ctx.db.query("accountLimits")
    .withIndex("by_owner_and_kind", (q) => q.eq("ownerId", ownerId).eq("kind", kind)).unique();
  const reset = !bucket || bucket.windowStart + 3600000 <= now;
  const count = reset ? 0 : bucket.count;
  if (count >= maximum) throw new Error("Hourly " + kind + " limit reached. Try again later.");
  const fields = { ownerId, kind, windowStart: reset ? now : bucket!.windowStart, count: count + 1 };
  if (bucket) await ctx.db.replace(bucket._id, fields);
  else await ctx.db.insert("accountLimits", fields);
}
