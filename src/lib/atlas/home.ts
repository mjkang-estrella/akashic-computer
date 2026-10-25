import { hasOfficialBenchmarkResult } from "./benchmarks";
import type { ModelEntry } from "./models";
import {
  catalogListItem,
  hydratePublishedEntries,
  type CatalogListItem,
  type PublishedCatalogSummary,
} from "./published";
import type { MaterialChange } from "./types";

const CATALOG_FIELD_SIZE = 28;
const NEW_MODEL_COUNT = 6;

export function releaseTimestamp(entry: ModelEntry): number {
  const parsed = Date.parse(entry.release.date);
  return Number.isFinite(parsed) ? parsed : entry.timestamp;
}

/** The most recently updated model sizes, drawn as the home catalog field. */
export function recentlyUpdatedEntries(entries: ModelEntry[]): ModelEntry[] {
  return [...entries]
    .sort((a, b) => b.timestamp - a.timestamp || b.size.paramsB - a.size.paramsB)
    .slice(0, CATALOG_FIELD_SIZE);
}

/** The newest releases, listed under "New models". */
export function newestReleaseEntries(entries: ModelEntry[]): ModelEntry[] {
  return [...entries]
    .sort(
      (a, b) =>
        releaseTimestamp(b) - releaseTimestamp(a) ||
        a.name.localeCompare(b.name) ||
        b.size.paramsB - a.size.paramsB,
    )
    .slice(0, NEW_MODEL_COUNT);
}

/** Catalog-wide counts the home page shows alongside its handful of entries. */
export interface HomeCatalogStats {
  modelSizes: number;
  families: number;
  weightFormats: number;
  /** Each model size's smallest listed artifact estimate, ascending; sizes without one are omitted. */
  smallestArtifactGb: number[];
}

export function homeCatalogStats(entries: ModelEntry[]): HomeCatalogStats {
  return {
    modelSizes: entries.length,
    families: new Set(entries.map((entry) => entry.family.id)).size,
    weightFormats: new Set(entries.flatMap((entry) => entry.quantizations)).size,
    smallestArtifactGb: entries
      .map((entry) => Math.min(...entry.artifacts.map((artifact) => artifact.recVramGb)))
      .filter(Number.isFinite)
      .sort((a, b) => a - b),
  };
}

/** Model sizes with at least one artifact estimated to fit the budget. */
export function modelSizesFitting(stats: HomeCatalogStats, budgetGb: number): number {
  let count = 0;
  for (const gb of stats.smallestArtifactGb) {
    if (gb > budgetGb) break;
    count += 1;
  }
  return count;
}

/**
 * The home page renders a few dozen entries out of the whole catalog: the catalog field,
 * new models, recent changes and benchmark results. The server sends only those, in list
 * order so sorting ties resolve as they would against the full list, plus the counts.
 */
export function homeSnapshot(
  entries: PublishedCatalogSummary[],
  changes: MaterialChange[],
): { entries: CatalogListItem[]; stats: HomeCatalogStats } {
  const hydrated = hydratePublishedEntries(entries).entries;
  const shown = new Set([
    ...recentlyUpdatedEntries(hydrated).map((entry) => entry.slug),
    ...newestReleaseEntries(hydrated).map((entry) => entry.slug),
    ...changes.map((change) => change.modelSlug),
    ...hydrated
      .filter((entry) => entry.artifacts.some((artifact) => hasOfficialBenchmarkResult(artifact.repo)))
      .map((entry) => entry.slug),
  ]);
  return {
    entries: entries
      .filter((entry) => shown.has(entry.slug))
      .map((entry) => catalogListItem(entry, hasOfficialBenchmarkResult)),
    stats: homeCatalogStats(hydrated),
  };
}
