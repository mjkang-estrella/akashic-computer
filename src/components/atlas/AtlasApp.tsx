"use client";

import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import {
  BENCHES,
  DEFAULT_PRESET_ID,
  FAMILIES,
  HEADLINE_BENCHES,
  RIG_PRESETS,
} from "@/lib/atlas/data";
import { artifactsFor, resolveProfile } from "@/lib/atlas/fit";
import type { BenchKey } from "@/lib/atlas/types";
import { CompareDrawer } from "./CompareDrawer";
import {
  CompareView,
  type CompareCategory,
  type CompareSortKey,
} from "./CompareView";
import { ExploreView } from "./ExploreView";
import { FitBar } from "./FitBar";
import { LearnView } from "./LearnView";
import { SearchView, type SearchTarget } from "./SearchView";

type Tab = "model" | "benchmark" | "docs";

const LEGACY_TABS: Record<string, Tab> = {
  explore: "model",
  compare: "benchmark",
  learn: "docs",
};

const initialFamily = FAMILIES[0];
const ALL_ARTIFACTS = Array.from(
  new Map(
    FAMILIES.flatMap((family) =>
      family.releases.flatMap((release) =>
        release.sizes.flatMap((size) =>
          size.variants.flatMap((variant) =>
            artifactsFor(family, release, size, variant),
          ),
        ),
      ),
    ).map((artifact) => [artifact.repo, artifact]),
  ).values(),
);

export function AtlasApp() {
  const [tab, setTab] = useState<Tab>("model");
  const [query, setQuery] = useState("");

  // model selection
  const [familyId, setFamilyId] = useState(initialFamily.id);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [quantizations, setQuantizations] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [artifactBenches, setArtifactBenches] = useState<Set<BenchKey>>(new Set());

  // rig profile
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [manualGb, setManualGb] = useState<number | null>(null);

  // benchmark tab: category first, then its benchmarks
  const [category, setCategory] = useState<CompareCategory>("all");
  const [activeBenches, setActiveBenches] = useState<Set<BenchKey>>(
    new Set(HEADLINE_BENCHES),
  );
  const [sortKey, setSortKey] = useState<CompareSortKey>("mmlu");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // shareable mode: read ?tab= on mount, write it back on change
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    const nextTab =
      param === "model" || param === "benchmark" || param === "docs"
        ? param
        : param
          ? LEGACY_TABS[param]
          : undefined;
    // one-time sync from URL after hydration; an initializer would mismatch SSR HTML
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextTab) setTab(nextTab);
    if (param && nextTab && param !== nextTab) {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState(null, "", url);
    }
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    url.hash = "";
    window.history.replaceState(null, "", url);
  };

  const rig = resolveProfile(RIG_PRESETS, presetId, manualGb);

  const checkedArtifacts = useMemo(() => {
    return ALL_ARTIFACTS.filter((artifact) => checked.has(artifact.repo));
  }, [checked]);

  const selectFamily = (id: string) => {
    setFamilyId(id);
    setReleaseId(null);
    setSizeLabel(null);
    setVariant(null);
    setQuantizations(new Set());
  };
  const selectRelease = (id: string) => {
    const nextReleaseId = releaseId === id ? null : id;
    const family = FAMILIES.find((item) => item.id === familyId);
    const nextRelease = family?.releases.find((item) => item.id === nextReleaseId);

    setReleaseId(nextReleaseId);
    setSizeLabel(
      nextRelease?.sizes.length === 1 ? nextRelease.sizes[0].label : null,
    );
    setVariant(null);
    setQuantizations(new Set());
  };
  const selectSize = (label: string) => {
    setSizeLabel((current) => (current === label ? null : label));
    setVariant(null);
    setQuantizations(new Set());
  };
  const selectVariant = (v: string) => {
    setVariant((current) => (current === v ? null : v));
    setQuantizations(new Set());
  };
  const toggleQuantization = (format: string) => {
    setQuantizations((current) => {
      const next = new Set(current);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  };
  const toggleArtifactBench = (key: BenchKey) => {
    setArtifactBenches((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
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
  const selectSearchResult = (target: SearchTarget) => {
    setFamilyId(target.familyId);
    setReleaseId(target.releaseId ?? null);
    setSizeLabel(target.sizeLabel ?? null);
    setVariant(target.variant ?? null);
    setQuantizations(
      target.quantization ? new Set([target.quantization]) : new Set(),
    );
    setTab("model");
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "model");
    url.hash = "";
    window.history.replaceState(null, "", url);
  };
  const openLearn = (term?: string) => {
    setTab("docs");
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "docs");
    url.hash = term ? `term-${term}` : "";
    window.history.replaceState(null, "", url);
    if (term) {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`term-${term}`)
          ?.scrollIntoView({ block: "start" });
      });
    }
  };
  const selectCategory = (c: CompareCategory) => {
    setCategory(c);
    const keys =
      c === "all"
        ? HEADLINE_BENCHES
        : BENCHES.filter((b) => b.category === c).map((b) => b.key);
    setActiveBenches(new Set(keys));
    setSortKey(keys[0]);
    setSortDir(-1);
  };
  const toggleBench = (key: BenchKey) => {
    setActiveBenches((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      if (!next.has(sortKey as BenchKey) && sortKey !== "model") {
        setSortKey([...next][0]);
      }
      return next;
    });
  };
  const sortBy = (key: CompareSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === -1 ? 1 : -1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  };
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const drawerOpen = tab === "model" && checkedArtifacts.length >= 1;
  const tabs: { id: Tab; label: string }[] = [
    { id: "model", label: "Model" },
    { id: "benchmark", label: "Benchmark" },
    { id: "docs", label: "Docs" },
  ];

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

  return (
    <div className="min-h-screen pb-28">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-5 py-3 lg:grid-cols-[auto_minmax(280px,420px)_minmax(0,1fr)_auto] lg:gap-x-5">
          <div className="flex items-center gap-2.5">
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              aria-hidden="true"
              className="flex-none text-ink"
            >
              <circle
                cx="11"
                cy="11"
                r="8.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.3"
              />
              <ellipse
                cx="11"
                cy="11"
                rx="8.5"
                ry="3.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                transform="rotate(-24 11 11)"
              />
              <circle cx="11" cy="11" r="2" fill="currentColor" />
              <circle cx="18.2" cy="7.2" r="1.4" fill="currentColor" />
            </svg>
            <h1 className="font-display text-[19px] font-semibold leading-none">
              Akashic
            </h1>
          </div>
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
              placeholder="Search models, families, artifacts…"
              aria-label="Search families, models, and artifacts"
              aria-controls="search-results"
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
                className={`relative min-h-10 px-3 py-1.5 text-[13.5px] font-semibold transition-colors after:absolute after:inset-x-3 after:-bottom-3 after:h-0.5 after:bg-ink after:transition-opacity lg:after:-bottom-[17px] ${
                  tab === item.id
                    ? "text-ink after:opacity-100"
                    : "text-muted after:opacity-0 hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="col-start-3 row-start-1 justify-self-end lg:col-start-4">
            {capacityControls}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-5">
        {query.trim() ? (
          <SearchView
            query={query}
            onSelect={selectSearchResult}
            onClear={() => setQuery("")}
          />
        ) : tab === "model" ? (
          <ExploreView
            key={familyId}
            familyId={familyId}
            releaseId={releaseId}
            sizeLabel={sizeLabel}
            variant={variant}
            rig={rig}
            onlyRunnable={false}
            checked={checked}
            quantizations={quantizations}
            artifactBenches={artifactBenches}
            onFamily={selectFamily}
            onRelease={selectRelease}
            onSize={selectSize}
            onVariant={selectVariant}
            onToggleQuantization={toggleQuantization}
            onCheck={toggleChecked}
            onToggleArtifactBench={toggleArtifactBench}
            onLearn={openLearn}
          />
        ) : tab === "benchmark" ? (
          <CompareView
            query={query}
            rig={rig}
            onlyRunnable={false}
            category={category}
            activeBenches={activeBenches}
            sortKey={sortKey}
            sortDir={sortDir}
            expanded={expanded}
            onCategory={selectCategory}
            onToggleBench={toggleBench}
            onSort={sortBy}
            onToggleExpand={toggleExpand}
          />
        ) : (
          <LearnView />
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
