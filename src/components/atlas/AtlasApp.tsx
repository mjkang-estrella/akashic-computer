"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  BENCHES,
  DEFAULT_PRESET_ID,
  FAMILIES,
  HEADLINE_BENCHES,
  RIG_PRESETS,
} from "@/lib/atlas/data";
import { artifactsFor, resolveProfile } from "@/lib/atlas/fit";
import { sizeDisplay } from "@/lib/atlas/naming";
import type { BenchKey } from "@/lib/atlas/types";
import { CompareDrawer } from "./CompareDrawer";
import {
  CompareView,
  type CompareCategory,
  type CompareSortKey,
} from "./CompareView";
import { ExploreView } from "./ExploreView";
import { FitBar } from "./FitBar";

type Tab = "explore" | "compare";

const initialFamily = FAMILIES[0];

export function AtlasApp() {
  const [tab, setTab] = useState<Tab>("explore");
  const [query, setQuery] = useState("");

  // explore selection
  const [familyId, setFamilyId] = useState(initialFamily.id);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [artifactBench, setArtifactBench] = useState<BenchKey>("mmlu");

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
    if (param === "compare" || param === "explore") setTab(param);
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  const rig = resolveProfile(RIG_PRESETS, presetId, manualGb);

  const selection = useMemo(() => {
    const family = FAMILIES.find((f) => f.id === familyId) ?? FAMILIES[0];
    const release = family.releases.find((item) => item.id === releaseId) ?? null;
    const size = release?.sizes.find((item) => item.label === sizeLabel) ?? null;
    const activeVariant = size
      ? size.variants.length === 1
        ? size.variants[0]
        : variant && size.variants.includes(variant)
          ? variant
          : null
      : null;
    return { family, release, size, variant: activeVariant };
  }, [familyId, releaseId, sizeLabel, variant]);

  const checkedArtifacts = useMemo(() => {
    const artifacts = selection.family.releases.flatMap((release) =>
      release.sizes.flatMap((size) =>
        size.variants.flatMap((itemVariant) =>
          artifactsFor(selection.family, release, size, itemVariant),
        ),
      ),
    );
    return artifacts.filter((a) => checked.has(a.repo));
  }, [selection, checked]);

  const selectFamily = (id: string) => {
    setFamilyId(id);
    setReleaseId(null);
    setSizeLabel(null);
    setVariant(null);
    setChecked(new Set());
  };
  const selectRelease = (id: string) => {
    setReleaseId((current) => (current === id ? null : id));
    setSizeLabel(null);
    setVariant(null);
    setChecked(new Set());
  };
  const selectSize = (label: string) => {
    setSizeLabel((current) => (current === label ? null : label));
    setVariant(null);
    setChecked(new Set());
  };
  const selectVariant = (v: string) => {
    setVariant((current) => (current === v ? null : v));
    setChecked(new Set());
  };
  const toggleChecked = (repo: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(repo);
      else next.delete(repo);
      return next;
    });
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

  const drawerOpen = tab === "explore" && checkedArtifacts.length >= 2;

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
          role="tablist"
          aria-label="Mode"
          className="flex overflow-hidden rounded-[7px] border border-line bg-panel"
        >
          {(["explore", "compare"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              className={`px-4.5 py-1.5 text-[13.5px] font-semibold ${
                tab === t ? "bg-ink text-paper" : "text-muted"
              }`}
            >
              {t === "compare" ? "Compare models" : "Explore"}
            </button>
          ))}
        </nav>
        <label className="flex max-w-95 flex-1 basis-55 items-center gap-2 rounded-[7px] border border-line bg-panel px-2.5 py-1.5">
          <Search size={14} aria-hidden="true" className="flex-none text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models, families, vendors…"
            aria-label="Search models and families"
            className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-faint"
          />
        </label>
      </header>

      {tab === "explore" ? (
        <ExploreView
          query={query}
          familyId={familyId}
          releaseId={releaseId}
          sizeLabel={sizeLabel}
          variant={variant}
          rig={rig}
          onlyRunnable={onlyRunnable}
          checked={checked}
          artifactBench={artifactBench}
          capacityControls={capacityControls}
          onFamily={selectFamily}
          onRelease={selectRelease}
          onSize={selectSize}
          onVariant={selectVariant}
          onCheck={toggleChecked}
          onArtifactBench={setArtifactBench}
          onClearQuery={() => setQuery("")}
        />
      ) : (
        <CompareView
          query={query}
          rig={rig}
          onlyRunnable={onlyRunnable}
          category={category}
          activeBenches={activeBenches}
          sortKey={sortKey}
          sortDir={sortDir}
          expanded={expanded}
          capacityControls={capacityControls}
          onCategory={selectCategory}
          onToggleBench={toggleBench}
          onSort={sortBy}
          onToggleExpand={toggleExpand}
        />
      )}

      {drawerOpen && (
        <CompareDrawer
          title={
            selection.release && selection.size && selection.variant
              ? `${selection.release.name} ${sizeDisplay(selection.size.label)} ${selection.variant}`
              : selection.family.name
          }
          artifacts={checkedArtifacts}
          rig={rig}
          onClear={() => setChecked(new Set())}
        />
      )}
    </main>
  );
}
