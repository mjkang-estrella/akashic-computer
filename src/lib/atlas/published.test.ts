import { describe, expect, it } from "vitest";
import { MODEL_ENTRIES } from "./models";
import { hydratePublishedEntries, publishableEntry } from "./published";

describe("catalog migration snapshot", () => {
  it("preserves all 155 model-size slugs and artifact URLs", () => {
    const payloads = MODEL_ENTRIES.map(publishableEntry);
    const hydrated = hydratePublishedEntries(payloads);
    expect(payloads).toHaveLength(155);
    expect(hydrated.entries.map((entry) => entry.slug)).toEqual(MODEL_ENTRIES.map((entry) => entry.slug));
    expect(hydrated.entries.flatMap((entry) => entry.artifacts.map((artifact) => artifact.repo))).toEqual(
      MODEL_ENTRIES.flatMap((entry) => entry.artifacts.map((artifact) => artifact.repo)),
    );
  });
});
