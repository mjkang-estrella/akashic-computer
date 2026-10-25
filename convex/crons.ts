import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "reconcile Hugging Face catalog",
  { hourUTC: 3, minuteUTC: 30 },
  internal.sync.startDailyAudit,
  {},
);

crons.hourly(
  "synchronize official vLLM recipes",
  { minuteUTC: 15 },
  internal.deploymentRecipeSync.syncVllm,
  {},
);

crons.daily(
  "synchronize official SGLang recipes",
  { hourUTC: 4, minuteUTC: 15 },
  internal.deploymentRecipeSync.syncSglang,
  {},
);

crons.hourly(
  "check catalog synchronization health",
  { minuteUTC: 10 },
  internal.health.checkCatalogHealth,
);

crons.hourly(
  "revalidate cached catalog list pages",
  { minuteUTC: 45 },
  internal.siteRevalidation.flush,
  { includeListWide: true },
);

crons.interval(
  "recover stalled catalog webhooks",
  { minutes: 15 },
  internal.sync.recoverStalledWebhooks,
  {},
);

export default crons;
