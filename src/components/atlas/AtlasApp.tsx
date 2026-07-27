"use client";

import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BookOpenTextIcon,
  ChartColumnIcon,
  CubeIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { AkashicMark } from "@/components/brand/AkashicMark";
import {
  DEFAULT_PRESET_ID,
  RIG_PRESETS,
} from "@/lib/atlas/data";
import { resolveProfile } from "@/lib/atlas/fit";
import {
  findModelEntryForSlug,
  findModelEntryForTarget,
  type ModelEntry,
} from "@/lib/atlas/models";
import { BenchmarkView } from "./BenchmarkView";
import { CompareDrawer } from "./CompareDrawer";
import { useCatalog } from "./CatalogProvider";
import { FitBar } from "./FitBar";
import { HomeView } from "./HomeView";
import { LearnView } from "./LearnView";
import { ModelCatalogView } from "./ModelCatalogView";
import { ModelDetailView } from "./ModelDetailView";
import { SearchView, type SearchTarget } from "./SearchView";

type Tab = "home" | "model" | "benchmark" | "docs";

const LEGACY_TABS: Record<string, Tab> = {
  explore: "model",
  compare: "benchmark",
  learn: "docs",
};

export function AtlasApp() {
  const {
    entries,
    families,
    syncedAt,
    health,
    loading,
    source,
  } = useCatalog();
  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");

  // model catalog and dedicated detail route
  const [modelSlug, setModelSlug] = useState<string | null>(null);
  const [catalogFamilyId, setCatalogFamilyId] = useState<string | null>(null);
  const [preferredVariant, setPreferredVariant] = useState<string | null>(null);
  const [docSlug, setDocSlug] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // rig profile
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [manualGb, setManualGb] = useState<number | null>(null);

  // Keep the app state aligned with shareable URLs and browser navigation.
  useEffect(() => {
    const syncFromLocation = () => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("tab");
      const nextTab =
        param === "home" ||
        param === "model" ||
        param === "benchmark" ||
        param === "docs"
          ? param
          : param
            ? LEGACY_TABS[param]
            : "home";
      setTab(nextTab ?? "home");
      setModelSlug(url.searchParams.get("model"));
      setCatalogFamilyId(url.searchParams.get("family"));
      setPreferredVariant(url.searchParams.get("variant"));
      setDocSlug(url.searchParams.get("doc"));
      if (param === "home") {
        url.searchParams.delete("tab");
        window.history.replaceState(null, "", url);
      }
      if (param && nextTab && param !== nextTab) {
        url.searchParams.set("tab", nextTab);
        window.history.replaceState(null, "", url);
      }
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    setQuery("");
    setModelSlug(null);
    setPreferredVariant(null);
    setDocSlug(null);
    const url = new URL(window.location.href);
    if (t === "home") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    url.searchParams.delete("model");
    url.searchParams.delete("variant");
    url.searchParams.delete("doc");
    url.hash = "";
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const goHome = () => {
    setTab("home");
    setQuery("");
    setModelSlug(null);
    setCatalogFamilyId(null);
    setPreferredVariant(null);
    setDocSlug(null);
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const rig = resolveProfile(RIG_PRESETS, presetId, manualGb);

  const checkedArtifacts = useMemo(() => {
    const allArtifacts = Array.from(
      new Map(
        entries.flatMap((entry) => entry.artifacts).map((artifact) => [artifact.repo, artifact]),
      ).values(),
    );
    return allArtifacts.filter((artifact) => checked.has(artifact.repo));
  }, [checked, entries]);

  const toggleChecked = (repo: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) {
        if (next.size < 4) next.add(repo);
      } else {
        next.delete(repo);
      }
      return next;
    });
  };

  const openModel = (entry: ModelEntry, variant?: string | null) => {
    setTab("model");
    setQuery("");
    setModelSlug(entry.slug);
    setCatalogFamilyId(null);
    setPreferredVariant(variant ?? null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "model");
    url.searchParams.set("model", entry.slug);
    url.searchParams.delete("doc");
    if (variant) url.searchParams.set("variant", variant);
    else url.searchParams.delete("variant");
    url.hash = "";
    window.history.pushState(null, "", url);
  };

  const closeModel = () => {
    setModelSlug(null);
    setPreferredVariant(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("model");
    url.searchParams.delete("variant");
    window.history.pushState(null, "", url);
  };

  const selectSearchResult = (target: SearchTarget) => {
    const entry = findModelEntryForTarget(
      entries,
      target.familyId,
      target.releaseId,
      target.sizeLabel,
    );
    if (entry) {
      openModel(entry, target.variant);
      return;
    }

    setTab("model");
    setQuery("");
    setModelSlug(null);
    setPreferredVariant(null);
    setCatalogFamilyId(target.familyId);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "model");
    url.searchParams.set("family", target.familyId);
    url.searchParams.delete("model");
    url.searchParams.delete("variant");
    url.searchParams.delete("doc");
    url.hash = "";
    window.history.pushState(null, "", url);
  };
  const openLearn = (term?: string) => {
    setTab("docs");
    setQuery("");
    setDocSlug(term ? "lexicon" : null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "docs");
    if (term) url.searchParams.set("doc", "lexicon");
    else url.searchParams.delete("doc");
    url.hash = term ? `term-${term}` : "";
    window.history.replaceState(null, "", url);
    if (term) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document
            .getElementById(`term-${term}`)
            ?.scrollIntoView({ block: "start" });
        });
      });
    } else {
      window.requestAnimationFrame(() => {
        document.getElementById("docs-index-title")?.focus({ preventScroll: true });
      });
    }
  };
  const openDoc = (slug: string) => {
    setTab("docs");
    setQuery("");
    setDocSlug(slug);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "docs");
    url.searchParams.set("doc", slug);
    url.hash = "";
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      document.getElementById("docs-article-title")?.focus({ preventScroll: true });
    });
  };
  const closeDoc = () => {
    setDocSlug(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "docs");
    url.searchParams.delete("doc");
    url.hash = "";
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      document.getElementById("docs-index-title")?.focus({ preventScroll: true });
    });
  };
  const drawerOpen = tab === "model" && checkedArtifacts.length >= 1;
  const tabs = [
    { id: "model", label: "Model", icon: CubeIcon },
    { id: "benchmark", label: "Benchmark", icon: ChartColumnIcon },
    { id: "docs", label: "Docs", icon: BookOpenTextIcon },
  ] as const;

  const capacityControls = (
    <FitBar
      presetId={presetId}
      manualGb={manualGb}
      onPreset={(id) => {
        setPresetId(id);
        setManualGb(null);
      }}
      onManualGb={setManualGb}
    />
  );
  const selectedModel = findModelEntryForSlug(entries, modelSlug);

  return (
    <div className="min-h-screen pb-28">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-5 py-3 lg:grid-cols-[auto_minmax(280px,420px)_minmax(0,1fr)_auto] lg:gap-x-5">
          <button
            type="button"
            onClick={goHome}
            aria-label="Akashic home"
            aria-current={tab === "home" ? "page" : undefined}
            className="flex min-h-11 items-center gap-2.5 text-left sm:min-h-9"
          >
            <AkashicMark className="flex-none text-ink" />
            <h1 className="font-display text-[19px] font-semibold leading-none">
              Akashic
            </h1>
          </button>
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-[7px] border border-line bg-panel px-3 py-1.5 sm:min-h-9">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
              className="flex-none text-faint"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === "benchmark"
                  ? "Search benchmarks or models…"
                  : "Search models, families, artifacts…"
              }
              aria-label={
                tab === "benchmark"
                  ? "Search benchmarks and ranked models"
                  : "Search families, models, and artifacts"
              }
              aria-controls={
                tab === "benchmark" ? "benchmark-results" : "search-results"
              }
              className="w-full min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
            />
          </label>
          <nav
            aria-label="Primary"
            className="col-span-3 row-start-2 flex min-w-0 items-center gap-1 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:justify-end"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => switchTab(item.id)}
                className={`relative flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-[13.5px] font-semibold transition-colors after:absolute after:inset-x-3 after:-bottom-3 after:h-0.5 after:bg-ink after:transition-opacity lg:after:-bottom-[17px] ${
                  tab === item.id
                    ? "text-ink after:opacity-100"
                    : "text-muted after:opacity-0 hover:text-ink"
                }`}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className="flex-none"
                />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="col-start-3 row-start-1 justify-self-end lg:col-start-4">
            {capacityControls}
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full px-5 ${
          (tab === "home" || (tab === "model" && !selectedModel)) && !query.trim()
            ? "max-w-[1440px]"
            : "max-w-[1240px]"
        }`}
      >
        {query.trim() && tab !== "benchmark" ? (
          <SearchView
            query={query}
            entries={entries}
            families={families}
            onSelect={selectSearchResult}
            onClear={() => setQuery("")}
          />
        ) : tab === "home" ? (
          <HomeView
            entries={entries}
            syncedAt={syncedAt}
            loading={loading}
            source={source}
            health={health}
            onOpenModel={openModel}
            onViewModels={() => switchTab("model")}
            onViewBenchmarks={() => switchTab("benchmark")}
            onOpenDoc={openDoc}
            onViewDocs={() => switchTab("docs")}
          />
        ) : tab === "model" ? (
          selectedModel ? (
            <ModelDetailView
              key={`${selectedModel.slug}-${preferredVariant ?? "default"}`}
              entry={selectedModel}
              rig={rig}
              preferredVariant={preferredVariant}
              checked={checked}
              onBack={closeModel}
              onCheck={toggleChecked}
              onLearn={openLearn}
            />
          ) : (
            <ModelCatalogView
              key={catalogFamilyId ?? "all"}
              entries={entries}
              families={families}
              initialFamilyId={catalogFamilyId}
              onOpen={openModel}
            />
          )
        ) : tab === "benchmark" ? (
          <BenchmarkView
            entries={entries}
            query={query}
            onOpen={openModel}
          />
        ) : (
          <LearnView slug={docSlug} onOpen={openDoc} onBack={closeDoc} />
        )}

        {drawerOpen && (
          <CompareDrawer
            artifacts={checkedArtifacts}
            rig={rig}
            onRemove={(repo) => toggleChecked(repo, false)}
            onClear={() => setChecked(new Set())}
          />
        )}
      </main>
    </div>
  );
}
