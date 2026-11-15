import type { ModelEntry } from "./models";
import { modelReleaseName } from "./naming";
import {
  catalogListItem,
  hydratePublishedEntries,
  type CatalogListItem,
  type PublishedCatalogSummary,
} from "./published";
import type { MaterialChange } from "./types";

const DAY_MS = 86_400_000;
/** The home timeline covers roughly six months, ending at the newest release. */
export const TIMELINE_DAYS = 183;
const LATEST_RELEASE_COUNT = 6;
const CATALOG_FIELD_SIZE = 28;

export function releaseTimestamp(entry: ModelEntry): number {
  const parsed = Date.parse(entry.release.date);
  return Number.isFinite(parsed) ? parsed : entry.timestamp;
}

/** The most recently updated model sizes, drawn as the bars beside the home title. */
export function recentlyUpdatedEntries(entries: ModelEntry[]): ModelEntry[] {
  return [...entries]
    .sort((a, b) => b.timestamp - a.timestamp || b.size.paramsB - a.size.paramsB)
    .slice(0, CATALOG_FIELD_SIZE);
}

export interface TimelineSize {
  slug: string;
  label: string;
  paramsB: number;
  /** Artificial Analysis Intelligence Index, when this exact checkpoint was evaluated. */
  score: number | null;
}

/** Catalog slug → Intelligence Index. */
export type IntelligenceScores = Record<string, number>;

/** One release (family + release id) with every model size it shipped. */
export interface TimelineRelease {
  key: string;
  name: string;
  vendor: string;
  familyId: string;
  familyName: string;
  releasedAt: number;
  /** Largest first. */
  sizes: TimelineSize[];
  /** Best Intelligence Index among the release's sizes. */
  score: number | null;
}

function releaseKey(entry: ModelEntry): string {
  return `${entry.family.id}/${entry.release.id}`;
}

/** Releases newest first; ties resolve by name so every caller sees one order. */
export function groupReleases(entries: ModelEntry[], scores: IntelligenceScores = {}): TimelineRelease[] {
  const releases = new Map<string, TimelineRelease>();
  for (const entry of entries) {
    if (!(entry.size.paramsB > 0)) continue;
    const key = releaseKey(entry);
    let release = releases.get(key);
    if (!release) {
      release = {
        key,
        name: modelReleaseName(entry.family, entry.release),
        vendor: entry.family.vendor,
        familyId: entry.family.id,
        familyName: entry.family.name,
        releasedAt: releaseTimestamp(entry),
        sizes: [],
        score: null,
      };
      releases.set(key, release);
    }
    release.sizes.push({
      slug: entry.slug,
      label: entry.size.label,
      paramsB: entry.size.paramsB,
      score: scores[entry.slug] ?? null,
    });
  }
  for (const release of releases.values()) {
    release.sizes.sort((a, b) => b.paramsB - a.paramsB || a.slug.localeCompare(b.slug));
    const scored = release.sizes.flatMap((size) => size.score ?? []);
    release.score = scored.length ? Math.max(...scored) : null;
  }
  return [...releases.values()].sort(
    (a, b) => b.releasedAt - a.releasedAt || a.name.localeCompare(b.name) || a.key.localeCompare(b.key),
  );
}

/** A release that raised the best open-weight Intelligence Index to date. */
export interface FrontierStep {
  key: string;
  name: string;
  releasedAt: number;
  score: number;
}

export interface ReleaseTimeline {
  start: number;
  end: number;
  releases: TimelineRelease[];
  /**
   * Best score to date, oldest first. The first step may predate `start`: it is the record
   * the window opens with, so the window's first release is not mistaken for a new high.
   */
  frontier: FrontierStep[];
}

const byFrontierRank = (a: TimelineRelease, b: TimelineRelease) =>
  (b.score ?? 0) - (a.score ?? 0) || b.releasedAt - a.releasedAt || a.key.localeCompare(b.key);

function frontierStep(release: TimelineRelease): FrontierStep {
  return { key: release.key, name: release.name, releasedAt: release.releasedAt, score: release.score as number };
}

/** The scored release holding the record when the window opens, if any. */
function recordBefore(releases: TimelineRelease[], start: number): TimelineRelease | undefined {
  return releases
    .filter((release) => release.score !== null && release.releasedAt < start)
    .sort(byFrontierRank)[0];
}

function windowStart(releases: TimelineRelease[]): { start: number; end: number } {
  const end = releases[0]?.releasedAt ?? 0;
  return { start: end - TIMELINE_DAYS * DAY_MS, end };
}

/** Every release in the six months up to (and including) the newest one. */
export function releaseTimeline(entries: ModelEntry[], scores: IntelligenceScores = {}): ReleaseTimeline {
  const all = groupReleases(entries, scores);
  const { start, end } = windowStart(all);
  const releases = all.filter((release) => release.releasedAt >= start);

  const frontier: FrontierStep[] = [];
  const opening = recordBefore(all, start);
  if (opening) frontier.push(frontierStep(opening));
  // Same-day releases resolve highest first, so only the day's best can set the record.
  const chronological = releases
    .filter((release) => release.score !== null)
    .sort((a, b) => a.releasedAt - b.releasedAt || byFrontierRank(a, b));
  for (const release of chronological) {
    if ((release.score as number) > (frontier[frontier.length - 1]?.score ?? -Infinity)) {
      frontier.push(frontierStep(release));
    }
  }
  return { start, end, releases, frontier };
}

/** The newest releases, listed under the timeline. */
export function latestReleases(entries: ModelEntry[]): TimelineRelease[] {
  return groupReleases(entries).slice(0, LATEST_RELEASE_COUNT);
}

/** Catalog-wide counts the home page shows alongside its handful of entries. */
export interface HomeCatalogStats {
  modelSizes: number;
  families: number;
  weightFormats: number;
}

export function homeCatalogStats(entries: ModelEntry[]): HomeCatalogStats {
  return {
    modelSizes: entries.length,
    families: new Set(entries.map((entry) => entry.family.id)).size,
    weightFormats: new Set(entries.flatMap((entry) => entry.quantizations)).size,
  };
}

/**
 * The home page renders a fraction of the catalog: the recently updated bars, the release
 * timeline, the latest releases and recent changes. The server sends only those, in list order so sorting
 * ties resolve as they would against the full list, plus the counts.
 */
export function homeSnapshot(
  entries: PublishedCatalogSummary[],
  changes: MaterialChange[],
  scores: IntelligenceScores = {},
): { entries: CatalogListItem[]; stats: HomeCatalogStats } {
  const hydrated = hydratePublishedEntries(entries).entries;
  const all = groupReleases(hydrated, scores);
  const opening = recordBefore(all, windowStart(all).start);
  const shownReleases = new Set([
    ...releaseTimeline(hydrated).releases.map((release) => release.key),
    ...latestReleases(hydrated).map((release) => release.key),
    // The frontier opens at the best score before the window.
    ...(opening ? [opening.key] : []),
  ]);
  const shownModels = new Set([
    ...recentlyUpdatedEntries(hydrated).map((entry) => entry.slug),
    ...changes.map((change) => change.modelSlug),
  ]);
  const shown = new Set(
    hydrated
      .filter((entry) => shownReleases.has(releaseKey(entry)) || shownModels.has(entry.slug))
      .map((entry) => entry.slug),
  );
  return {
    entries: entries
      .filter((entry) => shown.has(entry.slug))
      .map((entry) => catalogListItem(entry)),
    stats: homeCatalogStats(hydrated),
  };
}
