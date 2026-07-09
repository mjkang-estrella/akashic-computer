import { Fragment } from "react";
import {
  BENCHES,
  BENCH_CATEGORIES,
  COMPARE_MODELS,
  HEADLINE_BENCHES,
} from "@/lib/atlas/data";
import { bestRunnable, fitOf } from "@/lib/atlas/fit";
import { activeParamsLabel, uploaderDisplay } from "@/lib/atlas/naming";
import type { BenchCategory, BenchKey, RigProfile } from "@/lib/atlas/types";
import {
  ConfidenceNote,
  DeltaChip,
  PropertyChip,
  ScoreMeter,
  TrustBadge,
} from "./badges";

export type CompareSortKey = BenchKey | "model";
export type CompareCategory = BenchCategory | "all";

export function CompareView({
  rig,
  onlyRunnable,
  category,
  activeBenches,
  sortKey,
  sortDir,
  expanded,
  onCategory,
  onToggleBench,
  onSort,
  onToggleExpand,
}: {
  rig: RigProfile;
  onlyRunnable: boolean;
  category: CompareCategory;
  activeBenches: Set<BenchKey>;
  sortKey: CompareSortKey;
  sortDir: 1 | -1;
  expanded: Set<string>;
  onCategory: (c: CompareCategory) => void;
  onToggleBench: (key: BenchKey) => void;
  onSort: (key: CompareSortKey) => void;
  onToggleExpand: (id: string) => void;
}) {
  // benchmarks offered by the current category; "all" offers one headline per category
  const offered = BENCHES.filter((b) =>
    category === "all"
      ? HEADLINE_BENCHES.includes(b.key)
      : b.category === category,
  );
  const benches = offered.filter((b) => activeBenches.has(b.key));

  let rows = COMPARE_MODELS.map((model) => ({
    model,
    best: bestRunnable(model.artifacts, rig),
  }));
  const total = rows.length;
  if (onlyRunnable) rows = rows.filter((r) => r.best);
  rows.sort((a, b) => {
    if (sortKey === "model") return a.model.name.localeCompare(b.model.name) * sortDir;
    return (a.model.scores[sortKey] - b.model.scores[sortKey]) * sortDir;
  });

  const bestPerBench = new Map<BenchKey, number>();
  for (const b of benches) {
    bestPerBench.set(b.key, Math.max(...rows.map((r) => r.model.scores[b.key])));
  }

  const headerCell =
    "whitespace-nowrap border-b border-line px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em]";

  return (
    <div className="pt-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          Category
        </span>
        {[{ id: "all" as const, label: "Headline" }, ...BENCH_CATEGORIES].map(
          (c) => (
            <button
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => onCategory(c.id)}
              className={`rounded-[7px] border px-3.5 py-1.5 text-[13px] font-semibold ${
                category === c.id
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-panel hover:border-ink"
              }`}
            >
              {c.label}
            </button>
          ),
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          Benchmarks
        </span>
        {offered.map((b) => {
          const active = activeBenches.has(b.key);
          return (
            <button
              key={b.key}
              aria-pressed={active}
              onClick={() => onToggleBench(b.key)}
              className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-panel text-muted hover:border-ink"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-[10px] border border-line bg-panel">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted">
            <b className="mb-1.5 block text-[15px] text-ink">
              Nothing fits {rig.label}
            </b>
            Raise the GB override in the rig bar, pick a bigger preset, or
            untick “Only runnable”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  <th
                    className={`${headerCell} cursor-pointer ${sortKey === "model" ? "text-ink" : "text-muted"}`}
                    onClick={() => onSort("model")}
                  >
                    Model {sortKey === "model" ? (sortDir === -1 ? "▾" : "▴") : ""}
                  </th>
                  {benches.map((b) => (
                    <th
                      key={b.key}
                      aria-sort={sortKey === b.key ? "descending" : undefined}
                      className={`${headerCell} cursor-pointer ${sortKey === b.key ? "text-ink" : "text-muted"}`}
                      onClick={() => onSort(b.key)}
                    >
                      {b.label}{" "}
                      {sortKey === b.key ? (sortDir === -1 ? "▾" : "▴") : ""}
                    </th>
                  ))}
                  <th className={`${headerCell} font-semibold text-faint`}>
                    On my rig
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ model, best }) => {
                  const isExpanded = expanded.has(model.id);
                  return (
                    <Fragment key={model.id}>
                      <tr
                        className="cursor-pointer border-b border-linesoft hover:bg-panel2/45"
                        onClick={() => onToggleExpand(model.id)}
                      >
                        <td className="px-2.5 py-2.5 align-top">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] text-faint">
                              {isExpanded ? "▾" : "▸"}
                            </span>
                            <span className="font-display text-[15px] font-semibold">
                              {model.name}
                            </span>
                            <PropertyChip>{model.variant}</PropertyChip>
                            {activeParamsLabel(model.size.label) && (
                              <PropertyChip>
                                {activeParamsLabel(model.size.label)}
                              </PropertyChip>
                            )}
                          </span>
                          <div className="mt-0.5 pl-4 text-[11.5px] text-muted">
                            {model.family.vendor} · {model.release.license} ·{" "}
                            {model.release.ctx} ctx
                          </div>
                        </td>
                        {benches.map((b) => (
                          <td key={b.key} className="px-2.5 py-2.5 align-top">
                            <ScoreMeter
                              value={model.scores[b.key]}
                              best={model.scores[b.key] === bestPerBench.get(b.key)}
                            />
                          </td>
                        ))}
                        <td className="px-2.5 py-2.5 align-top">
                          {best ? (
                            <span
                              className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-muted"
                              title={best.fit.text}
                            >
                              <span
                                className={`h-[7px] w-[7px] flex-none rounded-full ${
                                  best.fit.level === "runs"
                                    ? "bg-verify"
                                    : "bg-caution"
                                }`}
                              />
                              {best.artifact.format} · {best.artifact.recVramGb} GB
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-faint">
                              <span className="h-[7px] w-[7px] flex-none rounded-full bg-alert" />
                              nothing fits
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded &&
                        model.artifacts.map((a) => {
                          const fit = fitOf(a, rig);
                          if (onlyRunnable && fit.level === "no") return null;
                          return (
                            <tr
                              key={a.repo}
                              className="border-b border-linesoft bg-panel2/55"
                            >
                              <td className="px-2.5 py-1.5 pl-7">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-[12.5px] font-bold">
                                    {a.format}
                                  </span>
                                  <PropertyChip tone="meta">
                                    {uploaderDisplay(a.repo)}
                                  </PropertyChip>
                                  <TrustBadge trust={a.trust} />
                                  <ConfidenceNote confidence={a.confidence} />
                                </span>
                                <span className="mt-0.5 block break-all font-mono text-[11px] text-faint">
                                  {a.repo}
                                </span>
                              </td>
                              {benches.map((b) => (
                                <td key={b.key} className="px-2.5 py-1.5 align-top">
                                  <DeltaChip
                                    delta={a.deltas[b.key]}
                                    measured={a.measured}
                                  />
                                </td>
                              ))}
                              <td className="px-2.5 py-1.5 align-top">
                                <span
                                  className={`inline-flex items-center gap-1.5 font-mono text-[11.5px] ${
                                    fit.level === "no" ? "text-faint" : "text-muted"
                                  }`}
                                  title={fit.text}
                                >
                                  <span
                                    className={`h-[7px] w-[7px] flex-none rounded-full ${
                                      fit.level === "runs"
                                        ? "bg-verify"
                                        : fit.level === "tight"
                                          ? "bg-caution"
                                          : "bg-alert"
                                    }`}
                                  />
                                  {a.minVramGb}–{a.recVramGb} GB
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-2.5 text-xs text-faint">
        Scores are the model&apos;s reference (BF16) numbers with per-source
        provenance. Expand a row for quantized artifacts and their deltas — Δ
        marked * is estimated, not measured. Click a column to sort.
        {onlyRunnable
          ? ` Showing ${rows.length} of ${total} models that fit ${rig.label}.`
          : ""}
      </p>
    </div>
  );
}
