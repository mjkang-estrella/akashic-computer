"use client";

import { useId, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import {
  BENCHMARK_CATEGORIES,
  resolveOfficialBenchmarks,
  type BenchmarkCategoryId,
} from "@/lib/atlas/benchmarks";
import type { ModelEntry } from "@/lib/atlas/models";
import { parameterCountLabel } from "@/lib/atlas/naming";
import { FamilyLogo } from "./FamilyLogo";

type CategoryFilter = BenchmarkCategoryId | "all";

export function BenchmarkView({
  entries,
  query,
  onOpen,
}: {
  entries: ModelEntry[];
  query: string;
  onOpen: (entry: ModelEntry) => void;
}) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const benchmarks = useMemo(() => resolveOfficialBenchmarks(entries), [entries]);
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = benchmarks.flatMap((benchmark) => {
    if (category !== "all" && benchmark.category !== category) return [];
    if (!normalizedQuery) return [benchmark];

    const benchmarkMatches = [benchmark.name, benchmark.description, benchmark.metric]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
    const results = benchmarkMatches
      ? benchmark.results
      : benchmark.results.filter((result) =>
          [
            result.modelName ?? result.entry.name,
            result.entry.family.name,
            result.entry.family.vendor,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        );
    return results.length > 0 ? [{ ...benchmark, results }] : [];
  });

  const resultCount = benchmarks.reduce((total, benchmark) => total + benchmark.results.length, 0);
  const categoryCounts = new Map(
    BENCHMARK_CATEGORIES.map(({ id }) => [
      id,
      benchmarks.filter((benchmark) => benchmark.category === id).length,
    ]),
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pt-5 lg:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="min-w-0 self-start lg:sticky lg:top-4" aria-label="Benchmark categories">
        <p className="font-display text-[19px] font-semibold">Benchmarks</p>
        <p className="mt-1 max-w-[30ch] text-[12.5px] leading-relaxed text-muted">
          Official scores published by model creators.
        </p>
        <nav className="mt-4 flex flex-wrap gap-1.5 pb-1 lg:block" aria-label="Filter benchmarks">
          <CategoryButton
            label="All benchmarks"
            count={benchmarks.length}
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {BENCHMARK_CATEGORIES.map((item) => (
            <CategoryButton
              key={item.id}
              label={item.label}
              count={categoryCounts.get(item.id) ?? 0}
              active={category === item.id}
              onClick={() => setCategory(item.id)}
            />
          ))}
        </nav>
      </aside>

      <div id="benchmark-results" className="min-w-0">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <div>
            <h1 className="font-display text-[25px] font-semibold">Open model leaderboards</h1>
            <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-muted">
              Models are ranked from higher to lower within the exact benchmark version shown.
            </p>
          </div>
          <span className="font-mono text-[11.5px] text-faint">
            {benchmarks.length} benchmarks · {resultCount} sourced results
          </span>
        </header>

        <div className="border-b border-line bg-panel2/45 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
          Creator-reported results are not normalized retests. Prompts, reasoning effort, agent scaffolds,
          and sampling can differ; use the linked report before treating small score gaps as meaningful.
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <h2 className="font-display text-[18px] font-semibold">No matching benchmark results</h2>
            <p className="mt-1 text-[13px] text-muted">
              Search by benchmark, model, family, or company.
            </p>
          </div>
        ) : (
          <div className="grid xl:grid-cols-2 xl:gap-x-6">
            {filtered.map((benchmark) => (
              <section
                key={benchmark.id}
                id={`benchmark-${benchmark.id}`}
                className="min-w-0 scroll-mt-4 border-b border-line py-6 xl:[&:nth-child(odd)]:border-r xl:[&:nth-child(odd)]:pr-6"
              >
                <header className="min-h-[118px]">
                  <div>
                    <span className="font-mono text-[11px] font-semibold uppercase text-faint">
                      {BENCHMARK_CATEGORIES.find((item) => item.id === benchmark.category)?.label}
                    </span>
                    <h2 className="mt-0.5 font-display text-[21px] font-semibold">{benchmark.name}</h2>
                    <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-muted">
                      {benchmark.description}
                    </p>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[11px]">
                    <dt className="text-faint">Metric</dt>
                    <dd className="break-words font-mono font-semibold">{benchmark.metric}</dd>
                    <dt className="text-faint">Protocol</dt>
                    <dd className="break-words text-muted" title={benchmark.protocol}>{benchmark.protocol}</dd>
                  </dl>
                </header>

                <BenchmarkBarChart benchmark={benchmark} onOpen={onOpen} />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BenchmarkBarChart({
  benchmark,
  onOpen,
}: {
  benchmark: ReturnType<typeof resolveOfficialBenchmarks>[number];
  onOpen: (entry: ModelEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const results = expanded ? benchmark.results : benchmark.results.slice(0, 8);

  return (
    <div className="mt-4 border-y border-line">
      <ol id={listId} aria-label={`${benchmark.name} ranked results`} className="divide-y divide-linesoft">
        {results.map((result) => {
          const displayName = result.modelName ?? result.entry.name;
          const score = Number.isInteger(result.score) ? result.score.toFixed(0) : result.score.toFixed(1);
          return (
            <li key={result.repo} value={result.rank} className="grid min-w-0 grid-cols-[2ch_20px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-3 text-[12px]">
              <span aria-hidden="true" className="self-start font-mono tabular-nums text-muted">{result.rank}</span>
              <FamilyLogo familyId={result.entry.family.id} familyName={result.entry.family.name} size={20} />
              <button
                type="button"
                onClick={() => onOpen(result.entry)}
                className="min-w-0 break-words text-left font-semibold hover:underline hover:underline-offset-2"
                aria-label={`Open ${displayName}, ranked ${result.rank} with a score of ${score}`}
              >
                {displayName}
              </button>
              <a href={result.sourceUrl} target="_blank" rel="noreferrer"
                aria-label={`Open ${result.sourceLabel} for ${displayName}`}
                className="flex min-h-8 min-w-8 items-center justify-center text-muted hover:text-ink">
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={1.8} aria-hidden="true" />
              </a>
              <div aria-hidden="true" className="col-start-3 flex items-center gap-3">
                <span className="h-2 flex-1 bg-panel2">
                  <span className="block h-full bg-ink/75" style={{ width: `${Math.max(0, Math.min(100, result.score / benchmark.maxScore * 100))}%` }} />
                </span>
                <span className="font-mono text-[13px] font-medium tabular-nums">{score}</span>
              </div>
              <p className="col-start-3 col-end-5 break-words text-[11px] leading-relaxed text-muted">
                {parameterCountLabel(result.entry.size)} · {result.sourceLabel}{result.note ? ` · ${result.note}` : ""}
                <span className="sr-only"> · {score} {benchmark.metric}</span>
              </p>
            </li>
          );
        })}
      </ol>
      {benchmark.results.length > 8 ? (
        <button type="button" aria-expanded={expanded} aria-controls={listId}
          onClick={() => setExpanded(!expanded)} className="my-2 min-h-9 rounded-[7px] border border-line px-3 text-[12px] font-semibold hover:border-ink">
          {expanded ? "Show top 8" : `Show all ${benchmark.results.length}`}
        </button>
      ) : null}
    </div>
  );
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-w-max items-center justify-between gap-5 rounded-[7px] px-2.5 py-2 text-left text-[12.5px] font-semibold transition-colors lg:mb-0.5 lg:w-full ${
        active ? "bg-ink text-paper" : "text-muted hover:bg-panel hover:text-ink"
      }`}
    >
      <span>{label}</span>
      <span className={`font-mono text-[11px] ${active ? "text-paper/65" : "text-faint"}`}>{count}</span>
    </button>
  );
}
