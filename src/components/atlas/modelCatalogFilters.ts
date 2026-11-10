import { MODEL_CAPABILITIES, MODEL_CATEGORIES, type ModelCapabilityId } from "@/lib/atlas/taxonomy";

export type SizeBand = "all" | "compact" | "medium" | "large" | "frontier";

export interface CatalogFilterOptions {
  families: readonly string[];
  variants: readonly string[];
  quantizations: readonly string[];
  providers: readonly string[];
}

function validValue<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return value && values.includes(value as T) ? (value as T) : fallback;
}

export function parseCatalogFilters(search: string, options: CatalogFilterOptions) {
  const params = new URLSearchParams(search);
  return {
    category: validValue(params.get("category"), ["all", ...MODEL_CATEGORIES.map((item) => item.id)], "all"),
    capabilities: new Set((params.get("capability") ?? "").split(",").filter(
      (value): value is ModelCapabilityId => MODEL_CAPABILITIES.some((item) => item.id === value),
    )),
    familyId: validValue(params.get("family"), options.families, "all"),
    sizeBand: validValue<SizeBand>(params.get("size"), ["compact", "medium", "large", "frontier"], "all"),
    variant: validValue(params.get("catalogVariant"), options.variants, "all"),
    quant: validValue(params.get("quant"), options.quantizations, "all"),
    provider: validValue(params.get("provider"), options.providers, "all"),
  };
}

export function catalogFilterParams(search: string, filters: ReturnType<typeof parseCatalogFilters>) {
  const params = new URLSearchParams(search);
  const values = {
    category: filters.category,
    capability: [...filters.capabilities].sort().join(",") || "all",
    family: filters.familyId,
    size: filters.sizeBand,
    catalogVariant: filters.variant,
    quant: filters.quant,
    provider: filters.provider,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === "all") params.delete(key);
    else params.set(key, value);
  }
  return params;
}

export const CATALOG_PAGE_SIZE = 100;

export function catalogWindow<T>(entries: readonly T[], pages: number): T[] {
  return entries.slice(0, Math.max(1, Math.floor(pages)) * CATALOG_PAGE_SIZE);
}
