import type { ModelEntry } from "./models";
import type {
  Artifact,
  Family,
  Release,
  SizeNode,
} from "./types";

export type FamilyIdentity = Omit<Family, "releases">;
export type ReleaseIdentity = Omit<Release, "sizes">;
export type PublishedSize = Omit<SizeNode, "curatedArtifacts">;

export interface PublishedArtifact extends Artifact {
  variant: string;
  gated?: boolean;
  vramEstimated?: boolean;
  lastUpdatedAt?: number;
}

export interface PublishedArtifactSummary {
  repo: string;
  format: string;
  variant: string;
  runtimes: string[];
  recVramGb: number;
}

export interface PublishedCatalogEntry
  extends Omit<ModelEntry, "family" | "release" | "size" | "artifacts"> {
  family: FamilyIdentity;
  release: ReleaseIdentity;
  size: PublishedSize;
  artifacts: PublishedArtifact[];
}

export type PublishedCatalogSummary = Omit<
  PublishedCatalogEntry,
  "artifacts" | "benchmarkRefs" | "introduction" | "deploymentRecipes" | "materialChanges" | "runReports" | "size" | "release"
> & {
  release: Omit<ReleaseIdentity, "benchmarkRefs">;
  size: Omit<PublishedSize, "benchmarkRefs" | "scores">;
  artifacts: PublishedArtifactSummary[];
};

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutUndefined) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, withoutUndefined(entry)]),
    ) as T;
  }
  return value;
}

function withoutKey<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

export function publishableEntry(entry: ModelEntry): PublishedCatalogEntry {
  const family = withoutKey(entry.family, "releases");
  const release = withoutKey(entry.release, "sizes");
  const size = withoutKey(entry.size, "curatedArtifacts");
  return withoutUndefined({
    ...entry,
    family: withoutUndefined(family),
    release: withoutUndefined(release),
    size: withoutUndefined(size),
    artifacts: entry.artifacts.map((artifact) => withoutUndefined(artifact)),
  });
}

export function catalogSummary(entry: PublishedCatalogEntry): PublishedCatalogSummary {
  const summary = withoutKey(
    withoutKey(
      withoutKey(
        withoutKey(withoutKey(entry, "benchmarkRefs"), "introduction"),
        "deploymentRecipes",
      ),
      "materialChanges",
    ),
    "runReports",
  );
  const release = withoutKey(summary.release, "benchmarkRefs");
  const size = withoutKey(withoutKey(summary.size, "benchmarkRefs"), "scores");
  return {
    ...summary,
    release,
    size,
    artifacts: entry.artifacts.map((artifact) => ({
      repo: artifact.repo,
      format: artifact.format,
      variant: artifact.variant,
      runtimes: artifact.runtimes,
      recVramGb: artifact.recVramGb,
    })),
  };
}

export function hydratePublishedEntries(
  payloads: Array<PublishedCatalogEntry | PublishedCatalogSummary>,
): {
  families: Family[];
  entries: ModelEntry[];
} {
  const familyMap = new Map<string, Family>();
  const releaseMaps = new Map<string, Map<string, Release>>();

  for (const payload of payloads) {
    let family = familyMap.get(payload.family.id);
    if (!family) {
      family = { ...payload.family, releases: [] };
      familyMap.set(family.id, family);
      releaseMaps.set(family.id, new Map());
    }
    const releaseMap = releaseMaps.get(family.id)!;
    let release = releaseMap.get(payload.release.id);
    if (!release) {
      release = { ...payload.release, sizes: [] };
      releaseMap.set(release.id, release);
      family.releases.push(release);
    }
    if (!release.sizes.some((size) => size.label === payload.size.label)) {
      release.sizes.push({ ...payload.size });
    }
  }

  const families = [...familyMap.values()];
  const entries = payloads.map((payload): ModelEntry => {
    const family = familyMap.get(payload.family.id)!;
    const release = releaseMaps.get(family.id)!.get(payload.release.id)!;
    const size = release.sizes.find((candidate) => candidate.label === payload.size.label)!;
    return {
      ...payload,
      id: payload.slug,
      family,
      release,
      size,
      artifacts: payload.artifacts.map((artifact) => ({
        trust: "official" as const,
        confidence: "needs_review" as const,
        kinds: [],
        minVramGb: artifact.recVramGb,
        deltas: {
          mmlu: null,
          ifeval: null,
          gpqa: null,
          hle: null,
          aime: null,
          math500: null,
          lcb: null,
          swe: null,
        },
        measured: false,
        qualityRank: 99,
        ...artifact,
      })),
      benchmarkRefs: "benchmarkRefs" in payload ? payload.benchmarkRefs : [],
      introduction: "introduction" in payload ? payload.introduction : undefined,
      deploymentRecipes: "deploymentRecipes" in payload ? payload.deploymentRecipes ?? [] : [],
      materialChanges: "materialChanges" in payload ? payload.materialChanges ?? [] : [],
      runReports: "runReports" in payload ? payload.runReports ?? [] : [],
    };
  });

  return { families, entries };
}
