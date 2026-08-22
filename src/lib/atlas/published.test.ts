import { describe, expect, it } from "vitest";
import { MODEL_ENTRIES } from "./models";
import { hydratePublishedEntries, publishableEntry } from "./published";

describe("catalog migration snapshot", () => {
  it("preserves all 157 model-size slugs and artifact URLs", () => {
    const payloads = MODEL_ENTRIES.map(publishableEntry);
    const hydrated = hydratePublishedEntries(payloads);
    expect(payloads).toHaveLength(157);
    expect(hydrated.entries.map((entry) => entry.slug)).toEqual(MODEL_ENTRIES.map((entry) => entry.slug));
    expect(hydrated.entries.flatMap((entry) => entry.artifacts.map((artifact) => artifact.repo))).toEqual(
      MODEL_ENTRIES.flatMap((entry) => entry.artifacts.map((artifact) => artifact.repo)),
    );
  });

  it("normalizes legacy duplicate entry ids to unique catalog slugs", () => {
    const payloads = MODEL_ENTRIES.slice(0, 2).map(publishableEntry);
    const legacyPayloads = payloads.map((payload) => ({ ...payload, id: "legacy-duplicate" }));
    const hydrated = hydratePublishedEntries(legacyPayloads);

    expect(hydrated.entries.map((entry) => entry.id)).toEqual(
      hydrated.entries.map((entry) => entry.slug),
    );
    expect(new Set(hydrated.entries.map((entry) => entry.id)).size).toBe(hydrated.entries.length);
  });

  it("keeps every bundled model entry identity unique", () => {
    expect(new Set(MODEL_ENTRIES.map((entry) => entry.id)).size).toBe(MODEL_ENTRIES.length);
    expect(MODEL_ENTRIES.every((entry) => entry.id === entry.slug)).toBe(true);
  });
});
