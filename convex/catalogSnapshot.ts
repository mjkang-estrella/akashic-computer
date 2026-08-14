import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

const SNAPSHOT_SCHEDULE_TTL_MS = 10 * 60 * 1000;

export function convexValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => convexValuesEqual(value, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] && convexValuesEqual(leftRecord[key], rightRecord[key]),
    );
}

export async function scheduleCatalogSnapshotRefresh(
  ctx: MutationCtx,
  stateId: Id<"catalogState">,
  scheduledAt: number | undefined,
  now: number,
  delayMs: number,
): Promise<boolean> {
  if (scheduledAt !== undefined && now - scheduledAt < SNAPSHOT_SCHEDULE_TTL_MS) {
    return false;
  }
  await ctx.db.patch(stateId, { snapshotRefreshScheduledAt: now });
  await ctx.scheduler.runAfter(delayMs, internal.catalog.rebuildPublishedSnapshot, {
    scheduledAt: now,
  });
  return true;
}
