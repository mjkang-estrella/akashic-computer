import { githubAccountAllowed, accountAllowed } from "./accountPolicy";
import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      issuer: "https://github.com/login/oauth",
      authorization: { params: { scope: "read:user user:email" } },
      profile(profile) {
        return {
          id: String(profile.id),
          githubId: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const db = (ctx as MutationCtx).db;
      const githubId = String(args.profile.githubId ?? "");
      if (
        !githubAccountAllowed(githubId) ||
        args.provider.id !== "github"
      )
        throw new Error(
          "GitHub signup is not available for this account.",
        );
      const linked = await db.query("accountOwners").withIndex("by_github_id", (q) => q.eq("githubId", githubId)).unique();
      if (linked && !accountAllowed(linked)) throw new Error("Account is not allowed.");
      if (linked && args.existingUserId && linked.userId !== args.existingUserId) throw new Error("GitHub identity conflict.");
      const userId =
        linked?.userId ?? args.existingUserId ??
        (await db.insert("users", {
          name:
            typeof args.profile.name === "string"
              ? args.profile.name
              : "Akashic owner",
          ...(typeof args.profile.email === "string"
            ? { email: args.profile.email }
            : {}),
        }));
      const owner = await db
        .query("accountOwners")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (owner && owner.githubId !== githubId) throw new Error("Account identity conflict.");
      if (!owner) await db.insert("accountOwners", { userId, githubId, status: "active",
        role: githubId === process.env.ALLOWED_GITHUB_USER_ID ? "admin" : "member" });
      return userId;
    },
    async beforeSessionCreation(ctx, { userId }) {
      const owner = await (ctx as MutationCtx).db
        .query("accountOwners")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (!accountAllowed(owner))
        throw new Error("Account is not allowed.");
    },
  },
});
