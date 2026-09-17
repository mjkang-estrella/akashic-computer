"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  BookOpen02Icon,
  ChartColumnIcon,
  Clock01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { resolveOfficialBenchmarks } from "@/lib/atlas/benchmarks";
import { DOC_ARTICLES } from "@/lib/atlas/docsArticles";
import type { ModelEntry } from "@/lib/atlas/models";
import { modelReleaseName, parameterCountLabel } from "@/lib/atlas/naming";
import type { MaterialChange } from "@/lib/atlas/types";
import { MODEL_CATEGORIES } from "@/lib/atlas/taxonomy";
import { FamilyLogo } from "./FamilyLogo";
import { ModelPathExplorer } from "./ModelPathExplorer";

const FEATURED_BENCHMARK_IDS = [
  "mmlu-pro",
  "gpqa-diamond",
  "livecodebench-v6",
] as const;

const FEATURED_DOC_SLUGS = [
  "model-checkpoint-artifact-runtime",
  "quantization",
  "memory-and-context",
] as const;

const CATEGORY_DESCRIPTIONS = {
  language: "Chat, code, reason, and use tools",
  "vision-documents": "Understand images and read documents",
  "image-generation": "Create and edit images",
  "video-generation": "Turn prompts and images into video",
  "audio-speech": "Transcribe, speak, and create sound",
  retrieval: "Search, embed, and rerank information",
  "3d-spatial": "Generate objects and understand space",
  "world-models": "Model environments and their dynamics",
  robotics: "Connect perception to physical action",
} as const;

interface CatalogHealth {
  level: "healthy" | "degraded" | "stale";
  catalogStale: boolean;
  catalogDegraded: boolean;
  sourceTotal: number;
  freshSourceCount: number;
  staleSourceCount: number;
  failingSourceCount: number;
  retryingSourceCount: number;
  staleSources: string[];
  pendingWebhookCount: number;
  failedWebhookCount: number;
  webhookStale: boolean;
  lastCompletedAuditAt: number | null;
}

const LAST_VISIT_KEY = "akashic:last-catalog-visit";
const SESSION_VISIT_KEY = "akashic:catalog-session-start";
const SESSION_PREVIOUS_VISIT_KEY = "akashic:catalog-previous-visit";

function formatSyncTime(value: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(value);
}

function releaseTimestamp(entry: ModelEntry): number {
  const parsed = Date.parse(entry.release.date);
  return Number.isFinite(parsed) ? parsed : entry.timestamp;
}

function releaseDateLabel(entry: ModelEntry): string {
  return new Date(releaseTimestamp(entry)).toISOString().slice(0, 10);
}

function SectionLink({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-meta hover:text-ink"
    >
      {children}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={15}
        strokeWidth={1.8}
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

function CatalogStatus({
  syncedAt,
  loading,
  health,
  revision,
}: {
  syncedAt: number | null;
  loading: boolean;
  health: CatalogHealth | null;
  revision: string;
}) {
  const delayed = health?.catalogStale;
  const degraded = health?.catalogDegraded;

  let label = "Live catalog connected";
  if (loading) label = "Refreshing the live catalog";
  else if (health?.sourceTotal) {
    if (delayed) label = "Catalog refresh overdue";
    else if (degraded) {
      label = `Catalog partially current · ${health.freshSourceCount}/${health.sourceTotal} sources`;
    } else if (syncedAt) label = `Catalog current · ${formatSyncTime(syncedAt)}`;
    else label = "Live catalog connected";
  }

  return (
    <details className="group/status max-w-[620px] text-[11px] text-faint">
      <summary
        aria-live="polite"
        className={`flex min-h-9 cursor-pointer list-none items-center gap-2 font-mono marker:hidden ${
          delayed || degraded ? "text-caution" : "text-faint"
        }`}
      >
        <HugeiconsIcon
          icon={RefreshIcon}
          size={15}
          strokeWidth={1.8}
          aria-hidden="true"
          className={loading ? "animate-spin motion-reduce:animate-none" : ""}
        />
        <span>{label}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          strokeWidth={1.8}
          aria-hidden="true"
          className="transition-transform group-open/status:rotate-180"
        />
      </summary>
      <div className="grid gap-1 border-l border-line pl-5 pb-2 font-mono leading-relaxed sm:grid-cols-2 sm:gap-x-6">
        <span>Source · Live Convex catalog</span>
        <span>Revision · {revision === "loading" ? "Resolving" : revision.slice(0, 12)}</span>
        {health?.sourceTotal ? (
          <>
            <span>Hugging Face · {health.freshSourceCount}/{health.sourceTotal} sources current</span>
            <span>Webhooks · {health.pendingWebhookCount} pending · {health.failedWebhookCount} failed</span>
            {health.staleSources.length > 0 ? (
              <span className="sm:col-span-2">Delayed · {health.staleSources.join(", ")}</span>
            ) : null}
          </>
        ) : null}
        <span className="sm:col-span-2">
          Delayed sources keep their last known good entries while Akashic retries them independently.
        </span>
      </div>
    </details>
  );
}

function HomeLoadingRows() {
  return (
    <div className="divide-y divide-linesoft border-y border-line" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="grid min-h-[76px] animate-pulse items-center gap-3 py-4 motion-reduce:animate-none sm:grid-cols-[minmax(190px,1fr)_100px_minmax(150px,0.8fr)_110px]"
        >
          <span className="h-5 w-2/3 rounded-[4px] bg-panel2" />
          <span className="h-4 w-14 rounded-[4px] bg-panel2" />
          <span className="h-4 w-28 rounded-[4px] bg-panel2" />
          <span className="h-4 w-20 rounded-[4px] bg-panel2" />
        </div>
      ))}
    </div>
  );
}

export function HomeView({
  entries,
  materialChanges,
  syncedAt,
  loading,
  health,
  revision,
  onOpenModel,
  onViewModels,
  onViewBenchmarks,
  onOpenDoc,
  onViewDocs,
}: {
  entries: ModelEntry[];
  materialChanges: MaterialChange[];
  syncedAt: number | null;
  loading: boolean;
  health: CatalogHealth | null;
  revision: string;
  onOpenModel: (entry: ModelEntry) => void;
  onViewModels: () => void;
  onViewBenchmarks: () => void;
  onOpenDoc: (slug: string) => void;
  onViewDocs: () => void;
}) {
  const [previousVisit, setPreviousVisit] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let priorVisit: number | null = null;
    try {
      const sessionStart = window.sessionStorage.getItem(SESSION_VISIT_KEY);
      if (sessionStart) {
        const prior = window.sessionStorage.getItem(SESSION_PREVIOUS_VISIT_KEY);
        priorVisit = prior ? Number(prior) : null;
      } else {
        const now = Date.now();
        const prior = window.localStorage.getItem(LAST_VISIT_KEY);
        window.sessionStorage.setItem(SESSION_VISIT_KEY, String(now));
        window.sessionStorage.setItem(SESSION_PREVIOUS_VISIT_KEY, prior ?? "");
        window.localStorage.setItem(LAST_VISIT_KEY, String(now));
        priorVisit = prior ? Number(prior) : null;
      }
    } catch {
      priorVisit = null;
    }
    const timer = window.setTimeout(() => setPreviousVisit(priorVisit), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const showEmptyLoadingState = loading && entries.length === 0;
  const changesSinceVisit = useMemo(
    () =>
      previousVisit == null
        ? null
        : materialChanges.filter((change) => change.occurredAt > previousVisit).length,
    [materialChanges, previousVisit],
  );
  const visibleChanges = useMemo(
    () => materialChanges.flatMap((change) => {
      const entry = entries.find((candidate) => candidate.slug === change.modelSlug);
      return entry ? [{ change, entry }] : [];
    }).slice(0, 5),
    [entries, materialChanges],
  );
  const recentEntries = useMemo(
    () =>
      [...entries]
        .sort(
          (a, b) =>
            releaseTimestamp(b) - releaseTimestamp(a) ||
            a.name.localeCompare(b.name) ||
            b.size.paramsB - a.size.paramsB,
        )
        .slice(0, 6),
    [entries],
  );
  const benchmarkCoverage = useMemo(() => {
    const resolved = resolveOfficialBenchmarks(entries);
    const comparable = resolved.filter((benchmark) => benchmark.results.length >= 2);
    const preferred = FEATURED_BENCHMARK_IDS.flatMap((id) => {
      const benchmark = resolved.find((candidate) => candidate.id === id);
      return benchmark && benchmark.results.length >= 2 ? [benchmark] : [];
    });
    const featured = preferred.length === FEATURED_BENCHMARK_IDS.length
      ? preferred
      : preferred.concat(
      resolved
        .filter(
          (benchmark) =>
            benchmark.results.length >= 2 &&
            !preferred.some((candidate) => candidate.id === benchmark.id),
        )
        .slice(0, FEATURED_BENCHMARK_IDS.length - preferred.length),
      );
    return {
      featured,
      benchmarkCount: comparable.length,
      modelCount: new Set(comparable.flatMap((benchmark) => benchmark.results.map((result) => result.entry.slug))).size,
    };
  }, [entries]);
  const featuredBenchmarks = benchmarkCoverage.featured;
  const featuredDocs = FEATURED_DOC_SLUGS.flatMap((slug) => {
    const article = DOC_ARTICLES.find((candidate) => candidate.slug === slug);
    return article ? [article] : [];
  });

  return (
    <section className="pb-10 pt-6 sm:pt-8">
      <header className="grid gap-8 border-b border-line pb-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12">
        <div className="py-2 lg:py-8">
          <h1 className="max-w-[17ch] text-balance font-display text-[42px] font-semibold leading-[1.06] sm:text-[54px] xl:text-[64px]">
            Open-weight models, made legible.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-muted">
            Find a model, its downloadable weights, and the evidence needed to run it.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/models" className="group inline-flex min-h-11 items-center gap-2 rounded-[7px] bg-ink px-4 text-[13px] font-semibold text-paper hover:bg-ink/85">
              Explore the models
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/compare" className="inline-flex min-h-11 items-center gap-2 px-2 text-[13px] font-semibold text-muted hover:text-ink">Compare size vs precision →</Link>
          </div>
          <div className="mt-7 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-line pt-4 font-mono text-[12px]">
            <span><strong className="font-semibold">{loading && !entries.length ? "—" : entries.length}</strong> <span className="text-muted">model sizes</span></span>
            <span><strong className="font-semibold">{loading && !entries.length ? "—" : new Set(entries.map((entry) => entry.family.id)).size}</strong> <span className="text-muted">families</span></span>
            <span><strong className="font-semibold">{loading && !entries.length ? "—" : new Set(entries.map((entry) => entry.category)).size}</strong> <span className="text-muted">categories</span></span>
          </div>
          <div className="mt-2">
            <CatalogStatus syncedAt={syncedAt} loading={loading} health={health} revision={revision} />
          </div>
          {previousVisit != null ? (
            <p className="mt-1 flex items-center gap-2 text-[11.5px] text-muted">
              <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={1.8} aria-hidden="true" />
              {changesSinceVisit ?? 0} model {changesSinceVisit === 1 ? "change" : "changes"} since your last visit
            </p>
          ) : null}
        </div>
        <ModelPathExplorer entries={entries} loading={loading} />
      </header>

      <section className="border-b border-line py-8" aria-labelledby="discovery-title">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="discovery-title" className="font-display text-[24px] font-semibold">Explore by capability</h2>
          <Link href="/models" className="inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-meta hover:text-ink">All models <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={1.8} aria-hidden="true" /></Link>
        </header>
        <div className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {MODEL_CATEGORIES.map((category) => {
            const count = entries.filter((entry) => entry.category === category.id).length;
            const detail = CATEGORY_DESCRIPTIONS[category.id];
            return (
              <Link key={category.id} href={`/models?category=${category.id}`}
                className="group flex min-h-[80px] items-center gap-3 border-b border-line px-3 py-4 hover:bg-panel">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2"><span className="text-[13px] font-semibold group-hover:underline group-hover:underline-offset-4">{category.label}</span><span className="font-mono text-[10px] text-faint">{loading && !entries.length ? "—" : count} model sizes</span></span>
                  <span className="mt-1 block text-[12px] text-muted">{detail}</span>
                </span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="flex-none text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            );
          })}
        </div>
      </section>

      {visibleChanges.length > 0 ? (
        <section className="border-b border-line py-7" aria-labelledby="material-changes-title">
          <header>
            <h3 id="material-changes-title" className="font-display text-[22px] font-semibold">
              Material changes
            </h3>
          </header>
          <div className="mt-4 divide-y divide-linesoft border-y border-line">
            {visibleChanges.map(({ change, entry }, index) => (
              <div
                key={change.id}
                className={`${index >= 3 ? "hidden sm:grid" : "grid"} gap-2 py-3.5 sm:grid-cols-[108px_minmax(180px,0.7fr)_minmax(220px,1.3fr)_auto] sm:items-center sm:gap-5`}
              >
                <span className="font-mono text-[11px] text-faint">{change.dateLabel}</span>
                <button
                  type="button"
                  onClick={() => onOpenModel(entry)}
                  className="truncate text-left text-[12.5px] font-semibold hover:text-meta hover:underline hover:underline-offset-3"
                >
                  {change.modelName}
                </button>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold">{change.title}</span>
                </span>
                {change.sourceUrls[0] ? (
                  <a
                    href={change.sourceUrls[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 text-[11.5px] font-semibold text-meta hover:text-ink"
                  >
                    {change.sourceLabel}
                    <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.8} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-[11px] text-faint">{change.sourceLabel}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-8 pt-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)] xl:gap-12">
        <section aria-labelledby="recent-models-title" className="min-w-0">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-3">
            <h3 id="recent-models-title" className="font-display text-[22px] font-semibold">
              New models
            </h3>
            <SectionLink onClick={onViewModels}>View all models</SectionLink>
          </header>

          <div className="mt-3">
            {showEmptyLoadingState ? (
              <>
                <p className="sr-only" role="status">
                  Loading recent model updates
                </p>
                <HomeLoadingRows />
              </>
            ) : recentEntries.length === 0 ? (
              <div className="border-y border-line py-12 text-center">
                <p className="font-display text-[18px] font-semibold">
                  No published models yet
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  The catalog will appear here after the first successful sync.
                </p>
              </div>
            ) : (
              <div className="border-y border-line">
                <div className="hidden grid-cols-[minmax(200px,1fr)_100px_minmax(150px,0.8fr)_110px_20px] border-b border-line px-2 py-2 font-mono text-[10px] font-semibold text-faint sm:grid">
                  <span>Model</span>
                  <span>Parameters</span>
                  <span>Quantizations</span>
                  <span>Released</span>
                  <span className="sr-only">Open</span>
                </div>
                <div className="divide-y divide-linesoft">
                  {recentEntries.map((entry) => {
                    const visibleQuantizations = entry.quantizations.slice(0, 3);
                    const remaining =
                      entry.quantizations.length - visibleQuantizations.length;
                    return (
                      <button
                        key={entry.slug}
                        type="button"
                        onClick={() => onOpenModel(entry)}
                        aria-label={`Open ${entry.name}`}
                        className="group grid min-h-[96px] w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-3 text-left transition-colors hover:bg-panel sm:min-h-[82px] sm:grid-cols-[minmax(200px,1fr)_100px_minmax(150px,0.8fr)_110px_20px] sm:items-center sm:gap-0 sm:px-2 sm:py-4"
                      >
                        <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 sm:col-auto sm:row-auto">
                          <FamilyLogo
                            familyId={entry.family.id}
                            familyName={entry.family.name}
                            size={30}
                          />
                          <span className="min-w-0">
                            <span className="block font-display text-[15px] font-semibold leading-tight group-hover:underline group-hover:underline-offset-4">
                              {modelReleaseName(entry.family, entry.release)}
                            </span>
                            <span className="mt-1 block text-[12px] text-muted">
                              {entry.family.vendor}
                            </span>
                          </span>
                        </span>
                        <span className="col-start-1 row-start-2 font-mono text-[12.5px] font-semibold sm:col-auto sm:row-auto">
                          <span className="mr-1 text-[11px] font-normal text-muted sm:hidden">
                            Parameters ·
                          </span>
                          {parameterCountLabel(entry.size)}
                        </span>
                        <span className="col-start-2 row-start-2 flex flex-wrap items-center justify-end gap-1.5 sm:col-auto sm:row-auto sm:justify-start">
                          {visibleQuantizations.map((quantization) => (
                            <span
                              key={quantization}
                              className="rounded-[5px] bg-panel2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted"
                            >
                              {quantization}
                            </span>
                          ))}
                          {remaining > 0 ? (
                            <span className="font-mono text-[10.5px] text-faint">
                              +{remaining}
                            </span>
                          ) : null}
                        </span>
                        <span className="col-start-2 row-start-1 self-start whitespace-nowrap font-mono text-[11.5px] text-muted sm:col-auto sm:row-auto sm:self-auto sm:text-left sm:text-[12px]">
                          {releaseDateLabel(entry)}
                        </span>
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          size={17}
                          strokeWidth={1.8}
                          aria-hidden="true"
                          className="hidden text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink sm:block"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="benchmark-pulse-title" className="min-w-0">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 id="benchmark-pulse-title" className="font-display text-[22px] font-semibold">
                Benchmarks
              </h3>
              <p className="font-mono text-[10px] text-faint">
                {benchmarkCoverage.benchmarkCount} tests · {benchmarkCoverage.modelCount} models
              </p>
            </div>
            <SectionLink onClick={onViewBenchmarks}>View all benchmarks</SectionLink>
          </header>

          <div className="mt-3 border-y border-line">
            {showEmptyLoadingState ? (
              <div className="space-y-5 py-5" aria-hidden="true">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="animate-pulse motion-reduce:animate-none">
                    <div className="h-5 w-32 rounded-[4px] bg-panel2" />
                    <div className="mt-3 h-16 rounded-[4px] bg-panel2" />
                  </div>
                ))}
              </div>
            ) : featuredBenchmarks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-display text-[18px] font-semibold">
                  No comparable benchmarks yet
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  Rankings appear after at least two sourced model results match the catalog.
                </p>
              </div>
            ) : (
              featuredBenchmarks.map((benchmark) => {
                const results = benchmark.results.slice(0, 3);
                const sources = [
                  ...new Map(
                    results.map((result) => [
                      result.sourceUrl,
                      { label: result.sourceLabel, url: result.sourceUrl },
                    ]),
                  ).values(),
                ];
                return (
                  <section
                    key={benchmark.id}
                    className="border-b border-linesoft py-4 last:border-b-0"
                  >
                    <header className="flex items-baseline justify-between gap-3">
                      <div>
                        <h4 className="font-display text-[17px] font-semibold">
                          {benchmark.name}
                        </h4>
                        <p className="mt-0.5 font-mono text-[11px] text-faint">
                          {benchmark.metric} · {benchmark.results.length} models · higher is better
                        </p>
                      </div>
                      <HugeiconsIcon
                        icon={ChartColumnIcon}
                        size={17}
                        strokeWidth={1.7}
                        aria-hidden="true"
                        className="flex-none text-faint"
                      />
                    </header>
                    <ol className="mt-3 space-y-2.5">
                      {results.map((result) => {
                        const score = Number.isInteger(result.score)
                          ? result.score.toFixed(0)
                          : result.score.toFixed(1);
                        return (
                          <li key={result.repo}>
                            <button
                              type="button"
                              onClick={() => onOpenModel(result.entry)}
                              aria-label={`Open ${result.modelName ?? result.entry.name}, ranked ${result.rank} with a score of ${score}`}
                              className="group w-full text-left"
                            >
                              <span className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2">
                                <span className="font-mono text-[11px] text-faint">
                                  {result.rank}
                                </span>
                                <span className="truncate text-[12.5px] font-semibold group-hover:underline group-hover:underline-offset-2">
                                  {result.modelName ?? result.entry.name}
                                </span>
                                <span className="font-mono text-[12.5px] font-semibold tabular-nums">
                                  {score}
                                </span>
                              </span>
                              <span className="mt-1.5 ml-7 block h-1.5 overflow-hidden rounded-full bg-track">
                                <span
                                  className="block h-full bg-ink"
                                  style={{
                                    width: `${Math.max(
                                      2,
                                      Math.min(
                                        100,
                                        (result.score / benchmark.maxScore) * 100,
                                      ),
                                    )}%`,
                                  }}
                                />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-faint">
                      <span>Sources:</span>
                      {sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-meta hover:text-ink hover:underline"
                        >
                          {source.label}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ))}
                    </p>
                  </section>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="understand-title">
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-3">
            <h3 id="understand-title" className="font-display text-[22px] font-semibold">
              Learn the system
            </h3>
          <SectionLink onClick={onViewDocs}>All study paths</SectionLink>
        </header>
        <div className="mt-3 grid border-y border-line md:grid-cols-3">
          {featuredDocs.map((article) => (
            <button
              key={article.slug}
              type="button"
              onClick={() => onOpenDoc(article.slug)}
              className="group min-h-32 border-b border-linesoft py-5 text-left last:border-b-0 md:border-r md:border-b-0 md:px-5 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
            >
              <span className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={BookOpen02Icon}
                  size={16}
                  strokeWidth={1.7}
                  aria-hidden="true"
                  className="text-faint"
                />
                <span className="font-display text-[16px] font-semibold group-hover:underline group-hover:underline-offset-4">
                  {article.title}
                </span>
              </span>
              <span className="mt-2 block max-w-[52ch] text-[12.5px] leading-relaxed text-muted">
                {article.summary}
              </span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
