import { internalMutation } from "./_generated/server";
export const normalizeLegacySourceKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("monitoredSources").take(500);
    let count = 0;
    for (const row of rows)
      if (!row.ownerKey) {
        await ctx.db.patch(row._id, { ownerKey: row.owner.toLowerCase() });
        count++;
      }
    return { updated: count };
  },
});
