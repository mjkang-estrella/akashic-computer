"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  BENCHES,
  COMPARE_MODELS,
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

type Tab = "explore" | "compare" | "learn";

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
  const [tab, setTab] = useState<Tab>("explore");
  const [query, setQuery] = useState("");

  // explore selection
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
  const [onlyRunnable, setOnlyRunnable] = useState(false);

  // compare tab: category first, then its benchmarks
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
    // one-time sync from URL after hydration; an initializer would mismatch SSR HTML
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (param === "learn" || param === "explore") setTab(param);
    if (param === "compare" && COMPARE_MODELS.length > 0) setTab(param);
    if (param === "compare" && COMPARE_MODELS.length === 0) {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "explore");
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
    setTab("explore");
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "explore");
    url.hash = "";
    window.history.replaceState(null, "", url);
  };
  const openLearn = (term?: string) => {
    setTab("learn");
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "learn");
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

  const drawerOpen = tab === "explore" && checkedArtifacts.length >= 1;
  const tabs: { id: Tab; label: string }[] = [
    { id: "explore", label: "Explore" },
    ...(COMPARE_MODELS.length > 0
      ? ([{ id: "compare", label: "Compare models" }] as const)
      : []),
    { id: "learn", label: "Learn" },
  ];

  const capacityControls = (
    <FitBar
      presetId={presetId}
      manualGb={manualGb}
      onlyRunnable={onlyRunnable}
      onPreset={(id) => {
        setPresetId(id);
        setManualGb(null);
      }}
      onManualGb={setManualGb}
      onOnlyRunnable={setOnlyRunnable}
    />
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1240px] px-5 pb-28">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3.5 border-b border-line pb-3 pt-3.5">
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
            Akashic Computer
          </h1>
        </div>
        <nav
          aria-label="Mode"
          className="flex overflow-hidden rounded-[7px] border border-line bg-panel"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              aria-pressed={tab === item.id}
              onClick={() => switchTab(item.id)}
              className={`min-h-11 px-4.5 py-1.5 text-[13.5px] font-semibold sm:min-h-8 ${
                tab === item.id ? "bg-ink text-paper" : "text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <label className="flex min-h-11 max-w-95 flex-1 basis-55 items-center gap-2 rounded-[7px] border border-line bg-panel px-2.5 py-1.5 sm:min-h-8">
          <Search size={14} aria-hidden="true" className="flex-none text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search families, models, artifacts…"
            aria-label="Search families, models, and artifacts"
            aria-controls="search-results"
            className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-faint"
          />
        </label>
        <div className="ml-auto">{capacityControls}</div>
      </header>

      {query.trim() ? (
        <SearchView
          query={query}
          onSelect={selectSearchResult}
          onClear={() => setQuery("")}
        />
      ) : tab === "explore" ? (
        <ExploreView
          key={familyId}
          familyId={familyId}
          releaseId={releaseId}
          sizeLabel={sizeLabel}
          variant={variant}
          rig={rig}
          onlyRunnable={onlyRunnable}
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
      ) : tab === "compare" ? (
        <CompareView
          query={query}
          rig={rig}
          onlyRunnable={onlyRunnable}
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
  );
}
