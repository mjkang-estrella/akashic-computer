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
  "check catalog synchronization health",
  { minuteUTC: 10 },
  internal.health.checkCatalogHealth,
);

export default crons;
