import type { ModelEntry } from "./models";
import type {
  Artifact,
  CompareModel,
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

export interface PublishedCatalogEntry
  extends Omit<ModelEntry, "family" | "release" | "size" | "artifacts"> {
  family: FamilyIdentity;
  release: ReleaseIdentity;
  size: PublishedSize;
  artifacts: PublishedArtifact[];
}

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

export function hydratePublishedEntries(payloads: PublishedCatalogEntry[]): {
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
      family,
      release,
      size,
      artifacts: payload.artifacts,
    };
  });

  return { families, entries };
}

export function compareModelsForEntries(entries: ModelEntry[]): CompareModel[] {
  return entries.flatMap((entry) =>
    entry.size.variants.flatMap((variant) => {
      const scores = entry.size.scores?.[variant];
      if (!scores) return [];
      return [
        {
          id: `${entry.family.id}-${entry.release.id}-${entry.size.label}-${variant}`,
          name: entry.name,
          family: entry.family,
          release: entry.release,
          size: entry.size,
          variant,
          scores,
          artifacts: entry.artifacts
            .filter((artifact) => artifact.variant === variant)
            .map((artifact) => withoutKey(artifact, "variant")),
        } satisfies CompareModel,
      ];
    }),
  );
}
