import type { MutationCtx, QueryCtx } from "./_generated/server";

// Opt-in diagnostics: log counters, never documents, prompts, or credentials.
export async function logIoMetrics(
  ctx: MutationCtx | QueryCtx,
  operation: string,
) {
  if (process.env.LOG_DATABASE_IO !== "true") return;
  const metrics = await ctx.meta.getTransactionMetrics();
  console.info("database_io", {
    operation,
    bytesRead: metrics.bytesRead.used,
    bytesWritten: metrics.bytesWritten.used,
    documentsRead: metrics.documentsRead.used,
    documentsWritten: metrics.documentsWritten.used,
  });
}
