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
        !process.env.ALLOWED_GITHUB_USER_ID ||
        githubId !== process.env.ALLOWED_GITHUB_USER_ID ||
        args.provider.id !== "github"
      )
        throw new Error(
          "This personal workspace is not available for this account.",
        );
      const userId =
        args.existingUserId ??
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
      if (!owner) await db.insert("accountOwners", { userId, githubId });
      return userId;
    },
    async beforeSessionCreation(ctx, { userId }) {
      const owner = await (ctx as MutationCtx).db
        .query("accountOwners")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (!owner || owner.githubId !== process.env.ALLOWED_GITHUB_USER_ID)
        throw new Error("Account is not allowed.");
    },
  },
});
