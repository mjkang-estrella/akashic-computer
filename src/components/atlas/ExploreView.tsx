import { Fragment, type ReactNode } from "react";
import { BENCHES, FAMILIES } from "@/lib/atlas/data";
import { artifactsFor, fitOf } from "@/lib/atlas/fit";
import { activeParamsLabel, sizeDisplay, uploaderDisplay } from "@/lib/atlas/naming";
import type { BenchKey, RigProfile } from "@/lib/atlas/types";
import {
  ConfidenceNote,
  DeltaChip,
  FitBadge,
  PropertyChip,
  TrustBadge,
} from "./badges";

const SECTION_LABEL =
  "text-[11px] font-bold uppercase tracking-[0.12em] text-muted";

function FamilyRail({
  query,
  familyId,
  onFamily,
  onClearQuery,
}: {
  query: string;
  familyId: string;
  onFamily: (id: string) => void;
  onClearQuery: () => void;
}) {
  const q = query.trim().toLowerCase();
  const families = FAMILIES.filter(
    (f) =>
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.vendor.toLowerCase().includes(q) ||
      f.tags.includes(q),
  );
  return (
    <aside>
      <h2 className={`mb-2.5 ${SECTION_LABEL}`}>Families</h2>
      {families.length === 0 ? (
        <div className="px-1 py-3 text-[13px] text-muted">
          <b className="mb-1 block text-ink">
            No family matches “{query.trim()}”
          </b>
          Try a vendor (Alibaba, Meta) or a tag (coding, MoE).
          <div className="mt-2">
            <button
              onClick={onClearQuery}
              className="rounded-full border border-line bg-panel px-3 py-1 text-[12.5px] font-semibold text-muted hover:border-ink"
            >
              Clear search
            </button>
          </div>
        </div>
      ) : (
        families.map((f) => (
          <button
            key={f.id}
            aria-current={f.id === familyId}
            onClick={() => onFamily(f.id)}
            className={`mb-1 block w-full rounded-lg border px-2.5 py-2 text-left ${
              f.id === familyId
                ? "border-ink bg-panel"
                : "border-transparent hover:border-line hover:bg-panel"
            }`}
          >
            <span className="block font-display text-[15px] font-semibold">
              {f.name}
            </span>
            <span className="mt-px block text-xs text-muted">
              {f.vendor} · {f.tags}
            </span>
          </button>
        ))
      )}
    </aside>
  );
}

export function ExploreView({
  query,
  familyId,
  releaseId,
  sizeLabel,
  variant,
  rig,
  onlyRunnable,
  checked,
  artifactBench,
  capacityControls,
  onFamily,
  onRelease,
  onSize,
  onVariant,
  onCheck,
  onArtifactBench,
  onClearQuery,
}: {
  query: string;
  familyId: string;
  releaseId: string;
  sizeLabel: string;
  variant: string;
  rig: RigProfile;
  onlyRunnable: boolean;
  checked: Set<string>;
  artifactBench: BenchKey;
  capacityControls: ReactNode;
  onFamily: (id: string) => void;
  onRelease: (id: string) => void;
  onSize: (label: string) => void;
  onVariant: (v: string) => void;
  onCheck: (repo: string, on: boolean) => void;
  onArtifactBench: (bench: BenchKey) => void;
  onClearQuery: () => void;
}) {
  const family = FAMILIES.find((f) => f.id === familyId) ?? FAMILIES[0];
  const release =
    family.releases.find((r) => r.id === releaseId) ?? family.releases[0];
  const size =
    release.sizes.find((s) => s.label === sizeLabel) ?? release.sizes[0];
  const activeVariant = size.variants.includes(variant)
    ? variant
    : size.variants[0];
  const artifacts = artifactsFor(family, release, size, activeVariant);
  const scores = size.scores?.[activeVariant];
  const selectedBench = BENCHES.find((bench) => bench.key === artifactBench) ?? BENCHES[0];
  const visibleArtifacts = artifacts.filter(
    (a) => !onlyRunnable || fitOf(a, rig).level !== "no",
  );

  const segButton = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-[7px] border px-3 py-1.5 text-[13px] font-semibold ${
      active
        ? "border-ink bg-ink text-paper"
        : "border-line bg-paper hover:border-ink"
    }`;

  return (
    <div className="grid gap-4 pt-4 md:grid-cols-[248px_minmax(0,1fr)]">
      <FamilyRail
        query={query}
        familyId={family.id}
        onFamily={onFamily}
        onClearQuery={onClearQuery}
      />

      <section>
        <div className="rounded-[10px] border border-line bg-panel px-4 py-3.5">
          <nav
            aria-label="Model lineage"
            className="flex flex-wrap items-center gap-y-2.5"
          >
            {[
              { stage: "Family", value: family.name },
              { stage: "Release", value: release.name },
              { stage: "Size", value: sizeDisplay(size.label) },
              { stage: "Variant", value: activeVariant },
            ].map((node, i, all) => {
              const leaf = i === all.length - 1;
              return (
                <Fragment key={node.stage}>
                  {i > 0 && (
                    <span
                      key={`${node.stage}-${node.value}`}
                      aria-hidden="true"
                      className="constellation-line mx-3 h-px w-9 flex-none bg-ink/45"
                    />
                  )}
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`flex-none rounded-full bg-ink ${
                        leaf
                          ? "h-[9px] w-[9px] shadow-[0_0_0_3px_var(--line-soft)]"
                          : "h-[7px] w-[7px]"
                      }`}
                    />
                    <span className="flex flex-col">
                      <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-faint">
                        {node.stage}
                      </span>
                      <span className="font-display text-[15px] font-semibold leading-tight">
                        {node.value}
                      </span>
                    </span>
                  </span>
                </Fragment>
              );
            })}
          </nav>

          <div className="relative mt-4 flex flex-col gap-4 pl-4">
            <span
              aria-hidden="true"
              className="absolute bottom-4 left-[3.5px] top-1.5 w-px bg-line"
            />
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-4 top-[3px] h-2 w-2 rounded-full border-2 border-line bg-panel"
              />
              <p className={`mb-1.5 ${SECTION_LABEL}`}>Release</p>
            <div className="flex flex-wrap gap-1.5">
              {family.releases.map((r) => (
                <button
                  key={r.id}
                  aria-pressed={r.id === release.id}
                  onClick={() => onRelease(r.id)}
                  className={segButton(r.id === release.id)}
                >
                  {r.name}
                  <span
                    className={`text-[11.5px] font-normal ${
                      r.id === release.id ? "text-paper/70" : "text-faint"
                    }`}
                  >
                    {r.date}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-3.5 text-[12.5px] text-muted">
              <span>
                context <b className="font-mono font-semibold text-ink">{release.ctx}</b>
              </span>
              <span>
                license{" "}
                <b className="font-mono font-semibold text-ink">{release.license}</b>
              </span>
              <span>
                released{" "}
                <b className="font-mono font-semibold text-ink">{release.date}</b>
              </span>
            </div>
          </div>

            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-4 top-[3px] h-2 w-2 rounded-full border-2 border-line bg-panel"
              />
              <p className={`mb-1.5 ${SECTION_LABEL}`}>Size</p>
            <div className="flex flex-wrap gap-1.5">
              {release.sizes.map((s) => (
                <button
                  key={s.label}
                  aria-pressed={s.label === size.label}
                  onClick={() => onSize(s.label)}
                  className={segButton(s.label === size.label)}
                >
                  {sizeDisplay(s.label)}
                  {activeParamsLabel(s.label) && (
                    <span
                      className={`text-[11px] font-normal ${
                        s.label === size.label ? "text-paper/70" : "text-faint"
                      }`}
                    >
                      {activeParamsLabel(s.label)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-4 top-[3px] h-2 w-2 rounded-full border-2 border-line bg-panel"
              />
              <p className={`mb-1.5 ${SECTION_LABEL}`}>Variant</p>
              <div className="flex flex-wrap gap-1.5">
                {size.variants.map((v) => (
                  <button
                    key={v}
                    aria-pressed={v === activeVariant}
                    onClick={() => onVariant(v)}
                    className={segButton(v === activeVariant)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3.5">{capacityControls}</div>

        <div className="mt-3.5">
          <div className="rounded-[10px] border border-line bg-panel px-4 py-3.5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2.5">
              <h2 className={SECTION_LABEL}>
                {release.name} {sizeDisplay(size.label)} {activeVariant}: artifacts
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-faint">
                  Select 2+ to compare artifacts
                </span>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  Delta benchmark
                  <select
                    value={artifactBench}
                    onChange={(event) => onArtifactBench(event.target.value as BenchKey)}
                    className="rounded-md border border-line bg-paper px-2 py-1 text-[12.5px] text-ink"
                  >
                    {BENCHES.map((bench) => (
                      <option key={bench.key} value={bench.key}>
                        {bench.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    {["", "Artifact", "Runtimes", "VRAM", "Fit", `${selectedBench.label} Δ`].map(
                      (h, i) => (
                        <th
                          key={i}
                          className="whitespace-nowrap border-b border-line px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleArtifacts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2.5 py-6 text-center text-muted"
                      >
                        Nothing here fits {rig.label}. Untick “Only runnable” to
                        see what it would take.
                      </td>
                    </tr>
                  ) : (
                    visibleArtifacts.map((a) => {
                      const fit = fitOf(a, rig);
                      return (
                        <tr
                          key={a.repo}
                          className="border-b border-linesoft last:border-b-0"
                        >
                          <td className="px-2.5 py-2.5 align-top">
                            <input
                              type="checkbox"
                              checked={checked.has(a.repo)}
                              onChange={(e) => onCheck(a.repo, e.target.checked)}
                              aria-label={`Compare ${a.repo}`}
                            />
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[13px] font-bold">
                                {a.format}
                              </span>
                              <PropertyChip tone="meta">
                                {uploaderDisplay(a.repo)}
                              </PropertyChip>
                              <TrustBadge trust={a.trust} />
                              <ConfidenceNote confidence={a.confidence} />
                            </span>
                            <span className="mt-1 block break-all font-mono text-[11px] text-faint">
                              {a.repo}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <span className="flex flex-wrap gap-1">
                              {a.runtimes.map((rt) => (
                                <span
                                  key={rt}
                                  className="rounded bg-panel2 px-1.5 py-px font-mono text-[11.5px] text-muted"
                                >
                                  {rt}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2.5 align-top font-mono text-[13px] tabular-nums">
                            {a.minVramGb}–{a.recVramGb} GB
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <FitBadge fit={fit} />
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <DeltaChip
                              delta={a.deltas[artifactBench]}
                              measured={a.measured}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="mt-3.5 rounded-[10px] border border-line bg-panel px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h2 className={SECTION_LABEL}>Reference benchmarks</h2>
              <span className="text-[11.5px] text-faint">Higher is better</span>
            </div>
            {scores ? (
              <div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
                {BENCHES.map((b) => (
                  <div
                    key={b.key}
                    className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2 border-b border-linesoft py-1.5"
                  >
                    <span className="text-[13px]">{b.label}</span>
                    <span className="font-mono text-[13px] font-semibold tabular-nums">
                      {scores[b.key].toFixed(1)}
                    </span>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      title="Provenance link (mock)"
                      className="text-[11.5px] text-meta underline-offset-2 hover:underline"
                    >
                      {b.source}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-2 text-[12.5px] text-muted">
                No measured benchmarks for {release.name} {sizeDisplay(size.label)}{" "}
                {activeVariant} yet. Scores are never inferred; only sourced.
              </p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
