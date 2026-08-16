import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "reconcile Hugging Face catalog",
  { hourUTC: 3, minuteUTC: 30 },
  internal.sync.startDailyAudit,
  {},
);

crons.daily(
  "synchronize official vLLM recipes",
  { hourUTC: 4, minuteUTC: 15 },
  internal.recipeSync.syncVllmRecipes,
  {},
);

crons.hourly(
  "check catalog synchronization health",
  { minuteUTC: 10 },
  internal.health.checkCatalogHealth,
);

export default crons;
