import { describe, expect, it } from "vitest";
import { hubRetryDelayMs, summarizeSourceHealth } from "./catalogHealth";

const HOUR = 60 * 60 * 1000;

describe("catalog source health", () => {
  it("keeps a partially successful catalog degraded rather than stale", () => {
    const now = 100 * HOUR;
    const summary = summarizeSourceHealth([
      { owner: "a", displayName: "A", enabled: true, lastSuccessAt: now - HOUR },
      {
        owner: "b",
        displayName: "B",
        enabled: true,
        lastAuditAt: now,
        lastSuccessAt: now - 30 * HOUR,
        lastError: "429 Too Many Requests",
        nextRetryAt: now + 5 * 60_000,
      },
    ], now);

    expect(summary).toMatchObject({
      level: "degraded",
      total: 2,
      fresh: 1,
      stale: 1,
      failing: 1,
      retrying: 1,
      staleSources: ["B"],
    });
  });

  it("marks the catalog stale only when no enabled source is current", () => {
    const now = 100 * HOUR;
    expect(summarizeSourceHealth([
      { owner: "a", displayName: "A", enabled: true, lastSuccessAt: now - 27 * HOUR },
      { owner: "b", displayName: "B", enabled: true },
    ], now).level).toBe("stale");
  });
});

describe("Hugging Face retry timing", () => {
  it("honors Retry-After seconds before exponential fallback", () => {
    expect(hubRetryDelayMs("420", null, 1_000, 60_000, 2)).toBe(420_000);
  });

  it("uses the rate-limit reset timestamp and caps excessive delays", () => {
    const now = 1_000_000;
    expect(hubRetryDelayMs(null, String((now + 90_000) / 1000), now, 60_000, 0)).toBe(90_000);
    expect(hubRetryDelayMs("7200", null, now, 60_000, 0)).toBe(30 * 60_000);
  });

  it("uses exponential fallback with a 30-second floor", () => {
    expect(hubRetryDelayMs(null, null, 0, 10_000, 0)).toBe(30_000);
    expect(hubRetryDelayMs(null, null, 0, 60_000, 2)).toBe(240_000);
  });
});
