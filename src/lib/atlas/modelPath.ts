import { compareModelEntriesByRecency, type ModelEntry } from "./models";

export interface ModelPathSelection {
  familyId?: string;
  releaseId?: string;
  slug?: string;
  variant?: string;
  format?: string;
}

/** Resolve each choice within its parent, including after a live catalog update. */
export function resolveModelPath(
  entries: ModelEntry[],
  selection: ModelPathSelection,
) {
  if (!entries.length) return null;

  const families = [
    ...new Map(
      entries.map((entry) => [entry.family.id, entry.family]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const releaseKey = (entry: ModelEntry) =>
    JSON.stringify([entry.family.id, entry.release.id]);
  const releaseCounts = new Map<string, number>();
  entries.forEach((entry) =>
    releaseCounts.set(
      releaseKey(entry),
      (releaseCounts.get(releaseKey(entry)) ?? 0) + 1,
    ),
  );
  // Show the widest set of sizes first so newcomers can try each level.
  // This is a demonstration of catalog structure, independent of model quality.
  const compareBreadth = (a: ModelEntry, b: ModelEntry) =>
    releaseCounts.get(releaseKey(b))! - releaseCounts.get(releaseKey(a))! ||
    compareModelEntriesByRecency(a, b);
  const defaultEntry = [...entries].sort(compareBreadth)[0];
  const family =
    families.find((candidate) => candidate.id === selection.familyId) ??
    defaultEntry.family;
  const familyEntries = entries
    .filter((entry) => entry.family.id === family.id)
    .sort(compareModelEntriesByRecency);
  const releases = [
    ...new Map(
      familyEntries.map((entry) => [entry.release.id, entry.release]),
    ).values(),
  ];
  const defaultRelease = [...familyEntries].sort(compareBreadth)[0].release;
  const release =
    releases.find((candidate) => candidate.id === selection.releaseId) ??
    defaultRelease;
  const sizes = familyEntries
    .filter((entry) => entry.release.id === release.id)
    .sort(
      (a, b) => a.size.paramsB - b.size.paramsB || a.slug.localeCompare(b.slug),
    );
  const entry =
    sizes.find((candidate) => candidate.slug === selection.slug) ?? sizes[0];
  const variants = [
    ...new Set([
      ...entry.size.variants,
      ...entry.artifacts.map((artifact) => artifact.variant),
    ]),
  ];
  const variant =
    variants.find((candidate) => candidate === selection.variant) ??
    variants.find((candidate) => candidate === "Instruct") ??
    variants[0];
  const variantArtifacts = entry.artifacts.filter(
    (artifact) => artifact.variant === variant,
  );
  const formats = [
    ...new Set(variantArtifacts.map((artifact) => artifact.format)),
  ].sort();
  const format = formats.includes(selection.format ?? "")
    ? selection.format!
    : "";
  const artifacts = variantArtifacts.filter(
    (artifact) => !format || artifact.format === format,
  );
  const href = `/models/${entry.slug}${variant ? `?variant=${encodeURIComponent(variant)}` : ""}`;

  return {
    families,
    family,
    releases,
    release,
    sizes,
    entry,
    variants,
    variant,
    formats,
    format,
    artifacts,
    href,
  };
}
