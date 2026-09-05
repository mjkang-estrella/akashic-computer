import { describe, expect, it } from "vitest";
import { CATALOG_FIXTURES } from "../../../test/catalogFixture";
import { catalogSummary, hydratePublishedEntries, publishableEntry } from "./published";

describe("published catalog projections", () => {
  it("hydrates canonical model identities and artifacts", () => {
    const payloads = CATALOG_FIXTURES.map(publishableEntry);
    const hydrated = hydratePublishedEntries(payloads);
    expect(hydrated.entries.map((entry) => entry.slug)).toEqual(CATALOG_FIXTURES.map((entry) => entry.slug));
    expect(hydrated.entries.flatMap((entry) => entry.artifacts.map((artifact) => artifact.repo))).toEqual(
      CATALOG_FIXTURES.flatMap((entry) => entry.artifacts.map((artifact) => artifact.repo)),
    );
  });

  it("removes detail-only fields from list summaries", () => {
    const payload = {
      ...publishableEntry(CATALOG_FIXTURES[0]),
      introduction: {
        heading: "About",
        summary: "Summary",
        paragraphs: ["Paragraph"],
        highlights: [],
        sourceLabel: "Source",
        sourceUrl: "https://example.com",
      },
    };
    const summary = catalogSummary(payload);
    expect(summary).not.toHaveProperty("introduction");
    expect(summary).not.toHaveProperty("deploymentRecipes");
    expect(summary.size).not.toHaveProperty("scores");
  });
});

it("preserves full artifact memory, provenance, and missing/zero benchmark values", () => {
  const payload = publishableEntry(CATALOG_FIXTURES[0]);
  payload.artifacts[0] = { ...payload.artifacts[0], trust: "vendor", confidence: "inferred", minVramGb: 328, recVramGb: 340,
    measured: true, deltas: { ...payload.artifacts[0].deltas, mmlu: 0, gpqa: null } };
  expect(hydratePublishedEntries([payload]).entries[0].artifacts[0]).toEqual(payload.artifacts[0]);
  expect(hydratePublishedEntries([catalogSummary(payload)]).entries[0].artifacts[0].confidence).toBe("needs_review");
});
