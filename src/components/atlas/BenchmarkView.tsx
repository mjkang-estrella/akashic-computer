"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
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
        <h2 className="font-display text-[19px] font-semibold">Benchmarks</h2>
        <p className="mt-1 max-w-[30ch] text-[12.5px] leading-relaxed text-muted">
          Official scores published by model creators.
        </p>
        <nav className="mt-4 flex gap-1.5 overflow-x-auto pb-1 lg:block" aria-label="Filter benchmarks">
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
            <h2 className="font-display text-[25px] font-semibold">Open model leaderboards</h2>
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
            <h3 className="font-display text-[18px] font-semibold">No matching benchmark results</h3>
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
                    <span className="font-mono text-[10.5px] font-semibold uppercase text-faint">
                      {BENCHMARK_CATEGORIES.find((item) => item.id === benchmark.category)?.label}
                    </span>
                    <h3 className="mt-0.5 font-display text-[21px] font-semibold">{benchmark.name}</h3>
                    <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-muted">
                      {benchmark.description}
                    </p>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[11px]">
                    <dt className="text-faint">Metric</dt>
                    <dd className="truncate font-mono font-semibold">{benchmark.metric}</dd>
                    <dt className="text-faint">Protocol</dt>
                    <dd className="truncate text-muted" title={benchmark.protocol}>{benchmark.protocol}</dd>
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

const BAR_COLORS: Record<string, string> = {
  qwen: "#7667db",
  deepseek: "#2b62d6",
  llama: "#4d8052",
  "gpt-oss": "#252525",
  glm: "#202020",
  minimax: "#e83973",
  kimi: "#1687df",
};

function BenchmarkBarChart({
  benchmark,
  onOpen,
}: {
  benchmark: ReturnType<typeof resolveOfficialBenchmarks>[number];
  onOpen: (entry: ModelEntry) => void;
}) {
  const chartWidth = Math.max(420, benchmark.results.length * 58);

  return (
    <div
      className="mt-4 overflow-x-auto border-y border-line"
      tabIndex={0}
      aria-label={`${benchmark.name} ranking chart; scroll horizontally for more models`}
    >
      <div className="relative h-[292px] w-full pt-5" style={{ minWidth: chartWidth }}>
        <div className="pointer-events-none absolute inset-x-0 top-5 h-[200px]" aria-hidden="true">
          {[100, 75, 50, 25, 0].map((tick) => (
            <span
              key={tick}
              className="absolute inset-x-0 border-t border-linesoft"
              style={{ top: `${100 - tick}%` }}
            >
              <span className="absolute -top-2.5 left-0 bg-paper pr-1 font-mono text-[9px] text-faint">
                {tick}
              </span>
            </span>
          ))}
        </div>

        <ol
          className="relative ml-7 grid h-[272px] items-end gap-1"
          style={{ gridTemplateColumns: `repeat(${benchmark.results.length}, minmax(50px, 1fr))` }}
        >
          {benchmark.results.map((result) => {
            const displayName = result.modelName ?? result.entry.name;
            const barHeight = Math.max(
              2,
              Math.min(100, (result.score / benchmark.maxScore) * 100),
            );
            const score = Number.isInteger(result.score)
              ? result.score.toFixed(0)
              : result.score.toFixed(1);

            return (
              <li key={result.repo} className="grid h-full min-w-0 grid-rows-[200px_72px]">
                <div className="flex min-h-0 items-end justify-center px-1">
                  <button
                    type="button"
                    onClick={() => onOpen(result.entry)}
                    className="group relative w-full max-w-[46px] opacity-90 transition-opacity hover:opacity-100"
                    style={{
                      height: `${barHeight}%`,
                      backgroundColor: BAR_COLORS[result.entry.family.id] ?? "#5f6d66",
                    }}
                    title={`${displayName}: ${score} ${benchmark.metric}`}
                    aria-label={`Open ${displayName}, ranked ${result.rank} with a score of ${score}`}
                  >
                    <span className="absolute inset-x-0 -top-5 text-center font-mono text-[10.5px] font-semibold tabular-nums text-ink">
                      {score}
                    </span>
                  </button>
                </div>
                <div className="flex min-w-0 flex-col items-center border-t border-line px-1 pt-2 text-center">
                  <span className="flex items-center gap-1 text-[9.5px] text-faint">
                    <span className="font-mono">#{result.rank}</span>
                    <FamilyLogo
                      familyId={result.entry.family.id}
                      familyName={result.entry.family.name}
                      size={15}
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpen(result.entry)}
                    title={`${displayName} · ${parameterCountLabel(result.entry.size)}`}
                    className="mt-1 line-clamp-2 min-h-7 w-full text-[10.5px] font-semibold leading-[1.25] hover:underline hover:underline-offset-2"
                  >
                    {displayName}
                  </button>
                  <a
                    href={result.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={`${result.sourceLabel}${result.note ? ` · ${result.note}` : ""}`}
                    aria-label={`Open ${result.sourceLabel} for ${displayName}`}
                    className="mt-auto flex h-4 w-4 items-center justify-center text-faint hover:text-ink"
                  >
                    <ArrowUpRight size={10} aria-hidden="true" />
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
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
      <span className={`font-mono text-[10.5px] ${active ? "text-paper/65" : "text-faint"}`}>{count}</span>
    </button>
  );
}
