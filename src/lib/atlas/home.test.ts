import { describe, expect, it } from "vitest";
import { artifact, modelEntry } from "../../../test/catalogFixture";
import { benchmarkSnapshot, OFFICIAL_BENCHMARKS, resolveOfficialBenchmarks } from "./benchmarks";
import {
  homeCatalogStats,
  homeSnapshot,
  modelSizesFitting,
  newestReleaseEntries,
  recentlyUpdatedEntries,
} from "./home";
import type { ModelEntry } from "./models";
import {
  catalogListItem,
  catalogSummary,
  hydrateCatalogListItems,
  hydratePublishedEntries,
  publishableEntry,
  type PublishedCatalogSummary,
} from "./published";
import type { MaterialChange } from "./types";

const benchmarkRepos = [...new Set(OFFICIAL_BENCHMARKS.flatMap((benchmark) => benchmark.results.map((result) => result.repo)))];

/** A catalog large enough that the home and benchmark subsets leave most of it out. */
function publishedList(): PublishedCatalogSummary[] {
  const entries = Array.from({ length: 90 }, (_, index) => {
    const entry = modelEntry({
      slug: `model-${String(index).padStart(2, "0")}`,
      repo: `org-${index % 7}/model-${index}`,
      familyId: `family-${index % 9}`,
      familyName: `Family ${index % 9}`,
      releaseId: `release-${index % 30}`,
      releaseName: `Release ${index % 30}`,
      sizeLabel: `${(index % 5) + 1}B`,
      paramsB: (index % 5) + 1,
      artifacts: [
        artifact(`org-${index % 7}/model-${index}`, index % 3 === 0 ? "NVFP4" : "BF16"),
        // Every eighth model carries a benchmarked repository; two models share each one.
        ...(index % 8 === 0 ? [artifact(benchmarkRepos[(index / 8) % 6], "FP8")] : []),
      ],
    });
    // Repeated timestamps and release dates exercise sorting ties.
    entry.timestamp = Date.parse("2026-01-01T00:00:00Z") + (index % 40) * 3_600_000;
    entry.release = { ...entry.release, date: `2026-0${(index % 9) + 1}-1${index % 3}` };
    return catalogSummary(publishableEntry(entry));
  });
  // Convex lists entries newest first, then by slug.
  return entries.sort((a, b) => b.timestamp - a.timestamp || a.slug.localeCompare(b.slug));
}

const slugs = (entries: ModelEntry[]) => entries.map((entry) => entry.slug);
const leaderboards = (entries: ModelEntry[]) =>
  resolveOfficialBenchmarks(entries).map((benchmark) => ({
    id: benchmark.id,
    results: benchmark.results.map((result) => [result.repo, result.entry.slug, result.rank]),
  }));

function change(modelSlug: string, index: number): MaterialChange {
  return {
    id: `change-${index}`,
    modelSlug,
    modelName: modelSlug,
    type: "artifact_published",
    occurredAt: 1_000 - index,
    dateLabel: "2026-01-01",
    title: "Artifact added",
    summary: "An artifact was added.",
    sourceLabel: "Hugging Face",
    sourceUrls: [],
    reviewStatus: "automatic",
  };
}

describe("home snapshot", () => {
  it("renders what the full list renders from a fraction of it", () => {
    const published = publishedList();
    const full = hydratePublishedEntries(published).entries;
    const changes = ["model-77", "model-03", "removed-model", "model-50"].map(change);
    const snapshot = homeSnapshot(published, changes);
    const partial = hydrateCatalogListItems(snapshot.entries).entries;

    expect(partial.length).toBeLessThan(full.length);
    expect(slugs(recentlyUpdatedEntries(partial))).toEqual(slugs(recentlyUpdatedEntries(full)));
    expect(slugs(newestReleaseEntries(partial))).toEqual(slugs(newestReleaseEntries(full)));
    expect(leaderboards(partial)).toEqual(leaderboards(full));
    expect(leaderboards(full).length).toBeGreaterThan(0);
    const shownChanges = (entries: ModelEntry[]) =>
      changes.filter((item) => entries.some((entry) => entry.slug === item.modelSlug)).map((item) => item.id);
    expect(shownChanges(partial)).toEqual(shownChanges(full));
    expect(snapshot.stats).toEqual(homeCatalogStats(full));
  });

  it("counts model sizes that fit a budget as the full list would", () => {
    const full = hydratePublishedEntries(publishedList()).entries;
    const stats = homeCatalogStats(full);
    for (const budget of [0, 7, 8, 21, 22, 23, 400]) {
      expect(modelSizesFitting(stats, budget)).toBe(
        full.filter((entry) => entry.artifacts.some((item) => item.recVramGb <= budget)).length,
      );
    }
  });
});

describe("benchmark snapshot", () => {
  it("keeps only benchmarked models and ranks them identically", () => {
    const published = publishedList();
    const full = hydratePublishedEntries(published).entries;
    const items = benchmarkSnapshot(published);
    expect(items.length).toBeLessThan(published.length);
    expect(items.every((item) => item.artifacts.every((entry) => benchmarkRepos.includes(entry.repo)))).toBe(true);
    expect(leaderboards(hydrateCatalogListItems(items).entries)).toEqual(leaderboards(full));
  });
});

describe("catalog list items", () => {
  it("keep the fields list pages render and drop the rest", () => {
    const [summary] = publishedList();
    const item = catalogListItem(summary);
    const [entry] = hydrateCatalogListItems([item]).entries;
    const [original] = hydratePublishedEntries([summary]).entries;
    const listed = (value: ModelEntry) => ({
      slug: value.slug,
      name: value.name,
      timestamp: value.timestamp,
      dateLabel: value.dateLabel,
      quantizations: value.quantizations,
      providers: value.providers,
      category: value.category,
      capabilities: value.capabilities,
      family: [value.family.id, value.family.name, value.family.vendor],
      release: [value.release.id, value.release.name, value.release.date],
      size: [value.size.label, value.size.paramsB, value.size.activeParamsB, value.size.isMoe, value.size.variants],
    });
    expect(listed(entry)).toEqual(listed(original));
    expect(item.artifacts).toEqual([]);
    expect(JSON.stringify(item).length).toBeLessThan(JSON.stringify(summary).length);
    expect(JSON.stringify(item)).not.toContain(summary.family.tags);
  });
});
