import { accountAllowed } from "./accountPolicy";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in to your workspace.");
  const owner = await ctx.db
    .query("accountOwners")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!accountAllowed(owner)) throw new Error("Account is not allowed.");
  return userId;
}
export async function ownedConversation(
  ctx: QueryCtx | MutationCtx,
  id: Id<"conversations">,
  ownerId: Id<"users">,
) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.ownerId !== ownerId)
    throw new Error("Conversation not found.");
  return doc;
}
export async function credentialConnector(
  ctx: QueryCtx | MutationCtx,
  hash: string,
) {
  const c = await ctx.db
    .query("connectors")
    .withIndex("by_credential", (q) => q.eq("credentialHash", hash))
    .unique();
  if (!c || c.revokedAt)
    throw new Error("Connector access revoked or invalid.");
  const owner = await ctx.db
    .query("accountOwners")
    .withIndex("by_user", (q) => q.eq("userId", c.ownerId))
    .unique();
  if (!accountAllowed(owner))
    throw new Error("Account is not allowed.");
  return c;
}
export const terminal = (s: string) =>
  ["completed", "failed", "cancelled", "interrupted"].includes(s);
