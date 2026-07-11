import { useState, type ReactNode } from "react";
import { BENCHES, FAMILIES } from "@/lib/atlas/data";
import { artifactsFor, fitOf } from "@/lib/atlas/fit";
import { activeParamsLabel, sizeDisplay, uploaderDisplay } from "@/lib/atlas/naming";
import type {
  Artifact,
  BenchKey,
  Family,
  Release,
  RigProfile,
  SizeNode,
} from "@/lib/atlas/types";
import {
  ConfidenceNote,
  DeltaChip,
  FitBadge,
  PropertyChip,
  TrustBadge,
} from "./badges";

const SECTION_LABEL =
  "text-[11px] font-bold uppercase tracking-[0.12em] text-muted";

interface ArtifactResult {
  release: Release;
  size: SizeNode;
  variant: string;
  artifact: Artifact;
}

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
  const normalizedQuery = query.trim().toLowerCase();
  const families = FAMILIES.filter(
    (family) =>
      !normalizedQuery ||
      family.name.toLowerCase().includes(normalizedQuery) ||
      family.vendor.toLowerCase().includes(normalizedQuery) ||
      family.tags.includes(normalizedQuery),
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
        families.map((family) => (
          <button
            key={family.id}
            aria-current={family.id === familyId}
            onClick={() => onFamily(family.id)}
            className={`mb-1 block w-full rounded-lg border px-2.5 py-2 text-left ${
              family.id === familyId
                ? "border-ink bg-panel"
                : "border-transparent hover:border-line hover:bg-panel"
            }`}
          >
            <span className="block font-display text-[15px] font-semibold">
              {family.name}
            </span>
            <span className="mt-px block text-xs text-muted">
              {family.vendor}
            </span>
          </button>
        ))
      )}
    </aside>
  );
}

function resultsForFamily(family: Family): ArtifactResult[] {
  return family.releases.flatMap((release) =>
    release.sizes.flatMap((size) =>
      size.variants.flatMap((variant) =>
        artifactsFor(family, release, size, variant).map((artifact) => ({
          release,
          size,
          variant,
          artifact,
        })),
      ),
    ),
  );
}

const RESULTS_BY_FAMILY = new Map(
  FAMILIES.map((family) => [family.id, resultsForFamily(family)]),
);

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
  releaseId: string | null;
  sizeLabel: string | null;
  variant: string | null;
  rig: RigProfile;
  onlyRunnable: boolean;
  checked: Set<string>;
  artifactBench: BenchKey;
  capacityControls: ReactNode;
  onFamily: (id: string) => void;
  onRelease: (id: string) => void;
  onSize: (label: string) => void;
  onVariant: (variant: string) => void;
  onCheck: (repo: string, on: boolean) => void;
  onArtifactBench: (bench: BenchKey) => void;
  onClearQuery: () => void;
}) {
  const [previewReleaseId, setPreviewReleaseId] = useState<string | null>(null);
  const family = FAMILIES.find((item) => item.id === familyId) ?? FAMILIES[0];
  const release = family.releases.find((item) => item.id === releaseId) ?? null;
  const size = release?.sizes.find((item) => item.label === sizeLabel) ?? null;
  const activeVariant =
    size && variant && size.variants.includes(variant) ? variant : null;
  const metadataRelease =
    family.releases.find((item) => item.id === previewReleaseId) ?? release;
  const licenses = [...new Set(family.releases.map((item) => item.license))];
  const selectedBench =
    BENCHES.find((bench) => bench.key === artifactBench) ?? BENCHES[0];

  const allResults = RESULTS_BY_FAMILY.get(family.id) ?? [];
  const filteredResults = allResults.filter(
    (result) =>
      (!release || result.release.id === release.id) &&
      (!size || result.size.label === size.label) &&
      (!activeVariant || result.variant === activeVariant),
  );
  const visibleResults = filteredResults.filter(
    (result) => !onlyRunnable || fitOf(result.artifact, rig).level !== "no",
  );

  const scores =
    release && size && activeVariant ? size.scores?.[activeVariant] : undefined;
  const scopeTitle = release
    ? `${release.name}${size ? ` ${sizeDisplay(size.label)}` : ""}${
        activeVariant ? ` ${activeVariant}` : ""
      } artifacts`
    : `All ${family.name} artifacts`;

  const segmentClass = (active: boolean) =>
    `inline-flex min-h-8 items-center gap-1.5 rounded-[7px] border px-3 py-1.5 text-[13px] font-semibold ${
      active
        ? "border-ink bg-ink text-paper"
        : "border-line bg-panel hover:border-ink"
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
        <div className="border-b border-line pb-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[25px] font-semibold leading-tight">
                {family.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {family.vendor} / {release?.license ?? licenses.join(", ")}
              </p>
            </div>
            <span className="pt-1 font-mono text-[11.5px] text-faint">
              {visibleResults.length} artifacts
            </span>
          </header>

          <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-[72px_minmax(0,1fr)]">
              <span className={`${SECTION_LABEL} pt-2`}>Release</span>
              <div>
                <div className="flex flex-wrap gap-1.5">
                  {family.releases.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={item.id === release?.id}
                      onClick={() => onRelease(item.id)}
                      onMouseEnter={() => setPreviewReleaseId(item.id)}
                      onMouseLeave={() => setPreviewReleaseId(null)}
                      onFocus={() => setPreviewReleaseId(item.id)}
                      onBlur={() => setPreviewReleaseId(null)}
                      className={segmentClass(item.id === release?.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <div
                  aria-live="polite"
                  className="mt-2 min-h-5 text-[12.5px] text-muted"
                >
                  {metadataRelease ? (
                    <>
                      <b className="font-semibold text-ink">{metadataRelease.name}</b>
                      {" · context "}
                      <b className="font-mono font-semibold text-ink">
                        {metadataRelease.ctx}
                      </b>
                      {" · license "}
                      <b className="font-mono font-semibold text-ink">
                        {metadataRelease.license}
                      </b>
                      {" · released "}
                      <b className="font-mono font-semibold text-ink">
                        {metadataRelease.date}
                      </b>
                    </>
                  ) : (
                    <>
                      {family.releases.length} releases. Hover or focus a release
                      to preview its details.
                    </>
                  )}
                </div>
              </div>
            </div>

            {release ? (
              <div className="grid gap-2 sm:grid-cols-[72px_minmax(0,1fr)]">
                <span className={`${SECTION_LABEL} pt-2`}>Size</span>
                <div className="flex flex-wrap gap-1.5">
                  {release.sizes.map((item) => (
                    <button
                      key={item.label}
                      aria-pressed={item.label === size?.label}
                      onClick={() => onSize(item.label)}
                      className={segmentClass(item.label === size?.label)}
                    >
                      {sizeDisplay(item.label)}
                      {activeParamsLabel(item.label) ? (
                        <span
                          className={`text-[11px] font-normal ${
                            item.label === size?.label
                              ? "text-paper/70"
                              : "text-faint"
                          }`}
                        >
                          {activeParamsLabel(item.label)}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {size ? (
              <div className="grid gap-2 sm:grid-cols-[72px_minmax(0,1fr)]">
                <span className={`${SECTION_LABEL} pt-2`}>Variant</span>
                <div className="flex flex-wrap gap-1.5">
                  {size.variants.map((item) => (
                    <button
                      key={item}
                      aria-pressed={item === activeVariant}
                      onClick={() => onVariant(item)}
                      className={segmentClass(item === activeVariant)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3.5">
          <div className="rounded-[10px] border border-line bg-panel px-4 py-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-baseline gap-2">
                <h2 className={SECTION_LABEL}>{scopeTitle}</h2>
                <span className="font-mono text-[11px] text-faint">
                  {visibleResults.length} results
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {capacityControls}
                <label className="flex min-h-8 items-center gap-1.5 text-xs font-semibold text-muted">
                  Delta
                  <select
                    value={artifactBench}
                    onChange={(event) =>
                      onArtifactBench(event.target.value as BenchKey)
                    }
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
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr>
                    {["", "Model / artifact", "Runtimes", "VRAM", "Fit", `${selectedBench.label} Δ`].map(
                      (heading, index) => (
                        <th
                          key={`${heading}-${index}`}
                          className="whitespace-nowrap border-b border-line px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2.5 py-8 text-center text-muted"
                      >
                        No artifacts in this scope fit within {rig.gb} GB. Open
                        the VRAM filter or show all artifacts.
                      </td>
                    </tr>
                  ) : (
                    visibleResults.map((result) => {
                      const { artifact } = result;
                      const fit = fitOf(artifact, rig);
                      return (
                        <tr
                          key={artifact.repo}
                          className="border-b border-linesoft last:border-b-0"
                        >
                          <td className="px-2.5 py-2.5 align-top">
                            <input
                              type="checkbox"
                              checked={checked.has(artifact.repo)}
                              onChange={(event) =>
                                onCheck(artifact.repo, event.target.checked)
                              }
                              aria-label={`Compare ${artifact.repo}`}
                            />
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-display text-[14px] font-semibold">
                                {result.release.name} {sizeDisplay(result.size.label)}
                              </span>
                              <PropertyChip>{result.variant}</PropertyChip>
                              {activeParamsLabel(result.size.label) ? (
                                <PropertyChip>
                                  {activeParamsLabel(result.size.label)}
                                </PropertyChip>
                              ) : null}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[12.5px] font-bold">
                                {artifact.format}
                              </span>
                              <PropertyChip tone="meta">
                                {uploaderDisplay(artifact.repo)}
                              </PropertyChip>
                              <TrustBadge trust={artifact.trust} />
                              <ConfidenceNote confidence={artifact.confidence} />
                            </span>
                            <span className="mt-1 block break-all font-mono text-[11px] text-faint">
                              {artifact.repo}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <span className="flex flex-wrap gap-1">
                              {artifact.runtimes.map((runtime) => (
                                <span
                                  key={runtime}
                                  className="rounded bg-panel2 px-1.5 py-px font-mono text-[11.5px] text-muted"
                                >
                                  {runtime}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2.5 align-top font-mono text-[13px] tabular-nums">
                            {artifact.minVramGb}–{artifact.recVramGb} GB
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <FitBadge fit={fit} />
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <DeltaChip
                              delta={artifact.deltas[artifactBench]}
                              measured={artifact.measured}
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

          {release && size && activeVariant ? (
            <aside className="mt-3.5 rounded-[10px] border border-line bg-panel px-4 py-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <h2 className={SECTION_LABEL}>Reference benchmarks</h2>
                <span className="text-[11.5px] text-faint">Higher is better</span>
              </div>
              {scores ? (
                <div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
                  {BENCHES.map((bench) => (
                    <div
                      key={bench.key}
                      className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2 border-b border-linesoft py-1.5"
                    >
                      <span className="text-[13px]">{bench.label}</span>
                      <span className="font-mono text-[13px] font-semibold tabular-nums">
                        {scores[bench.key].toFixed(1)}
                      </span>
                      <a
                        href="#"
                        onClick={(event) => event.preventDefault()}
                        title="Provenance link (mock)"
                        className="text-[11.5px] text-meta underline-offset-2 hover:underline"
                      >
                        {bench.source}
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
          ) : null}
        </div>
      </section>
    </div>
  );
}
