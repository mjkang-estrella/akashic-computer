import { activeParamsLabel, sizeDisplay } from "./naming";
import type { ModelCapabilityId, ModelCategoryId } from "./taxonomy";
import type {
  Artifact,
  Family,
  MaterialChange,
  ModelIntroduction,
  DeploymentRecipe,
  Release,
  RunReport,
  SizeNode,
} from "./types";

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
  introduction?: ModelIntroduction;
  deploymentRecipes: DeploymentRecipe[];
  materialChanges: MaterialChange[];
  runReports: RunReport[];
}

export function compareModelEntriesByRecency(left: ModelEntry, right: ModelEntry): number {
  return right.timestamp - left.timestamp ||
    left.name.localeCompare(right.name) ||
    right.size.paramsB - left.size.paramsB ||
    left.slug.localeCompare(right.slug);
}

export function findModelEntryForSlug(entries: ModelEntry[], slug: string | null): ModelEntry | null {
  return entries.find((entry) => entry.slug === slug) ?? null;
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
