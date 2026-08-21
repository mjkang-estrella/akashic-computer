import type {
  MaterialChange,
  RecipeHardware,
  RecipeReference,
  RecipeVariant,
} from "./types";

type UnknownRecord = Record<string, unknown>;

export interface VllmRecipeIndexItem {
  hf_id: string;
  title?: string;
  provider?: string;
  url?: string;
  json?: string;
  derived_from?: string;
}

export interface ParsedRecipeReference extends RecipeReference {
  contentHash: string;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function timestamp(value: unknown): number | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const candidate = text(item);
    return candidate ? [candidate] : [];
  });
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function stableHash(value: unknown): string {
  const input = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function hardwareList(
  value: unknown,
  labels: Record<string, string>,
): RecipeHardware[] {
  return Object.entries(record(value))
    .filter(([, state]) => state === "verified")
    .map(([id]) => ({ id, label: labels[id] ?? id.replaceAll("_", " ") }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function variantsFor(raw: UnknownRecord, hfId: string): RecipeVariant[] {
  const model = record(raw.model);
  const variants = record(raw.variants);
  const defaultModelId = text(model.model_id) ?? hfId;
  const minimumVersion = text(model.min_vllm_version);
  const parsed = Object.entries(variants).flatMap(([key, value]) => {
    const variant = record(value);
    const precision = text(variant.precision);
    if (!precision) return [];
    return [{
      key,
      modelId: text(variant.model_id) ?? defaultModelId,
      precision: precision.toUpperCase(),
      minimumVramGb: number(variant.vram_minimum_gb),
      minimumVllmVersion: text(variant.min_vllm_version) ?? minimumVersion,
      description: text(variant.description),
    } satisfies RecipeVariant];
  });
  return parsed.length > 0
    ? parsed
    : [{ key: "default", modelId: defaultModelId, precision: "DEFAULT" }];
}

export function parseVllmRecipe(
  index: VllmRecipeIndexItem,
  raw: unknown,
  sourceSha: string,
  hardwareLabels: Record<string, string>,
): ParsedRecipeReference | null {
  const recipe = record(raw);
  const meta = record(recipe.meta);
  const model = record(recipe.model);
  const hfId = text(recipe.hf_id) ?? text(index.hf_id);
  if (!hfId || !hfId.includes("/")) return null;
  const variants = variantsFor(recipe, hfId);
  const artifactRepos = [...new Set([
    hfId,
    text(model.model_id),
    ...variants.map((variant) => variant.modelId),
  ].filter((value): value is string => Boolean(value)))];
  const sitePath = text(index.url) ?? `/${text(meta.derived_from) ?? hfId}`;
  const reference: RecipeReference = {
    provider: "vllm",
    upstreamId: hfId,
    title: text(meta.title) ?? text(index.title) ?? hfId.split("/").at(-1) ?? hfId,
    publisher: text(meta.provider) ?? text(index.provider) ?? hfId.split("/")[0],
    description: text(meta.description) ?? "Community-maintained deployment recipe for vLLM.",
    recipeUrl: new URL(sitePath, "https://recipes.vllm.ai").toString(),
    sourceUrl: `https://github.com/vllm-project/recipes/tree/${sourceSha}`,
    sourceSha,
    upstreamUpdatedAt: timestamp(meta.date_updated),
    minimumVllmVersion: text(model.min_vllm_version),
    difficulty: ["beginner", "intermediate", "advanced"].includes(text(meta.difficulty) ?? "")
      ? text(meta.difficulty) as RecipeReference["difficulty"]
      : undefined,
    tasks: stringArray(meta.tasks),
    features: Object.keys(record(recipe.features)).sort(),
    verifiedHardware: hardwareList(meta.hardware, hardwareLabels),
    variants,
    artifactRepos,
  };
  return {
    ...reference,
    contentHash: stableHash({
      provider: reference.provider,
      upstreamId: reference.upstreamId,
      title: reference.title,
      publisher: reference.publisher,
      description: reference.description,
      recipeUrl: reference.recipeUrl,
      upstreamUpdatedAt: reference.upstreamUpdatedAt,
      minimumVllmVersion: reference.minimumVllmVersion,
      difficulty: reference.difficulty,
      tasks: reference.tasks,
      features: reference.features,
      verifiedHardware: reference.verifiedHardware,
      variants: reference.variants,
      artifactRepos: reference.artifactRepos,
    }),
  };
}

export function materialChangeId(
  modelSlug: string,
  type: MaterialChange["type"],
  sourceKey: string,
): string {
  return `${modelSlug}:${type}:${stableHash(sourceKey)}`;
}

export function changeDateLabel(occurredAt: number): string {
  return new Date(occurredAt).toISOString().slice(0, 10);
}

export function vllmRecipeRevisionFromAtom(feed: string): string | null {
  return feed.match(/Grit::Commit\/([0-9a-f]{40})/i)?.[1] ?? null;
}
