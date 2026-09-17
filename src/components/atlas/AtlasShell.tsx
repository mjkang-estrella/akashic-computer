"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueries } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hydratePublishedEntries, type PublishedCatalogEntry } from "@/lib/atlas/published";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
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
import { ProductNavigation } from "./ProductNavigation";

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

  const isLanding = pathname === "/";
  const wide = isLanding || (!query.trim() && pathname === "/models");

  return (
    <AtlasUiContext.Provider value={{ rig, checked, toggleChecked }}>
      <div className={`min-h-screen ${isLanding ? "" : "pb-28"}`}>
        <header className="border-b border-line bg-paper">
          <div className="mx-auto flex min-h-[88px] w-full max-w-[1240px] flex-wrap items-center justify-between gap-x-8 px-5 md:flex-nowrap">
            <Link href="/" aria-label="Akashic home" onClick={() => setQuery("")} className="flex min-h-14 items-center gap-2.5 text-left">
              <AkashicMark className="flex-none text-ink" />
              <span className="font-display text-[23px] font-semibold leading-none">Akashic</span>
            </Link>
            <ProductNavigation pathname={pathname} onNavigate={() => setQuery("")} />
          </div>
        </header>
        {!isLanding ? <div className="border-b border-line bg-panel/50">
          <div className="mx-auto flex min-h-16 w-full max-w-[1240px] items-center justify-between gap-3 px-5 py-2">
            <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[7px] border border-line bg-panel px-3 py-1.5 sm:max-w-[480px]">
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
            </label>
            <div className="flex-none">
              <FitBar
                presetId={presetId}
                manualGb={manualGb}
                onPreset={(id) => {
                  setPresetId(id);
                  setManualGb(null);
                }}
                onManualGb={setManualGb}
              />
            </div>
          </div>
        </div> : null}

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
