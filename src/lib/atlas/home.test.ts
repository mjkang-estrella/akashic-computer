import { describe, expect, it } from "vitest";
import { artifact, modelEntry } from "../../../test/catalogFixture";
import { benchmarkSnapshot, OFFICIAL_BENCHMARKS, resolveOfficialBenchmarks } from "./benchmarks";
import {
  groupReleases,
  homeCatalogStats,
  homeSnapshot,
  latestReleases,
  recentlyUpdatedEntries,
  releaseTimeline,
  TIMELINE_DAYS,
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
    expect(releaseTimeline(partial)).toEqual(releaseTimeline(full));
    expect(releaseTimeline(full).releases.length).toBeGreaterThan(0);
    expect(latestReleases(partial)).toEqual(latestReleases(full));
    const slugs = (entries: ModelEntry[]) => entries.map((entry) => entry.slug);
    expect(slugs(recentlyUpdatedEntries(partial))).toEqual(slugs(recentlyUpdatedEntries(full)));
    const shownChanges = (entries: ModelEntry[]) =>
      changes.filter((item) => entries.some((entry) => entry.slug === item.modelSlug)).map((item) => item.id);
    expect(shownChanges(partial)).toEqual(shownChanges(full));
    expect(snapshot.stats).toEqual(homeCatalogStats(full));
  });

  it("groups model sizes into releases, largest size first, newest release first", () => {
    const full = hydratePublishedEntries(publishedList()).entries;
    const releases = groupReleases(full);
    expect(releases.reduce((count, release) => count + release.sizes.length, 0)).toBe(full.length);
    for (const release of releases) {
      const params = release.sizes.map((size) => size.paramsB);
      expect(params).toEqual([...params].sort((a, b) => b - a));
    }
    const dates = releases.map((release) => release.releasedAt);
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("carries each size's score and the release's best score", () => {
    const full = hydratePublishedEntries(publishedList()).entries;
    const [release] = groupReleases(full);
    const [first, second] = release.sizes;
    const scored = groupReleases(full, { [first.slug]: 12.5, ...(second ? { [second.slug]: 30.1 } : {}) })[0];
    expect(scored.sizes.find((size) => size.slug === first.slug)?.score).toBe(12.5);
    expect(scored.score).toBe(second ? 30.1 : 12.5);
    expect(groupReleases(full)[0].score).toBeNull();
  });

  it("draws the frontier as record scores only, opening with the best score before the window", () => {
    const full = hydratePublishedEntries(publishedList()).entries;
    const all = groupReleases(full);
    const { start } = releaseTimeline(full);
    const before = all.filter((release) => release.releasedAt < start);
    const inside = all.filter((release) => release.releasedAt >= start).reverse();
    const scores: Record<string, number> = {
      [before[0].sizes[0].slug]: 30,
      [before[1].sizes[0].slug]: 20,
      [inside[0].sizes[0].slug]: 25,
      [inside[1].sizes[0].slug]: 35,
      [inside[2].sizes[0].slug]: 33,
    };
    const frontier = releaseTimeline(full, scores).frontier;
    expect(frontier.map((step) => step.score)).toEqual([30, 35]);
    expect(frontier[0].releasedAt).toBeLessThan(start);
    expect(releaseTimeline(full).frontier).toEqual([]);

    // The snapshot keeps the record holder from before the window, so the line opens at the same height.
    const published = publishedList();
    const partial = hydrateCatalogListItems(homeSnapshot(published, [], scores).entries).entries;
    expect(releaseTimeline(partial, scores).frontier).toEqual(frontier);
  });

  it("limits the timeline to six months ending at the newest release", () => {
    const full = hydratePublishedEntries(publishedList()).entries;
    const timeline = releaseTimeline(full);
    expect(timeline.end).toBe(groupReleases(full)[0].releasedAt);
    expect(timeline.end - timeline.start).toBe(TIMELINE_DAYS * 86_400_000);
    expect(timeline.releases.every((release) => release.releasedAt >= timeline.start)).toBe(true);
    expect(timeline.releases.length).toBeLessThan(groupReleases(full).length);
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
