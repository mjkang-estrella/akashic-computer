"use client";

import { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  BookOpen02Icon,
  ChartColumnIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { resolveOfficialBenchmarks } from "@/lib/atlas/benchmarks";
import { DOC_ARTICLES } from "@/lib/atlas/docsArticles";
import type { ModelEntry } from "@/lib/atlas/models";
import { modelReleaseName, parameterCountLabel } from "@/lib/atlas/naming";
import { FamilyLogo } from "./FamilyLogo";

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

interface CatalogHealth {
  catalogStale: boolean;
}

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
  source,
  health,
}: {
  syncedAt: number | null;
  loading: boolean;
  source: "convex" | "snapshot";
  health: CatalogHealth | null;
}) {
  const delayed = health?.catalogStale;

  let label = "Bundled catalog snapshot";
  if (loading) label = "Refreshing the live catalog";
  else if (source === "convex" && syncedAt) {
    label = `${delayed ? "Refresh delayed" : "Catalog synced"} · ${formatSyncTime(syncedAt)}`;
  } else if (source === "convex") {
    label = "Live catalog connected";
  }

  return (
    <p
      aria-live="polite"
      className={`flex items-center gap-2 font-mono text-[11px] lg:min-h-11 ${
        delayed ? "text-caution" : "text-faint"
      }`}
    >
      <HugeiconsIcon
        icon={RefreshIcon}
        size={15}
        strokeWidth={1.8}
        aria-hidden="true"
        className={loading ? "animate-spin motion-reduce:animate-none" : ""}
      />
      {label}
    </p>
  );
}

function CatalogField({ entries }: { entries: ModelEntry[] }) {
  const bars = useMemo(() => {
    const recent = [...entries]
      .sort((a, b) => b.timestamp - a.timestamp || b.size.paramsB - a.size.paramsB)
      .slice(0, 28);
    const maximum = Math.max(1, ...recent.map((entry) => entry.size.paramsB));
    return recent.map((entry) => {
      const normalized = Math.log10(entry.size.paramsB + 1) / Math.log10(maximum + 1);
      const quantizations = new Set(entry.quantizations);
      const tone = quantizations.has("NVFP4")
        ? "bg-meta"
        : quantizations.has("FP8")
          ? "bg-verify"
          : quantizations.has("INT4") || quantizations.has("Native INT4")
            ? "bg-caution"
            : "bg-ink";
      return {
        id: entry.id,
        height: 24 + normalized * 76,
        tone,
      };
    });
  }, [entries]);
  const familyCount = useMemo(
    () => new Set(entries.map((entry) => entry.family.id)).size,
    [entries],
  );
  const formatCount = useMemo(
    () => new Set(entries.flatMap((entry) => entry.quantizations)).size,
    [entries],
  );

  return (
    <figure
      aria-label={`${entries.length} model sizes across ${familyCount} families and ${formatCount} weight formats`}
      className="relative min-h-[248px] overflow-hidden border-y border-line py-5 lg:min-h-[296px] lg:border-y-0 lg:border-r lg:pr-10"
    >
      <figcaption className="sr-only">
        Recent catalog entries shown by parameter scale. Bar colors indicate
        available weight formats.
      </figcaption>
      <div className="pointer-events-none absolute inset-x-0 top-5 bottom-[58px] flex flex-col justify-between lg:right-10">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="block border-t border-linesoft" />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="relative flex h-[166px] items-end gap-1.5 lg:h-[212px]"
      >
        {bars.map((bar, index) => (
          <span
            key={bar.id}
            className={`catalog-field-bar min-w-1 flex-1 rounded-t-[2px] ${bar.tone}`}
            style={{
              height: `${bar.height}%`,
              animationDelay: `${index * 110}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 border-t border-line pt-3">
        <span>
          <strong className="block font-mono text-[13px] font-semibold">
            {entries.length}
          </strong>
          <span className="mt-0.5 block text-[10.5px] text-muted">model sizes</span>
        </span>
        <span className="border-l border-linesoft pl-4">
          <strong className="block font-mono text-[13px] font-semibold">
            {familyCount}
          </strong>
          <span className="mt-0.5 block text-[10.5px] text-muted">families</span>
        </span>
        <span className="border-l border-linesoft pl-4">
          <strong className="block font-mono text-[13px] font-semibold">
            {formatCount}
          </strong>
          <span className="mt-0.5 block text-[10.5px] text-muted">weight formats</span>
        </span>
      </div>
    </figure>
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
  syncedAt,
  loading,
  source,
  health,
  onOpenModel,
  onViewModels,
  onViewBenchmarks,
  onOpenDoc,
  onViewDocs,
}: {
  entries: ModelEntry[];
  syncedAt: number | null;
  loading: boolean;
  source: "convex" | "snapshot";
  health: CatalogHealth | null;
  onOpenModel: (entry: ModelEntry) => void;
  onViewModels: () => void;
  onViewBenchmarks: () => void;
  onOpenDoc: (slug: string) => void;
  onViewDocs: () => void;
}) {
  const showEmptyLoadingState = loading && entries.length === 0;
  const recentEntries = useMemo(
    () =>
      [...entries]
        .sort(
          (a, b) =>
            b.timestamp - a.timestamp ||
            a.name.localeCompare(b.name) ||
            b.size.paramsB - a.size.paramsB,
        )
        .slice(0, 6),
    [entries],
  );
  const featuredBenchmarks = useMemo(() => {
    const resolved = resolveOfficialBenchmarks(entries);
    const preferred = FEATURED_BENCHMARK_IDS.flatMap((id) => {
      const benchmark = resolved.find((candidate) => candidate.id === id);
      return benchmark && benchmark.results.length >= 2 ? [benchmark] : [];
    });
    if (preferred.length === FEATURED_BENCHMARK_IDS.length) return preferred;
    return preferred.concat(
      resolved
        .filter(
          (benchmark) =>
            benchmark.results.length >= 2 &&
            !preferred.some((candidate) => candidate.id === benchmark.id),
        )
        .slice(0, FEATURED_BENCHMARK_IDS.length - preferred.length),
    );
  }, [entries]);
  const featuredDocs = FEATURED_DOC_SLUGS.flatMap((slug) => {
    const article = DOC_ARTICLES.find((candidate) => candidate.slug === slug);
    return article ? [article] : [];
  });

  return (
    <section className="pb-10 pt-6 sm:pt-8">
      <header className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12">
        <div className="order-2 lg:order-1">
          <CatalogField entries={entries} />
        </div>
        <div className="order-1 lg:order-2 lg:pl-2">
          <h2 className="max-w-[18ch] text-balance font-display text-[36px] font-semibold leading-[1.08] sm:text-[44px] lg:text-[52px]">
            Open-weight models, organized.
          </h2>
          <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-muted">
            Browse current releases, quantized artifacts, VRAM estimates, and
            creator-reported benchmark evidence without collapsing technical
            tradeoffs into a single recommendation.
          </p>
          <div className="mt-4">
            <CatalogStatus
              syncedAt={syncedAt}
              loading={loading}
              source={source}
              health={health}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-8 pt-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)] xl:gap-12">
        <section aria-labelledby="recent-models-title" className="min-w-0">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="recent-models-title" className="font-display text-[22px] font-semibold">
                Recently updated
              </h3>
              <p className="mt-0.5 text-[12px] text-muted">
                Model-size releases ordered by their latest material update.
              </p>
            </div>
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
                  <span>Last updated</span>
                  <span className="sr-only">Open</span>
                </div>
                <div className="divide-y divide-linesoft">
                  {recentEntries.map((entry) => {
                    const visibleQuantizations = entry.quantizations.slice(0, 3);
                    const remaining =
                      entry.quantizations.length - visibleQuantizations.length;
                    return (
                      <button
                        key={entry.id}
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
                        <span className="col-start-2 row-start-1 self-start whitespace-nowrap font-mono text-[11.5px] text-muted sm:col-auto sm:row-auto sm:self-auto sm:text-[12px]">
                          {entry.dateLabel}
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
            <div>
              <h3 id="benchmark-pulse-title" className="font-display text-[22px] font-semibold">
                Benchmark pulse
              </h3>
              <p className="mt-0.5 text-[12px] text-muted">
                Official scores reported by model creators.
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
                          {benchmark.metric} · higher is better
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
          <div>
            <h3 id="understand-title" className="font-display text-[22px] font-semibold">
              Understand the catalog
            </h3>
            <p className="mt-0.5 text-[12px] text-muted">
              Build the vocabulary needed to evaluate local-model options.
            </p>
          </div>
          <SectionLink onClick={onViewDocs}>Read the docs</SectionLink>
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
              <span className="mt-3 block font-mono text-[10.5px] text-faint">
                {article.readMinutes} min read
              </span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
