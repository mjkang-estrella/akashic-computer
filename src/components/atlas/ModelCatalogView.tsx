"use client";

import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AiVisionRecognitionIcon,
  ArrowRight01Icon,
  AudioWaveformIcon,
  Cancel01Icon,
  DashboardSquare01Icon,
  FileAxis3DIcon,
  FilterHorizontalIcon,
  FilterResetIcon,
  GameController03Icon,
  Image01Icon,
  Robot01Icon,
  SearchAreaIcon,
  TextIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { FAMILIES } from "@/lib/atlas/data";
import { MODEL_ENTRIES, type ModelEntry } from "@/lib/atlas/models";
import { modelReleaseName, parameterCountLabel } from "@/lib/atlas/naming";
import {
  MODEL_CAPABILITIES,
  MODEL_CATEGORIES,
  type ModelCapabilityId,
  type ModelCategoryId,
} from "@/lib/atlas/taxonomy";
import { FamilyLogo } from "./FamilyLogo";

type SizeBand = "all" | "compact" | "medium" | "large" | "frontier";
type CategoryFilter = "all" | ModelCategoryId;

const SIZE_BANDS: { id: SizeBand; label: string }[] = [
  { id: "all", label: "All sizes" },
  { id: "compact", label: "Under 10B" },
  { id: "medium", label: "10B-30B" },
  { id: "large", label: "31B-80B" },
  { id: "frontier", label: "Over 80B" },
];

const CATEGORY_ICONS: Record<ModelCategoryId, IconSvgElement> = {
  language: TextIcon,
  "vision-documents": AiVisionRecognitionIcon,
  "image-generation": Image01Icon,
  "video-generation": Video01Icon,
  "audio-speech": AudioWaveformIcon,
  retrieval: SearchAreaIcon,
  "3d-spatial": FileAxis3DIcon,
  "world-models": GameController03Icon,
  robotics: Robot01Icon,
};

function inSizeBand(entry: ModelEntry, band: SizeBand): boolean {
  if (band === "all") return true;
  if (band === "compact") return entry.size.paramsB < 10;
  if (band === "medium") return entry.size.paramsB >= 10 && entry.size.paramsB <= 30;
  if (band === "large") return entry.size.paramsB > 30 && entry.size.paramsB <= 80;
  return entry.size.paramsB > 80;
}

function validValue<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return value && values.includes(value as T) ? (value as T) : fallback;
}

function setUrlParam(url: URL, key: string, value: string, defaultValue = "all") {
  if (value === defaultValue) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
}

interface FilterPanelProps {
  category: CategoryFilter;
  categoryCounts: Map<ModelCategoryId, number>;
  capabilities: Set<ModelCapabilityId>;
  capabilityCounts: Map<ModelCapabilityId, number>;
  familyId: string;
  sizeBand: SizeBand;
  variant: string;
  quant: string;
  provider: string;
  variants: string[];
  quantizations: string[];
  providers: string[];
  filtered: boolean;
  onCategory: (value: CategoryFilter) => void;
  onCapability: (value: ModelCapabilityId) => void;
  onFamily: (value: string) => void;
  onSizeBand: (value: SizeBand) => void;
  onVariant: (value: string) => void;
  onQuant: (value: string) => void;
  onProvider: (value: string) => void;
  onReset: () => void;
}

function FilterPanel({
  category,
  categoryCounts,
  capabilities,
  capabilityCounts,
  familyId,
  sizeBand,
  variant,
  quant,
  provider,
  variants,
  quantizations,
  providers,
  filtered,
  onCategory,
  onCapability,
  onFamily,
  onSizeBand,
  onVariant,
  onQuant,
  onProvider,
  onReset,
}: FilterPanelProps) {
  const visibleCategories = MODEL_CATEGORIES.filter(
    (item) => (categoryCounts.get(item.id) ?? 0) > 0,
  );
  const visibleCapabilities = MODEL_CAPABILITIES.filter(
    (item) => (capabilityCounts.get(item.id) ?? 0) > 0 || capabilities.has(item.id),
  );
  const selectClass =
    "mt-1.5 h-9 w-full rounded-[7px] border border-line bg-panel px-2.5 text-[12.5px] font-semibold outline-none focus:border-ink";

  return (
    <div className="space-y-6">
      <section aria-labelledby="category-filter-title">
        <h3 id="category-filter-title" className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Category
        </h3>
        <div className="mt-2 space-y-1">
          <button
            type="button"
            onClick={() => onCategory("all")}
            aria-pressed={category === "all"}
            className={`flex min-h-9 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[12.5px] font-semibold ${
              category === "all" ? "bg-ink text-paper" : "text-muted hover:bg-panel2 hover:text-ink"
            }`}
          >
            <HugeiconsIcon icon={DashboardSquare01Icon} size={16} strokeWidth={1.7} aria-hidden="true" />
            <span className="min-w-0 flex-1">All models</span>
            <span className="font-mono text-[11px] opacity-70">{MODEL_ENTRIES.length}</span>
          </button>
          {visibleCategories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onCategory(item.id)}
              aria-pressed={category === item.id}
              className={`flex min-h-9 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[12.5px] font-semibold ${
                category === item.id ? "bg-ink text-paper" : "text-muted hover:bg-panel2 hover:text-ink"
              }`}
            >
              <HugeiconsIcon icon={CATEGORY_ICONS[item.id]} size={16} strokeWidth={1.7} aria-hidden="true" />
              <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
              <span className="font-mono text-[11px] opacity-70">{categoryCounts.get(item.id)}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="capability-filter-title">
        <h3 id="capability-filter-title" className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Capabilities
        </h3>
        <div className="mt-2 space-y-0.5">
          {visibleCapabilities.map((item) => (
            <label
              key={item.id}
              className="flex min-h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[12.5px] text-muted hover:bg-panel2 hover:text-ink"
            >
              <input
                type="checkbox"
                checked={capabilities.has(item.id)}
                onChange={() => onCapability(item.id)}
                className="h-3.5 w-3.5 flex-none accent-ink"
              />
              <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
              <span className="font-mono text-[11px] text-faint">{capabilityCounts.get(item.id) ?? 0}</span>
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="property-filter-title">
        <h3 id="property-filter-title" className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Properties
        </h3>
        <div className="mt-2 space-y-3">
          <label className="block text-[11.5px] font-semibold text-muted">
            Company
            <select value={familyId} onChange={(event) => onFamily(event.target.value)} className={selectClass}>
              <option value="all">All companies</option>
              {FAMILIES.map((family) => (
                <option key={family.id} value={family.id}>{family.vendor} / {family.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11.5px] font-semibold text-muted">
            Parameters
            <select value={sizeBand} onChange={(event) => onSizeBand(event.target.value as SizeBand)} className={selectClass}>
              {SIZE_BANDS.map((band) => <option key={band.id} value={band.id}>{band.label}</option>)}
            </select>
          </label>
          <label className="block text-[11.5px] font-semibold text-muted">
            Variant
            <select value={variant} onChange={(event) => onVariant(event.target.value)} className={selectClass}>
              <option value="all">All variants</option>
              {variants.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-[11.5px] font-semibold text-muted">
            Quantization
            <select value={quant} onChange={(event) => onQuant(event.target.value)} className={selectClass}>
              <option value="all">All quantizations</option>
              {quantizations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-[11.5px] font-semibold text-muted">
            Provider
            <select value={provider} onChange={(event) => onProvider(event.target.value)} className={selectClass}>
              <option value="all">All providers</option>
              {providers.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>

      <button
        type="button"
        onClick={onReset}
        disabled={!filtered}
        className="flex min-h-9 w-full items-center justify-center gap-2 rounded-[7px] border border-line bg-panel px-3 text-[12.5px] font-semibold text-muted hover:border-ink hover:text-ink disabled:cursor-default disabled:opacity-35"
      >
        <HugeiconsIcon icon={FilterResetIcon} size={16} strokeWidth={1.8} aria-hidden="true" />
        Reset filters
      </button>
    </div>
  );
}

export function ModelCatalogView({
  initialFamilyId,
  onOpen,
}: {
  initialFamilyId?: string | null;
  onOpen: (entry: ModelEntry) => void;
}) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [capabilities, setCapabilities] = useState<Set<ModelCapabilityId>>(new Set());
  const [familyId, setFamilyId] = useState(initialFamilyId ?? "all");
  const [sizeBand, setSizeBand] = useState<SizeBand>("all");
  const [variant, setVariant] = useState("all");
  const [quant, setQuant] = useState("all");
  const [provider, setProvider] = useState("all");
  const [locationReady, setLocationReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const variants = useMemo(
    () => [...new Set(MODEL_ENTRIES.flatMap((entry) => entry.size.variants))].sort(),
    [],
  );
  const quantizations = useMemo(
    () => [...new Set(MODEL_ENTRIES.flatMap((entry) => entry.quantizations))].sort(),
    [],
  );
  const providers = useMemo(
    () => [...new Set(MODEL_ENTRIES.flatMap((entry) => entry.providers))].sort(),
    [],
  );

  useEffect(() => {
    const syncFromLocation = () => {
      const params = new URL(window.location.href).searchParams;
      const categoryIds = ["all", ...MODEL_CATEGORIES.map((item) => item.id)] as CategoryFilter[];
      const capabilityIds = MODEL_CAPABILITIES.map((item) => item.id);
      setCategory(validValue(params.get("category"), categoryIds, "all"));
      setCapabilities(
        new Set(
          (params.get("capability") ?? "")
            .split(",")
            .filter((value): value is ModelCapabilityId => capabilityIds.includes(value as ModelCapabilityId)),
        ),
      );
      setFamilyId(params.get("family") ?? initialFamilyId ?? "all");
      setSizeBand(validValue(params.get("size"), SIZE_BANDS.map((item) => item.id), "all"));
      setVariant(params.get("catalogVariant") ?? "all");
      setQuant(params.get("quant") ?? "all");
      setProvider(params.get("provider") ?? "all");
      setLocationReady(true);
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [initialFamilyId]);

  useEffect(() => {
    if (!locationReady) return;
    const url = new URL(window.location.href);
    setUrlParam(url, "category", category);
    setUrlParam(url, "family", familyId);
    setUrlParam(url, "size", sizeBand);
    setUrlParam(url, "catalogVariant", variant);
    setUrlParam(url, "quant", quant);
    setUrlParam(url, "provider", provider);
    if (capabilities.size) {
      url.searchParams.set("capability", [...capabilities].sort().join(","));
    } else {
      url.searchParams.delete("capability");
    }
    window.history.replaceState(null, "", url);
  }, [capabilities, category, familyId, locationReady, provider, quant, sizeBand, variant]);

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<ModelCategoryId, number>();
    MODEL_ENTRIES.forEach((entry) => counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1));
    return counts;
  }, []);
  const categoryEntries = useMemo(
    () => MODEL_ENTRIES.filter((entry) => category === "all" || entry.category === category),
    [category],
  );
  const capabilityCounts = useMemo(() => {
    const counts = new Map<ModelCapabilityId, number>();
    categoryEntries.forEach((entry) => {
      entry.capabilities.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
    });
    return counts;
  }, [categoryEntries]);

  const entries = categoryEntries.filter(
    (entry) =>
      (capabilities.size === 0 || entry.capabilities.some((item) => capabilities.has(item))) &&
      (familyId === "all" || entry.family.id === familyId) &&
      inSizeBand(entry, sizeBand) &&
      (variant === "all" || entry.size.variants.includes(variant)) &&
      (quant === "all" || entry.quantizations.includes(quant)) &&
      (provider === "all" || entry.providers.includes(provider)),
  );
  const filterCount =
    (category !== "all" ? 1 : 0) +
    capabilities.size +
    (familyId !== "all" ? 1 : 0) +
    (sizeBand !== "all" ? 1 : 0) +
    (variant !== "all" ? 1 : 0) +
    (quant !== "all" ? 1 : 0) +
    (provider !== "all" ? 1 : 0);
  const filtered = filterCount > 0;

  const resetFilters = () => {
    setCategory("all");
    setCapabilities(new Set());
    setFamilyId("all");
    setSizeBand("all");
    setVariant("all");
    setQuant("all");
    setProvider("all");
  };
  const toggleCapability = (item: ModelCapabilityId) => {
    setCapabilities((current) => {
      const next = new Set(current);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };
  const filterPanelProps: FilterPanelProps = {
    category,
    categoryCounts,
    capabilities,
    capabilityCounts,
    familyId,
    sizeBand,
    variant,
    quant,
    provider,
    variants,
    quantizations,
    providers,
    filtered,
    onCategory: setCategory,
    onCapability: toggleCapability,
    onFamily: setFamilyId,
    onSizeBand: setSizeBand,
    onVariant: setVariant,
    onQuant: setQuant,
    onProvider: setProvider,
    onReset: resetFilters,
  };
  const activeChips = [
    category !== "all" && {
      key: "category",
      label: MODEL_CATEGORIES.find((item) => item.id === category)?.label ?? category,
      clear: () => setCategory("all"),
    },
    ...[...capabilities].map((item) => ({
      key: `capability-${item}`,
      label: MODEL_CAPABILITIES.find((definition) => definition.id === item)?.label ?? item,
      clear: () => toggleCapability(item),
    })),
    familyId !== "all" && {
      key: "family",
      label: FAMILIES.find((family) => family.id === familyId)?.vendor ?? familyId,
      clear: () => setFamilyId("all"),
    },
    sizeBand !== "all" && {
      key: "size",
      label: SIZE_BANDS.find((band) => band.id === sizeBand)?.label ?? sizeBand,
      clear: () => setSizeBand("all"),
    },
    variant !== "all" && { key: "variant", label: variant, clear: () => setVariant("all") },
    quant !== "all" && { key: "quant", label: quant, clear: () => setQuant("all") },
    provider !== "all" && { key: "provider", label: provider, clear: () => setProvider("all") },
  ].filter((item): item is { key: string; label: string; clear: () => void } => Boolean(item));
  const populatedCategories = MODEL_CATEGORIES.filter((item) => (categoryCounts.get(item.id) ?? 0) > 0);

  return (
    <section className="pt-5" aria-labelledby="model-catalog-title">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <h2 id="model-catalog-title" className="font-display text-[25px] font-semibold">Models</h2>
          <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted">
            Open-weight releases by model and parameter size, ordered by their most recent release or material update.
          </p>
        </div>
        <span className="font-mono text-[13px] text-muted">{entries.length} of {MODEL_ENTRIES.length}</span>
      </header>

      <nav className="-mx-5 flex gap-2 overflow-x-auto border-b border-line px-5 py-3 xl:hidden" aria-label="Model categories">
        <button
          type="button"
          onClick={() => setCategory("all")}
          aria-pressed={category === "all"}
          className={`flex min-h-9 flex-none items-center gap-1.5 rounded-[7px] border px-3 text-[12.5px] font-semibold ${category === "all" ? "border-ink bg-ink text-paper" : "border-line bg-panel text-muted"}`}
        >
          <HugeiconsIcon icon={DashboardSquare01Icon} size={15} strokeWidth={1.7} aria-hidden="true" />
          All
        </button>
        {populatedCategories.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            aria-pressed={category === item.id}
            className={`flex min-h-9 flex-none items-center gap-1.5 rounded-[7px] border px-3 text-[12.5px] font-semibold ${category === item.id ? "border-ink bg-ink text-paper" : "border-line bg-panel text-muted"}`}
          >
            <HugeiconsIcon icon={CATEGORY_ICONS[item.id]} size={15} strokeWidth={1.7} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-6">
        <aside className="hidden border-r border-line pr-5 xl:block" aria-label="Model filters">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto py-5 pr-1">
            <FilterPanel {...filterPanelProps} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className={`min-h-[52px] flex-wrap items-center gap-2 border-b border-line py-2.5 ${filtered ? "flex" : "flex xl:hidden"}`}>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex min-h-9 items-center gap-2 rounded-[7px] border border-line bg-panel px-3 text-[12.5px] font-semibold xl:hidden"
            >
              <HugeiconsIcon icon={FilterHorizontalIcon} size={16} strokeWidth={1.8} aria-hidden="true" />
              Filters{filterCount > 0 ? ` (${filterCount})` : ""}
            </button>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                aria-label={`Remove ${chip.label} filter`}
                className="flex min-h-8 items-center gap-1.5 rounded-[6px] bg-panel2 px-2.5 font-mono text-[11.5px] text-muted hover:text-ink"
              >
                {chip.label}
                <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.9} aria-hidden="true" />
              </button>
            ))}
            {filtered && (
              <button type="button" onClick={resetFilters} className="ml-auto min-h-8 px-2 text-[12px] font-semibold text-muted hover:text-ink">
                Clear all
              </button>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="py-16 text-center">
              <h3 className="font-display text-[19px] font-semibold">No matching models</h3>
              <p className="mt-1 text-[13px] text-muted">Broaden one of the filters to restore the catalog.</p>
              <button type="button" onClick={resetFilters} className="mt-4 min-h-10 rounded-[7px] border border-line bg-panel px-3 text-[12.5px] font-semibold hover:border-ink">
                Reset filters
              </button>
            </div>
          ) : (
            <div className="border-b border-line">
              <div className="hidden grid-cols-[240px_125px_64px_260px_150px_minmax(0,1fr)_36px] border-b border-line px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted lg:grid">
                <span>Model</span>
                <span>Parameters</span>
                <span className="col-start-4">Quantizations</span>
                <span className="col-start-5">Last Updated</span>
                <span className="sr-only col-start-7">Open</span>
              </div>
              <div className="divide-y divide-linesoft">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onOpen(entry)}
                    aria-label={`Open ${entry.name}`}
                    className="group grid w-full min-w-0 gap-3 py-4 text-left transition-colors hover:bg-panel lg:grid-cols-[240px_125px_64px_260px_150px_minmax(0,1fr)_36px] lg:items-center lg:gap-0 lg:px-2"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <FamilyLogo familyId={entry.family.id} familyName={entry.family.name} />
                      <span className="min-w-0">
                        <span className="block font-display text-[15px] font-semibold leading-tight group-hover:underline group-hover:underline-offset-4">
                          {modelReleaseName(entry.family, entry.release)}
                        </span>
                        <span className="mt-1 block text-[13px] text-muted">{entry.family.vendor}</span>
                      </span>
                    </span>
                    <span>
                      <span className="text-[11px] text-muted lg:hidden">Parameters · </span>
                      <span className="font-mono text-[13px] font-semibold">{parameterCountLabel(entry.size)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 lg:col-start-4">
                      <span className="w-full text-[11px] text-muted lg:hidden">Quantizations</span>
                      {entry.quantizations.map((item) => (
                        <span key={item} className="rounded-[5px] bg-panel2 px-1.5 py-0.5 font-mono text-[11.5px] text-muted">{item}</span>
                      ))}
                    </span>
                    <span className="text-[13px] text-muted lg:col-start-5">
                      <span className="text-[11px] font-normal text-muted lg:hidden">Last Updated · </span>
                      {entry.dateLabel}
                    </span>
                    <span className="hidden h-9 w-9 items-center justify-center text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink lg:col-start-7 lg:flex">
                      <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button type="button" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-ink/20" aria-label="Close filters" />
          <aside role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title" className="absolute inset-y-0 right-0 w-[min(88vw,360px)] overflow-y-auto border-l border-line bg-paper px-5 pb-8 shadow-xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper py-4">
              <h2 id="mobile-filter-title" className="font-display text-[19px] font-semibold">Filters</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-[7px] text-muted hover:bg-panel2 hover:text-ink" aria-label="Close filters">
                <HugeiconsIcon icon={Cancel01Icon} size={19} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </header>
            <div className="pt-5"><FilterPanel {...filterPanelProps} /></div>
          </aside>
        </div>
      )}
    </section>
  );
}
