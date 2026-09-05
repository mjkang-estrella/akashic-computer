import type { Doc } from "./_generated/dataModel";
import {
  estimateVram,
  modelStemForRepoId,
  type IngestionClassification,
  type MonitoredSourceRule,
} from "../src/lib/atlas/huggingface";
import type { PublishedArtifact, PublishedCatalogEntry } from "../src/lib/atlas/published";
import type { BenchKey } from "../src/lib/atlas/types";
import { uploaderDisplay } from "../src/lib/atlas/naming";
import { FAMILY_BY_ID } from "./familyConfig";

type UnknownRecord = Record<string, unknown>;
export type IngestedParsedRepo = Extract<IngestionClassification, { status: "publishable" }>["parsed"];

const NULL_DELTAS: Record<BenchKey, null> = {
  mmlu: null,
  ifeval: null,
  gpqa: null,
  hle: null,
  aime: null,
  math500: null,
  lcb: null,
  swe: null,
};

export function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, clean(entry)]),
    ) as T;
  }
  return value;
}

export function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizedIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function timestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function significantTimestamp(repo: IngestedParsedRepo["repo"], fallback?: number): number {
  return timestamp(repo.weightsLastModified) ??
    fallback ??
    timestamp(repo.createdAt) ??
    timestamp(repo.lastModified) ??
    Date.now();
}

export function dateLabel(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function releaseNameFor(parsed: IngestedParsedRepo): string {
  let value = parsed.modelStem.replace(/[-_]+/g, " ").trim();
  if (parsed.sizeLabel) {
    const escaped = parsed.sizeLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`\\s*${escaped.replace("-", "[- ]?")}\\s*$`, "i"), "").trim();
  }
  return value || parsed.modelStem;
}

export function trustForRole(role: string, hasBaseModel: boolean) {
  return role === "artifact_provider" || (role === "creator_provider" && hasBaseModel)
    ? "vendor" as const
    : "official" as const;
}

function artifactFor(
  parsed: IngestedParsedRepo,
  role: string,
  variant: string,
  fallbackParamsB?: number,
): PublishedArtifact {
  const estimate = parsed.paramsB
    ? null
    : fallbackParamsB
      ? estimateVram(fallbackParamsB, parsed.format)
      : null;
  return {
    variant,
    repo: parsed.repo.id,
    format: parsed.format,
    trust: trustForRole(role, parsed.repo.baseModels.length > 0),
    confidence: "verified",
    kinds: estimate?.kinds ?? parsed.kinds,
    runtimes: estimate?.runtimes ?? parsed.runtimes,
    minVramGb: estimate?.minVramGb ?? parsed.minVramGb ?? 0,
    recVramGb: estimate?.recVramGb ?? parsed.recVramGb ?? 0,
    vramEstimate: estimate?.details ?? parsed.vramEstimate ?? undefined,
    deltas: NULL_DELTAS,
    measured: false,
    qualityRank: 99,
    gated: parsed.repo.gated,
    vramEstimated: true,
    lastUpdatedAt: significantTimestamp(parsed.repo),
  };
}

export function sourceRule(source: UnknownRecord): MonitoredSourceRule {
  return {
    owner: String(source.owner),
    role: source.role as MonitoredSourceRule["role"],
    familyIds: Array.isArray(source.familyIds) ? source.familyIds.map(String) : [],
    includePatterns: Array.isArray(source.includePatterns) ? source.includePatterns.map(String) : undefined,
    excludePatterns: Array.isArray(source.excludePatterns) ? source.excludePatterns.map(String) : undefined,
  };
}

export function targetForParsed(
  documents: Array<Doc<"catalogEntries">>,
  parsed: IngestedParsedRepo,
  rule: MonitoredSourceRule,
) {
  // Existing links are evidence, not authority: older ingestion used substring matches.
  const stem = normalizedIdentity(parsed.modelStem);
  const candidates = documents.filter((document) => {
    if (!rule.familyIds.includes(document.familyId)) return false;
    const release = normalizedIdentity(document.payload.release.name);
    const identity = normalizedIdentity(`${document.payload.release.name}${document.payload.size.label}`);
    const sameSize = parsed.sizeLabel
      ? normalizedIdentity(parsed.sizeLabel) === normalizedIdentity(document.payload.size.label)
      : false;
    return (stem === identity || (stem === release && sameSize));
  });
  if (rule.role === "creator" || (rule.role === "creator_provider" && !parsed.repo.baseModels.length)) {
    return candidates.length === 1 ? candidates[0] : null;
  }
  // All declared bases must resolve to one model. Multi-base merges are not quantizations.
  if (!parsed.repo.baseModels.every((base) => normalizedIdentity(modelStemForRepoId(base)) === stem)) return null;
  const bases = parsed.repo.baseModels.map((base) => documents.filter((document) =>
    document.sourceRepos.some((repo) => repo.toLowerCase() === base.toLowerCase()),
  ));
  if (!bases.length || bases.some((matches) => matches.length !== 1)) return null;
  const linked = [...new Set(bases.map((matches) => matches[0]))];
  if (linked.length !== 1) return null;
  return linked[0];
}

export function familyForParsed(
  documents: Array<Doc<"catalogEntries">>,
  parsed: IngestedParsedRepo,
  rule: MonitoredSourceRule,
): PublishedCatalogEntry["family"] | null {
  const identities = new Map<string, PublishedCatalogEntry["family"]>();
  for (const familyId of rule.familyIds) {
    const configured = FAMILY_BY_ID.get(familyId);
    if (configured) identities.set(familyId, configured);
  }
  for (const document of documents) {
    if (rule.familyIds.includes(document.familyId)) {
      identities.set(document.payload.family.id, document.payload.family);
    }
  }
  const stem = normalizedIdentity(parsed.modelStem);
  const matching = [...identities.values()].filter((family) =>
    stem.includes(normalizedIdentity(family.name)) || stem.includes(normalizedIdentity(family.id)),
  );
  if (matching.length === 1) return matching[0];
  return identities.size === 1 ? [...identities.values()][0] : null;
}

export function newPayload(
  family: PublishedCatalogEntry["family"],
  parsed: IngestedParsedRepo,
): PublishedCatalogEntry | null {
  if (!parsed.paramsB || !parsed.sizeLabel || !parsed.category) return null;
  const updatedAt = significantTimestamp(parsed.repo);
  const releaseName = releaseNameFor(parsed);
  const releaseId = slugPart(releaseName);
  const artifact = artifactFor(parsed, "creator", parsed.variant);
  const benchmarkRefs = parsed.benchmarkRows.map((row) => ({ ...row }));
  const slug = `${family.id}-${releaseId}-${slugPart(parsed.sizeLabel)}`;
  return {
    id: slug,
    slug,
    family,
    release: {
      id: releaseId,
      name: releaseName,
      date: dateLabel(timestamp(parsed.repo.createdAt) ?? updatedAt),
      ctx: parsed.contextLabel,
      license: parsed.repo.license ?? "Unknown",
      category: parsed.category,
      capabilities: parsed.capabilities,
      benchmarkRefs,
    },
    size: {
      label: parsed.sizeLabel,
      paramsB: parsed.paramsB,
      activeParamsB: parsed.activeParamsB ?? undefined,
      isMoe: parsed.isMoe || undefined,
      variants: [parsed.variant],
      context: parsed.contextLabel,
      updated: dateLabel(updatedAt),
      category: parsed.category,
      capabilities: parsed.capabilities,
      benchmarkRefs,
    },
    name: `${releaseName} ${parsed.sizeLabel.replace(/-A\d+(?:\.\d+)?B$/i, "")}`,
    effectiveDate: dateLabel(updatedAt),
    dateLabel: dateLabel(updatedAt),
    updated: true,
    timestamp: updatedAt,
    context: parsed.contextLabel,
    artifacts: [artifact],
    quantizations: [parsed.format],
    providers: [uploaderDisplay(parsed.repo.id)],
    category: parsed.category,
    capabilities: parsed.capabilities,
    benchmarkRefs,
    deploymentRecipes: [],
    materialChanges: [],
    runReports: [],
  };
}

export function mergeParsedIntoPayload(
  original: PublishedCatalogEntry,
  parsed: IngestedParsedRepo,
  role: string,
  previousRepoName?: string,
): PublishedCatalogEntry {
  const updatedAt = significantTimestamp(parsed.repo, original.timestamp);
  const existingIndex = original.artifacts.findIndex(
    (artifact) => artifact.repo === parsed.repo.id || artifact.repo === previousRepoName,
  );
  const existing = existingIndex >= 0 ? original.artifacts[existingIndex] : undefined;
  const variant = existing?.variant ?? parsed.variant;
  const nextArtifact = artifactFor(parsed, role, variant, original.size.paramsB);
  const artifacts = existing
    ? original.artifacts.map((artifact, index) =>
        index === existingIndex ? { ...artifact, ...nextArtifact, qualityRank: artifact.qualityRank } : artifact)
    : [...original.artifacts, nextArtifact];
  const canonicalRepo = original.artifacts[0]?.repo;
  const updatesCanonicalWeights = trustForRole(role, parsed.repo.baseModels.length > 0) === "official" &&
    existing?.repo === canonicalRepo;
  const modelUpdatedAt = updatesCanonicalWeights ? updatedAt : original.timestamp;
  const canonicalParamsB = updatesCanonicalWeights ? parsed.paramsB ?? original.size.paramsB : original.size.paramsB;
  const canonicalSizeLabel = updatesCanonicalWeights ? parsed.sizeLabel ?? original.size.label : original.size.label;
  const canonicalContext = updatesCanonicalWeights && parsed.contextTokens ? parsed.contextLabel : original.context;
  const benchmarkRefs = [...original.benchmarkRefs];
  for (const row of parsed.benchmarkRows) {
    if (!benchmarkRefs.some((existingRow) => existingRow.name === row.name && existingRow.sourceUrl === row.sourceUrl)) {
      benchmarkRefs.push(row);
    }
  }
  return {
    ...original,
    id: original.slug,
    name: updatesCanonicalWeights ? `${original.release.name} ${canonicalSizeLabel}` : original.name,
    effectiveDate: dateLabel(modelUpdatedAt),
    dateLabel: dateLabel(modelUpdatedAt),
    updated: true,
    timestamp: modelUpdatedAt,
    context: canonicalContext,
    release: updatesCanonicalWeights
      ? {
          ...original.release,
          ...(parsed.repo.license ? { license: parsed.repo.license } : {}),
          ...(parsed.contextTokens ? { ctx: parsed.contextLabel } : {}),
        }
      : original.release,
    size: {
      ...original.size,
      label: canonicalSizeLabel,
      variants: [...new Set([...original.size.variants, variant])],
      paramsB: canonicalParamsB,
      updated: updatesCanonicalWeights ? dateLabel(modelUpdatedAt) : original.size.updated,
      context: canonicalContext,
      activeParamsB: updatesCanonicalWeights ? parsed.activeParamsB ?? original.size.activeParamsB : original.size.activeParamsB,
      isMoe: updatesCanonicalWeights ? parsed.isMoe || original.size.isMoe || undefined : original.size.isMoe,
    },
    artifacts,
    quantizations: [...new Set(artifacts.map((artifact) => artifact.format))],
    providers: [...new Set(artifacts.map((artifact) => uploaderDisplay(artifact.repo)))].sort(),
    benchmarkRefs,
  };
}
