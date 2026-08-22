import { FAMILIES } from "./catalog";
import { artifactsFor } from "./fit";
import { activeParamsLabel, modelDisplayName, sizeDisplay, uploaderDisplay } from "./naming";
import { taxonomyFor, type ModelCapabilityId, type ModelCategoryId } from "./taxonomy";
import type {
  Artifact,
  Family,
  MaterialChange,
  RecipeReference,
  Release,
  RunReport,
  SizeNode,
} from "./types";

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export interface ModelArtifact extends Artifact {
  variant: string;
  gated?: boolean;
  vramEstimated?: boolean;
  lastUpdatedAt?: number;
}

export interface ModelEntry {
  id: string;
  slug: string;
  family: Family;
  release: Release;
  size: SizeNode;
  name: string;
  effectiveDate: string;
  dateLabel: string;
  updated: boolean;
  timestamp: number;
  context: string;
  artifacts: ModelArtifact[];
  quantizations: string[];
  providers: string[];
  category: ModelCategoryId;
  capabilities: ModelCapabilityId[];
  benchmarkRefs: NonNullable<SizeNode["benchmarkRefs"]>;
  recipeReferences: RecipeReference[];
  materialChanges: MaterialChange[];
  runReports: RunReport[];
}

export function compareModelEntriesByRecency(left: ModelEntry, right: ModelEntry): number {
  return right.timestamp - left.timestamp ||
    left.name.localeCompare(right.name) ||
    right.size.paramsB - left.size.paramsB ||
    left.slug.localeCompare(right.slug);
}

function dateTimestamp(value: string): number {
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return Date.UTC(
      Number(isoDate[1]),
      Number(isoDate[2]) - 1,
      Number(isoDate[3]),
    );
  }

  const fullDate = value.match(/^(\w{3}) (\d{1,2}) (\d{4})$/);
  if (fullDate) {
    return Date.UTC(
      Number(fullDate[3]),
      MONTHS[fullDate[1]] ?? 0,
      Number(fullDate[2]),
    );
  }

  const monthYear = value.match(/^(\w{3}) (\d{4})$/);
  if (monthYear) {
    return Date.UTC(Number(monthYear[2]), MONTHS[monthYear[1]] ?? 0, 1);
  }

  const years = [...value.matchAll(/\d{4}/g)].map((match) => Number(match[0]));
  return Date.UTC(years.at(-1) ?? 1970, 0, 1);
}

function dateIso(value: string): string {
  return new Date(dateTimestamp(value)).toISOString().slice(0, 10);
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const MODEL_ENTRIES: ModelEntry[] = FAMILIES.flatMap((family) =>
  family.releases.flatMap((release) =>
    release.sizes.map((size) => {
      const effectiveDate = size.updated ?? release.date;
      const artifacts = size.variants.flatMap((variant) =>
        artifactsFor(family, release, size, variant).map((artifact) => ({
          ...artifact,
          variant,
        })),
      );
      const taxonomy = taxonomyFor(family, release, size);
      const slug = `${family.id}-${release.id}-${slugPart(size.label)}`;
      return {
        id: slug,
        slug,
        family,
        release,
        size,
        name: modelDisplayName(family, release, size),
        effectiveDate,
        dateLabel: dateIso(effectiveDate),
        updated: Boolean(size.updated),
        timestamp: dateTimestamp(effectiveDate),
        context: size.context ?? release.ctx,
        artifacts,
        quantizations: [...new Set(artifacts.map((artifact) => artifact.format))],
        providers: [...new Set(artifacts.map((artifact) => uploaderDisplay(artifact.repo)))].sort(),
        benchmarkRefs: [
          ...(release.benchmarkRefs ?? []),
          ...(size.benchmarkRefs ?? []),
        ],
        recipeReferences: [],
        materialChanges: [],
        runReports: [],
        ...taxonomy,
      } satisfies ModelEntry;
    }),
  ),
).sort(compareModelEntriesByRecency);

export function modelEntryForSlug(slug: string | null): ModelEntry | null {
  return findModelEntryForSlug(MODEL_ENTRIES, slug);
}

export function findModelEntryForSlug(entries: ModelEntry[], slug: string | null): ModelEntry | null {
  return entries.find((entry) => entry.slug === slug) ?? null;
}

export function modelEntryForTarget(
  familyId: string,
  releaseId?: string,
  sizeLabel?: string,
): ModelEntry | null {
  return findModelEntryForTarget(MODEL_ENTRIES, familyId, releaseId, sizeLabel);
}

export function findModelEntryForTarget(
  entries: ModelEntry[],
  familyId: string,
  releaseId?: string,
  sizeLabel?: string,
): ModelEntry | null {
  if (!releaseId || !sizeLabel) return null;
  return (
    entries.find(
      (entry) =>
        entry.family.id === familyId &&
        entry.release.id === releaseId &&
        entry.size.label === sizeLabel,
    ) ?? null
  );
}

export function modelDescription(entry: ModelEntry): string {
  const active = activeParamsLabel(entry.size.label, entry.size.activeParamsB);
  const scale = active
    ? `${sizeDisplay(entry.size.label)} total parameters with ${active}`
    : entry.size.isMoe
      ? `${sizeDisplay(entry.size.label)} total parameters in a mixture-of-experts architecture`
    : `${sizeDisplay(entry.size.label)} parameters`;
  const context =
    entry.context === "N/A"
      ? ""
      : entry.category === "language" ||
          entry.category === "vision-documents" ||
          entry.category === "retrieval"
        ? `, supports a ${entry.context} context window`
        : `, supports ${entry.context}`;
  return `${entry.release.name} is an open-weight release from ${entry.family.vendor} focused on ${entry.family.tags}. This configuration has ${scale}${context}, and is available in ${entry.size.variants.length === 1 ? "one variant" : `${entry.size.variants.length} variants`}.`;
}
