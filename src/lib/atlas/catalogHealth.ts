export const SOURCE_FRESHNESS_MS = 26 * 60 * 60 * 1000;
export const WEBHOOK_FRESHNESS_MS = 10 * 60 * 1000;

export type CatalogHealthLevel = "healthy" | "degraded" | "stale";

export interface SourceHealthInput {
  owner: string;
  displayName: string;
  enabled: boolean;
  lastAuditAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  nextRetryAt?: number;
}

export interface SourceHealthSummary {
  level: CatalogHealthLevel;
  total: number;
  fresh: number;
  stale: number;
  failing: number;
  retrying: number;
  staleSources: string[];
  failingSources: string[];
  nextRetryAt: number | null;
}

export function summarizeSourceHealth(
  sources: SourceHealthInput[],
  now: number,
): SourceHealthSummary {
  const enabled = sources.filter((source) => source.enabled);
  const staleSources: string[] = [];
  const failingSources: string[] = [];
  let fresh = 0;
  let retrying = 0;
  let nextRetryAt: number | null = null;

  for (const source of enabled) {
    const current = source.lastSuccessAt !== undefined &&
      now - source.lastSuccessAt <= SOURCE_FRESHNESS_MS;
    if (current) fresh += 1;
    else staleSources.push(source.displayName || source.owner);

    const failureIsLatest = Boolean(
      source.lastError &&
      (source.lastAuditAt ?? 0) >= (source.lastSuccessAt ?? 0),
    );
    if (failureIsLatest) failingSources.push(source.displayName || source.owner);
    if (source.nextRetryAt !== undefined && source.nextRetryAt > now) {
      retrying += 1;
      nextRetryAt = nextRetryAt === null
        ? source.nextRetryAt
        : Math.min(nextRetryAt, source.nextRetryAt);
    }
  }

  const level: CatalogHealthLevel = enabled.length === 0 || fresh === 0
    ? "stale"
    : staleSources.length > 0 || failingSources.length > 0
      ? "degraded"
      : "healthy";

  return {
    level,
    total: enabled.length,
    fresh,
    stale: staleSources.length,
    failing: failingSources.length,
    retrying,
    staleSources: staleSources.slice(0, 8),
    failingSources: failingSources.slice(0, 8),
    nextRetryAt,
  };
}

const MIN_RETRY_MS = 30_000;
const MAX_RETRY_MS = 30 * 60_000;

export function hubRetryDelayMs(
  retryAfter: string | null,
  rateLimitReset: string | null,
  now: number,
  fallbackMs: number,
  attempt: number,
): number {
  let headerDelay: number | null = null;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      headerDelay = seconds * 1000;
    } else {
      const retryDate = Date.parse(retryAfter);
      if (Number.isFinite(retryDate)) headerDelay = retryDate - now;
    }
  }
  if (headerDelay === null && rateLimitReset) {
    const resetSeconds = Number(rateLimitReset);
    if (Number.isFinite(resetSeconds)) headerDelay = resetSeconds * 1000 - now;
  }
  const delay = headerDelay ?? fallbackMs * 2 ** Math.max(0, attempt);
  return Math.min(MAX_RETRY_MS, Math.max(MIN_RETRY_MS, Math.ceil(delay)));
}
