"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueries } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hydratePublishedEntries, type PublishedCatalogEntry } from "@/lib/atlas/published";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BookOpenTextIcon,
  ChartColumnIcon,
  CubeIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { AkashicMark } from "@/components/brand/AkashicMark";
import { DEFAULT_PRESET_ID, RIG_PRESETS } from "@/lib/atlas/data";
import { resolveProfile } from "@/lib/atlas/fit";
import type { RigProfile } from "@/lib/atlas/types";
import { findModelEntryForTarget } from "@/lib/atlas/models";
import { comparisonHref } from "@/lib/atlas/comparison";
import { CompareDrawer } from "./CompareDrawer";
import { BenchmarkView } from "./BenchmarkView";
import { FitBar } from "./FitBar";
import { SearchView, type SearchTarget } from "./SearchView";
import { useCatalog } from "./CatalogProvider";

interface AtlasUiContextValue {
  rig: RigProfile;
  checked: Set<string>;
  toggleChecked: (repo: string, on: boolean) => void;
}

const AtlasUiContext = createContext<AtlasUiContextValue | null>(null);

export function useAtlasUi(): AtlasUiContextValue {
  const value = useContext(AtlasUiContext);
  if (!value) throw new Error("useAtlasUi must be used inside AtlasShell");
  return value;
}

export function AtlasShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { entries, families } = useCatalog();
  const [query, setQuery] = useState("");
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [manualGb, setManualGb] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const rig = resolveProfile(RIG_PRESETS, presetId, manualGb);

  // List summaries omit memory and benchmark evidence. Fetch only the selected models.
  const comparisonQueries = useMemo(() => Object.fromEntries(
    entries.filter((entry) => entry.artifacts.some((artifact) => checked.has(artifact.repo)))
      .map((entry) => [entry.slug, { query: api.catalog.getBySlug, args: { slug: entry.slug } }]),
  ), [checked, entries]);
  const comparisonResults = useQueries(comparisonQueries);
  const comparisonSelections = useMemo(() => {
    const details = Object.values(comparisonResults).filter((value): value is PublishedCatalogEntry =>
      Boolean(value) && !(value instanceof Error),
    );
    const artifacts = new Map(
      hydratePublishedEntries(details).entries.flatMap((entry) => entry.artifacts.map((artifact) => [artifact.repo, { artifact, model: entry }] as const)),
    );
    return [...checked].flatMap((repo) => {
      const selection = artifacts.get(repo);
      return selection ? [selection] : [];
    });
  }, [checked, comparisonResults]);

  const toggleChecked = (repo: string, on: boolean) => {
    setChecked((current) => {
      const next = new Set(current);
      if (on && next.size < 4) next.add(repo);
      if (!on) next.delete(repo);
      return next;
    });
  };

  const selectSearchResult = (target: SearchTarget) => {
    const entry = findModelEntryForTarget(
      entries,
      target.familyId,
      target.releaseId,
      target.sizeLabel,
    );
    setQuery("");
    if (entry) {
      const params = target.variant ? `?variant=${encodeURIComponent(target.variant)}` : "";
      router.push(`/models/${entry.slug}${params}`);
      return;
    }
    router.push(`/models?family=${encodeURIComponent(target.familyId)}`);
  };

  const navigation = [
    { href: "/models", label: "Model", icon: CubeIcon, active: pathname.startsWith("/models") },
    { href: "/compare", label: "Compare", icon: ChartColumnIcon, active: pathname.startsWith("/compare") },
    { href: "/benchmarks", label: "Benchmark", icon: ChartColumnIcon, active: pathname.startsWith("/benchmarks") },
    { href: "/docs", label: "Docs", icon: BookOpenTextIcon, active: pathname.startsWith("/docs") },
  ] as const;
  const isLanding = pathname === "/";
  const wide = isLanding || (!query.trim() && pathname === "/models");

  return (
    <AtlasUiContext.Provider value={{ rig, checked, toggleChecked }}>
      <div className={`min-h-screen ${isLanding ? "" : "pb-28"}`}>
        <header className="border-b border-line bg-paper">
          <div className={isLanding ? "mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-1 px-5 py-4 sm:py-5" : "mx-auto grid w-full max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-5 py-3 lg:grid-cols-[auto_minmax(280px,420px)_minmax(0,1fr)_auto] lg:gap-x-5"}>
            <Link href="/" aria-label="Akashic home" onClick={() => setQuery("")} className="flex min-h-11 items-center gap-2.5 text-left sm:min-h-9">
              <AkashicMark className="flex-none text-ink" />
              <span className={`font-display font-semibold leading-none ${isLanding ? "text-[23px]" : "text-[19px]"}`}>Akashic</span>
            </Link>
            {!isLanding ? <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-[7px] border border-line bg-panel px-3 py-1.5 sm:min-h-9">
              <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="flex-none text-faint" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={pathname.startsWith("/benchmarks") ? "Search benchmarks or models..." : "Search models, families, artifacts..."}
                aria-label="Search the Akashic catalog"
                aria-controls="search-results"
                className="w-full min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
              />
            </label> : null}
            <nav aria-label="Primary" className={isLanding ? "grid w-full grid-cols-4 items-center sm:flex sm:w-auto sm:gap-4" : "col-span-3 row-start-2 grid min-w-0 grid-cols-4 items-center lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:flex lg:justify-end lg:gap-1"}>
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={`relative flex min-h-11 items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold transition-colors after:absolute after:inset-x-3 after:-bottom-3 after:h-0.5 after:bg-ink after:transition-opacity sm:px-3 sm:text-[13.5px] lg:after:-bottom-[17px] ${item.active ? "text-ink after:opacity-100" : "text-muted after:opacity-0 hover:text-ink"}`}
                >
                  {!isLanding ? <HugeiconsIcon icon={item.icon} size={16} strokeWidth={1.8} aria-hidden="true" className="hidden flex-none sm:block" /> : null}
                  {item.label}
                </Link>
              ))}
            </nav>
            {!isLanding ? <div className="col-start-3 row-start-1 justify-self-end lg:col-start-4">
              <FitBar
                presetId={presetId}
                manualGb={manualGb}
                onPreset={(id) => {
                  setPresetId(id);
                  setManualGb(null);
                }}
                onManualGb={setManualGb}
              />
            </div> : null}
          </div>
        </header>

        <main className={`mx-auto w-full px-5 ${wide ? "max-w-[1440px]" : "max-w-[1240px]"}`}>
          {!isLanding && query.trim() ? (
            pathname.startsWith("/benchmarks") ? (
              <BenchmarkView
                entries={entries}
                query={query}
                onOpen={(entry) => router.push(`/models/${entry.slug}`)}
              />
            ) : (
              <SearchView
                query={query}
                entries={entries}
                families={families}
                onSelect={selectSearchResult}
                onClear={() => setQuery("")}
              />
            )
          ) : children}
          {comparisonSelections.length > 0 && !isLanding && pathname !== "/compare" && !pathname.startsWith("/docs") ? (
            <CompareDrawer
              artifacts={comparisonSelections.map((selection) => selection.artifact)}
              models={Object.fromEntries(comparisonSelections.map(({ artifact, model }) => [artifact.repo, model]))}
              planningHref={comparisonHref(
                { modelSlug: comparisonSelections[0].model.slug, variant: comparisonSelections[0].artifact.variant, bpw: "" },
                { modelSlug: comparisonSelections[1]?.model.slug ?? "", variant: comparisonSelections[1]?.artifact.variant ?? "", bpw: "" },
                "",
              )}
              rig={rig}
              onRemove={(repo) => toggleChecked(repo, false)}
              onClear={() => setChecked(new Set())}
            />
          ) : null}
        </main>
      </div>
    </AtlasUiContext.Provider>
  );
}
