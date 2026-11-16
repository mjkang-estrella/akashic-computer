import { compareModelEntriesByRecency, type ModelEntry } from "./models";
import { modelReleaseName } from "./naming";

// Explicit release rule: distillation can create an entirely different model family.
// Never strip distill/spec globally or change ingestion identities to group a view.
const SIGMA_REPO = /^nvidia\/Nemotron-Labs-Sigma(?:-distill(?:-spec)?)?-(3B|8B)(?:-(instruct|base|nfe(?:2|4|8|16)))?(?:[-_.](?:BF16|FP8|NVFP4|GGUF))?$/i;
const SIGMA_RELEASE = /^nemotron-labs-sigma(?:-distill(?:-spec)?)?(?:-(?:3b|8b))?(?:-(?:instruct|base|nfe(?:2|4|8|16)))?$/i;

export function isSigmaRepo(repo: string): boolean {
  return SIGMA_REPO.test(repo);
}

function isSigmaEntry(entry: ModelEntry): boolean {
  return entry.family.id === "nemotron" && entry.category === "language" &&
    SIGMA_RELEASE.test(entry.release.id);
}

function sigmaVariant(identity: string): string {
  if (/-distill-spec(?:-|$)/i.test(identity)) return "Self-speculative";
  if (/-distill(?:-|$)/i.test(identity)) {
    const nfe = identity.match(/-nfe(\d+)(?:[-_.]|$)/i)?.[1];
    return nfe ? `Distilled · NFE ${nfe}` : "Distilled";
  }
  return /-instruct(?:[-_.]|$)/i.test(identity) ? "Instruct" : "Base";
}

/** An entry may contain multiple checkpoints (notably Sigma Base + Instruct). */
export function checkpointVariants(entry: ModelEntry): string[] {
  if (!isSigmaEntry(entry)) return entry.size.variants;
  const repos = entry.artifacts.map((artifact) => artifact.repo).filter(isSigmaRepo);
  // Compact list snapshots carry release identity even when no artifacts are present.
  const variants = repos.length ? repos.map(sigmaVariant) : [sigmaVariant(entry.release.id)];
  return [...new Set(variants)].sort((a, b) => variantRank(a) - variantRank(b));
}

export function catalogVariants(entry: ModelEntry): string[] {
  const variants = checkpointVariants(entry);
  return variants.some((variant) => variant.startsWith("Distilled ·")) ? ["Distilled", ...variants] : variants;
}

function variantRank(variant: string): number {
  if (variant === "Base") return 0;
  if (variant === "Instruct") return 1;
  if (variant.startsWith("Distilled")) return 10 + Number(variant.match(/NFE (\d+)/)?.[1] ?? 0);
  return 100;
}

export interface CatalogGroup {
  key: string;
  title: string;
  grouped: boolean;
  members: ModelEntry[];
  latest: ModelEntry;
  sizes: string[];
  quantizations: string[];
}

/** Filter original entries first; grouping never combines metadata or changes URLs. */
export function groupCatalogEntries(entries: readonly ModelEntry[]): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>();
  for (const entry of entries) {
    const grouped = isSigmaEntry(entry);
    const key = grouped ? "nemotron:language:nemotron-labs-sigma" : `entry:${entry.slug}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, title: grouped ? "Nemotron Labs Sigma" : modelReleaseName(entry.family, entry.release), grouped, members: [], latest: entry, sizes: [], quantizations: [] };
      groups.set(key, group);
    }
    group.members.push(entry);
    if (compareModelEntriesByRecency(entry, group.latest) < 0) group.latest = entry;
  }
  for (const group of groups.values()) {
    group.members.sort((a, b) => a.size.paramsB - b.size.paramsB ||
      variantRank(checkpointVariants(a)[0]) - variantRank(checkpointVariants(b)[0]) || a.slug.localeCompare(b.slug));
    group.sizes = [...new Set(group.members.map((entry) => entry.size.label))];
    group.quantizations = [...new Set(group.members.flatMap((entry) => entry.quantizations))].sort();
  }
  return [...groups.values()].sort((a, b) => compareModelEntriesByRecency(a.latest, b.latest) || a.key.localeCompare(b.key));
}
