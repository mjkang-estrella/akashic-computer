"use client";

import { Suspense, createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueries } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hydratePublishedEntries, type PublishedCatalogEntry } from "@/lib/atlas/published";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeftRightIcon,
  Briefcase01Icon,
  ComputerIcon,
  BookOpenTextIcon,
  ChartColumnIcon,
  CubeIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { AccountControl, connectedWorkspaceEnabled } from "../AccountControl";
import { AkashicMark } from "@/components/brand/AkashicMark";
import { DEFAULT_CONTEXT, DEFAULT_PRESET_ID, HARDWARE_PRESETS, RIG_PRESETS } from "@/lib/atlas/data";
import { resolveProfile } from "@/lib/atlas/fit";
import type { ContextChoice, RigProfile } from "@/lib/atlas/types";
import { CompareDrawer } from "./CompareDrawer";
import { FitBar } from "./FitBar";
import { comparisonEnabled } from "@/lib/atlas/comparisonFlags";
import { useDeploymentComparison } from "../comparison/ComparisonProvider";


interface AtlasUiContextValue {
  rig: RigProfile | null;
  context: ContextChoice;
  setContext: (context: ContextChoice) => void;
  checked: Set<string>;
  toggleChecked: (repo: string, on: boolean, slug: string) => void;
}

const AtlasUiContext = createContext<AtlasUiContextValue | null>(null);

const BUDGET_STORAGE_KEY = "akashic:memory-budget";

function readSavedBudget(): { presetId: string | null; manualGb: number | null } | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(BUDGET_STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const { presetId, manualGb } = value as Record<string, unknown>;
    const knownPreset = typeof presetId === "string" &&
      [...RIG_PRESETS, ...HARDWARE_PRESETS].some((preset) => preset.id === presetId);
    const validManual = typeof manualGb === "number" && Number.isFinite(manualGb) && manualGb >= 4 && manualGb <= 2048;
    if (!knownPreset && !validManual) return null;
    return { presetId: knownPreset ? presetId : null, manualGb: validManual ? manualGb : null };
  } catch {
    return null;
  }
}

export function useAtlasUi(): AtlasUiContextValue {
  const value = useContext(AtlasUiContext);
  if (!value) throw new Error("useAtlasUi must be used inside AtlasShell");
  return value;
}

export function AtlasShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { selections, replace } = useDeploymentComparison();
  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET_ID);
  const [manualGb, setManualGb] = useState<number | null>(null);
  const [context, setContext] = useState<ContextChoice>(DEFAULT_CONTEXT);
  const [checkedModels, setCheckedModels] = useState<Map<string, string>>(new Map());
  const checked = useMemo(() => new Set(checkedModels.keys()), [checkedModels]);
  const rig = useMemo(() => resolveProfile([...RIG_PRESETS, ...HARDWARE_PRESETS], presetId, manualGb), [presetId, manualGb]);

  // Only a budget the visitor chose is remembered; reading after mount keeps hydration stable.
  useEffect(() => {
    const saved = readSavedBudget();
    if (!saved) return;
    const timer = window.setTimeout(() => {
      setPresetId(saved.presetId);
      setManualGb(saved.manualGb);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const chooseBudget = (nextPresetId: string | null, nextManualGb: number | null) => {
    setPresetId(nextPresetId);
    setManualGb(nextManualGb);
    try {
      if (nextPresetId || nextManualGb) {
        window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify({ presetId: nextPresetId, manualGb: nextManualGb }));
      } else window.localStorage.removeItem(BUDGET_STORAGE_KEY);
    } catch {
      // Storage may be unavailable; the choice still applies for this session.
    }
  };

  // List summaries omit memory and benchmark evidence. Fetch only the selected models.
  const comparisonQueries = useMemo(() => Object.fromEntries(
    [...new Set(checkedModels.values())]
      .map((slug) => [slug, { query: api.catalog.getBySlug, args: { slug } }]),
  ), [checkedModels]);
  const comparisonResults = useQueries(comparisonQueries);
  const checkedArtifacts = useMemo(() => {
    const details = Object.values(comparisonResults).filter((value): value is PublishedCatalogEntry =>
      Boolean(value) && !(value instanceof Error),
    );
    const artifacts = new Map(
      hydratePublishedEntries(details).entries.flatMap((entry) => entry.artifacts).map((artifact) => [artifact.repo, artifact]),
    );
    return [...checked].flatMap((repo) => {
      const artifact = artifacts.get(repo);
      return artifact ? [artifact] : [];
    });
  }, [checked, comparisonResults]);

  const toggleChecked = useCallback((repo: string, on: boolean, slug: string) => {
    setCheckedModels((current) => {
      const next = new Map(current);
      if (on && next.size < 4) next.set(repo, slug);
      if (!on) next.delete(repo);
      return next;
    });
  }, []);
  const ui = useMemo(() => ({ rig, context, setContext, checked, toggleChecked }), [rig, context, checked, toggleChecked]);

  const navigation = [
    { href: "/models", label: "Models", icon: CubeIcon, active: pathname.startsWith("/models") },
    { href: "/benchmarks", label: "Benchmarks", icon: ChartColumnIcon, active: pathname.startsWith("/benchmarks") },
    { href: "/compare", label: "Compare", icon: ArrowLeftRightIcon, active: pathname.startsWith("/compare") },
    { href: "/docs", label: "Docs", icon: BookOpenTextIcon, active: pathname.startsWith("/docs") },
    { href: "/workspace", label: "Workspace", icon: Briefcase01Icon, active: pathname.startsWith("/workspace") },
    { href: "/computers", label: "Computers", icon: ComputerIcon, active: pathname.startsWith("/computers") },
  ] as const;
  const wide = pathname === "/" || pathname === "/models";

  return (
    <AtlasUiContext.Provider value={ui}>
      <div className="min-h-screen pb-28">
        <header className="border-b border-line bg-paper">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-5 py-3 lg:grid-cols-[auto_minmax(280px,420px)_minmax(0,1fr)_auto] lg:gap-x-5">
            <Link href="/" aria-label="Akashic Computer home" className="flex min-h-11 items-center gap-2.5 text-left sm:min-h-9">
              <AkashicMark className="flex-none text-ink" />
              <span className="font-display text-[19px] font-semibold leading-none">Akashic Computer</span>
            </Link>
            <Suspense fallback={<SearchInputShell />}>
              <CatalogSearchInput />
            </Suspense>
            <nav aria-label="Primary" className="col-span-3 row-start-2 flex flex-wrap min-w-0 items-center gap-1 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:justify-end">
              {navigation.filter(item => (connectedWorkspaceEnabled || !["/workspace", "/computers"].includes(item.href)) && (comparisonEnabled || item.href !== "/compare")).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={`relative flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-[13.5px] font-semibold transition-colors after:absolute after:inset-x-3 after:-bottom-3 after:h-0.5 after:bg-ink after:transition-opacity lg:after:-bottom-[17px] ${item.active ? "text-ink after:opacity-100" : "text-muted after:opacity-0 hover:text-ink"}`}
                >
                  <HugeiconsIcon icon={item.icon} size={16} strokeWidth={1.8} aria-hidden="true" className="flex-none" />
                  {item.label}
                </Link>
              ))}
            <AccountControl /></nav>
            <div className="col-start-3 row-start-1 justify-self-end lg:col-start-4">
              <FitBar
                presetId={presetId}
                manualGb={manualGb}
                rig={rig}
                onPreset={(id) => chooseBudget(id, null)}
                onManualGb={(gb) => chooseBudget(gb ? null : presetId, gb)}
                onClear={() => chooseBudget(null, null)}
              />
            </div>
          </div>
        </header>

        <main className={`mx-auto w-full px-5 ${wide ? "max-w-[1440px]" : "max-w-[1240px]"}`}>
          {children}
          {comparisonEnabled && selections.length > 0 && !pathname.startsWith("/compare") ? <aside aria-label="Exact deployment shortlist" className="my-6 flex flex-wrap items-center gap-4 border-y border-line bg-panel p-4 text-sm">
            <strong>{selections.length} exact files selected</strong>
            <Link className="comparison-button comparison-primary" href="/compare">Compare for my computer</Link>
            <button className="comparison-button" onClick={() => replace([])}>Clear file shortlist</button>
          </aside> : null}
          {comparisonEnabled && checkedArtifacts.length ? <p className="my-3 text-sm text-muted">Repository comparison below uses catalog estimates. <Link className="underline" href="/compare">Choose exact files for a deployment comparison</Link>.</p> : null}
          {checkedArtifacts.length > 0 ? (
            <CompareDrawer
              artifacts={checkedArtifacts}
              rig={rig}
              context={context}
              onRemove={(repo) => toggleChecked(repo, false, "")}
              onClear={() => setCheckedModels(new Map())}
            />
          ) : null}
        </main>
      </div>
    </AtlasUiContext.Provider>
  );
}

function SearchInputShell({ value = "", onChange, onEscape, searching = false }: {
  value?: string;
  onChange?: (value: string) => void;
  onEscape?: () => void;
  searching?: boolean;
}) {
  return (
    <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-[7px] border border-line bg-panel px-3 py-1.5 sm:min-h-9">
      <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="flex-none text-faint" />
      <input type="search" value={value} readOnly={!onChange}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onEscape?.(); } }}
        placeholder="Search models, families, artifacts..."
        aria-label="Search the Akashic Computer catalog"
        aria-controls={searching ? "search-results" : undefined}
        className="w-full min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
    </label>
  );
}

function CatalogSearchInput() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const previousPath = useRef<string | null>(null);
  const internalSearchRef = useRef(false);
  useEffect(() => {
    if (pathname === "/search" && previousPath.current && previousPath.current !== "/search") internalSearchRef.current = true;
    if (pathname !== "/search") internalSearchRef.current = false;
    previousPath.current = pathname;
  }, [pathname]);
  return <>
    <Suspense fallback={null}><SearchQueryReader onQuery={setQuery} /></Suspense>
    <SearchInputController pathname={pathname}
      query={pathname === "/search" ? query : ""} internalSearchRef={internalSearchRef} />
  </>;
}

function SearchQueryReader({ onQuery }: { onQuery: (query: string) => void }) {
  const query = useSearchParams().get("q") ?? "";
  useEffect(() => onQuery(query), [onQuery, query]);
  return null;
}

function SearchInputController({ pathname, query, internalSearchRef }: {
  pathname: string;
  query: string;
  internalSearchRef: { current: boolean };
}) {
  const router = useRouter();
  const [text, setText] = useState(query);
  const [pending, setPending] = useState(false);
  const [urlState, setUrlState] = useState({ pathname, query });
  if (urlState.pathname !== pathname || urlState.query !== query) {
    setUrlState({ pathname, query });
    if (pathname !== "/search") {
      setText("");
      setPending(false);
    } else if (!pending) setText(query);
    else if (query === text) setPending(false);
  }
  // Finish edits made while the first push was still pending. Replacing before
  // that push commits can replace the source page's history entry instead.
  useEffect(() => {
    if (pathname === "/search" && pending && text.trim() && text !== query) {
      startTransition(() => router.replace(`/search?q=${encodeURIComponent(text)}`, { scroll: false }));
    }
  }, [pathname, pending, query, router, text]);
  const clear = () => {
    setPending(false);
    setText("");
    if (pathname === "/search") {
      if (internalSearchRef.current) router.back();
      else router.replace("/");
    }
  };
  return <SearchInputShell value={text} searching={pathname === "/search"} onEscape={clear} onChange={(value) => {
    setText(value);
    if (!value.trim()) { clear(); return; }
    setPending(true);
    if (pathname !== "/search" && !pending) {
      internalSearchRef.current = true;
      startTransition(() => router.push(`/search?q=${encodeURIComponent(value)}`, { scroll: false }));
    }
  }} />;
}
