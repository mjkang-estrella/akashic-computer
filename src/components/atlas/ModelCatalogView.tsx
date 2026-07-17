"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  FilterHorizontalIcon,
  FilterResetIcon,
} from "@hugeicons/core-free-icons";
import { FAMILIES } from "@/lib/atlas/data";
import { FAMILY_LOGOS } from "@/lib/atlas/brands";
import { MODEL_ENTRIES, type ModelEntry } from "@/lib/atlas/models";
import { modelReleaseName, parameterCountLabel } from "@/lib/atlas/naming";

type SizeBand = "all" | "compact" | "medium" | "large" | "frontier";

const SIZE_BANDS: { id: SizeBand; label: string }[] = [
  { id: "all", label: "All sizes" },
  { id: "compact", label: "Under 10B" },
  { id: "medium", label: "10B–30B" },
  { id: "large", label: "31B–80B" },
  { id: "frontier", label: "Over 80B" },
];

function inSizeBand(entry: ModelEntry, band: SizeBand): boolean {
  if (band === "all") return true;
  if (band === "compact") return entry.size.paramsB < 10;
  if (band === "medium") return entry.size.paramsB >= 10 && entry.size.paramsB <= 30;
  if (band === "large") return entry.size.paramsB > 30 && entry.size.paramsB <= 80;
  return entry.size.paramsB > 80;
}

export function ModelCatalogView({
  initialFamilyId,
  onOpen,
}: {
  initialFamilyId?: string | null;
  onOpen: (entry: ModelEntry) => void;
}) {
  const [familyId, setFamilyId] = useState(initialFamilyId ?? "all");
  const [sizeBand, setSizeBand] = useState<SizeBand>("all");
  const [variant, setVariant] = useState("all");
  const [quant, setQuant] = useState("all");

  const variants = useMemo(
    () => [...new Set(MODEL_ENTRIES.flatMap((entry) => entry.size.variants))].sort(),
    [],
  );
  const quantizations = useMemo(
    () => [...new Set(MODEL_ENTRIES.flatMap((entry) => entry.quantizations))].sort(),
    [],
  );
  const entries = MODEL_ENTRIES.filter(
    (entry) =>
      (familyId === "all" || entry.family.id === familyId) &&
      inSizeBand(entry, sizeBand) &&
      (variant === "all" || entry.size.variants.includes(variant)) &&
      (quant === "all" || entry.quantizations.includes(quant)),
  );
  const filtered =
    familyId !== "all" || sizeBand !== "all" || variant !== "all" || quant !== "all";

  const resetFilters = () => {
    setFamilyId("all");
    setSizeBand("all");
    setVariant("all");
    setQuant("all");
  };

  return (
    <section className="pt-5" aria-labelledby="model-catalog-title">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <h2 id="model-catalog-title" className="font-display text-[25px] font-semibold">
            Models
          </h2>
          <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted">
            Open-weight releases by model and parameter size, ordered by their most
            recent release or material update.
          </p>
        </div>
        <span className="font-mono text-[13px] text-muted">
          {entries.length} of {MODEL_ENTRIES.length}
        </span>
      </header>

      <div className="flex flex-wrap items-end gap-2 border-b border-line py-3" aria-label="Model filters">
        <span className="flex h-9 w-9 items-center justify-center text-muted" title="Model filters">
          <HugeiconsIcon icon={FilterHorizontalIcon} size={18} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <label className="min-w-[170px] flex-1 sm:flex-none">
          <span className="sr-only">Company</span>
          <select
            value={familyId}
            onChange={(event) => setFamilyId(event.target.value)}
            className="h-9 w-full rounded-[7px] border border-line bg-panel px-2.5 text-[12.5px] font-semibold"
          >
            <option value="all">All companies</option>
            {FAMILIES.map((family) => (
              <option key={family.id} value={family.id}>
                {family.vendor} · {family.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[130px] flex-1 sm:flex-none">
          <span className="sr-only">Parameter size</span>
          <select
            value={sizeBand}
            onChange={(event) => setSizeBand(event.target.value as SizeBand)}
            className="h-9 w-full rounded-[7px] border border-line bg-panel px-2.5 text-[12.5px] font-semibold"
          >
            {SIZE_BANDS.map((band) => (
              <option key={band.id} value={band.id}>{band.label}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[130px] flex-1 sm:flex-none">
          <span className="sr-only">Variant</span>
          <select
            value={variant}
            onChange={(event) => setVariant(event.target.value)}
            className="h-9 w-full rounded-[7px] border border-line bg-panel px-2.5 text-[12.5px] font-semibold"
          >
            <option value="all">All variants</option>
            {variants.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="min-w-[130px] flex-1 sm:flex-none">
          <span className="sr-only">Quantization</span>
          <select
            value={quant}
            onChange={(event) => setQuant(event.target.value)}
            className="h-9 w-full rounded-[7px] border border-line bg-panel px-2.5 text-[12.5px] font-semibold"
          >
            <option value="all">All quants</option>
            {quantizations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!filtered}
          aria-label="Reset model filters"
          title="Reset filters"
          className="flex h-9 w-9 items-center justify-center rounded-[7px] border border-line bg-panel text-muted hover:border-ink hover:text-ink disabled:cursor-default disabled:opacity-35"
        >
          <HugeiconsIcon icon={FilterResetIcon} size={17} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="py-16 text-center">
          <h3 className="font-display text-[19px] font-semibold">No matching models</h3>
          <p className="mt-1 text-[13px] text-muted">Broaden one of the filters to restore the catalog.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 min-h-10 rounded-[7px] border border-line bg-panel px-3 text-[12.5px] font-semibold hover:border-ink"
          >
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
                  <Image
                    src={FAMILY_LOGOS[entry.family.id]}
                    alt=""
                    aria-hidden="true"
                    width={30}
                    height={30}
                    className="h-[30px] w-[30px] flex-none object-contain"
                  />
                  <span className="min-w-0">
                    <span className="block font-display text-[15px] font-semibold leading-tight group-hover:underline group-hover:underline-offset-4">
                      {modelReleaseName(entry.family, entry.release)}
                    </span>
                    <span className="mt-1 block text-[13px] text-muted">
                      {entry.family.vendor}
                    </span>
                  </span>
                </span>
                <span>
                  <span className="text-[11px] text-muted lg:hidden">Parameters · </span>
                  <span className="font-mono text-[13px] font-semibold">
                    {parameterCountLabel(entry.size)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 lg:col-start-4">
                  <span className="w-full text-[11px] text-muted lg:hidden">Quantizations</span>
                  {entry.quantizations.map((item) => (
                    <span key={item} className="rounded-[5px] bg-panel2 px-1.5 py-0.5 font-mono text-[11.5px] text-muted">
                      {item}
                    </span>
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
    </section>
  );
}
