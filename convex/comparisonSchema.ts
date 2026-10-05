import { defineTable } from "convex/server";
import { v } from "convex/values";
import { computerValue, workloadValue, comparisonValue } from "./comparisonValues";
export const comparisonTables = {
  computerProfiles: defineTable({
    ownerId: v.id("users"), profile: computerValue, updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),
  workloadProfiles: defineTable({
    ownerId: v.id("users"), profile: workloadValue, updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),
  comparisons: defineTable({
    ownerId: v.id("users"), value: comparisonValue, updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),
};
