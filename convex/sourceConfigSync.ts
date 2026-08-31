import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { normalizeOwnerKey } from "../src/lib/atlas/huggingface";
import { CURRENT_MONITORED_SOURCES } from "./sourceConfig";

export const syncSources = internalMutation({
  args: {},
  returns: v.object({
    inserted: v.number(),
    updated: v.number(),
    disabled: v.number(),
    configured: v.number(),
  }),
  handler: async (ctx) => {
    const configuredOwnerKeys = new Set(
      CURRENT_MONITORED_SOURCES.map((source) => normalizeOwnerKey(source.owner)),
    );
    let inserted = 0;
    let updated = 0;
    let disabled = 0;
    for (const source of CURRENT_MONITORED_SOURCES) {
      const ownerKey = normalizeOwnerKey(source.owner);
      const existing = await ctx.db
        .query("monitoredSources")
        .withIndex("by_owner_key", (q) => q.eq("ownerKey", ownerKey))
        .first();
      const value = {
        owner: source.owner,
        ownerKey,
        displayName: source.displayName,
        role: source.role,
        enabled: true,
        familyIds: source.familyIds,
        includePatterns: source.includePatterns,
        excludePatterns: source.excludePatterns,
      };
      if (existing) {
        await ctx.db.patch(existing._id, value);
        updated += 1;
      } else {
        await ctx.db.insert("monitoredSources", value);
        inserted += 1;
      }
    }
    const enabledSources = await ctx.db
      .query("monitoredSources")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .take(200);
    for (const source of enabledSources) {
      if (configuredOwnerKeys.has(source.ownerKey ?? normalizeOwnerKey(source.owner))) continue;
      await ctx.db.patch(source._id, { enabled: false });
      disabled += 1;
    }
    return { inserted, updated, disabled, configured: CURRENT_MONITORED_SOURCES.length };
  },
});
