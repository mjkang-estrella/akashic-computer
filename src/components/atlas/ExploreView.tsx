import Image from "next/image";
import { BookOpen, ChevronDown, ListFilter } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BENCHES, FAMILIES } from "@/lib/atlas/data";
import { artifactsFor, fitOf } from "@/lib/atlas/fit";
import { learnTermForFormat } from "@/lib/atlas/learn";
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

const FAMILY_LOGOS: Record<string, string> = {
  qwen: "/brands/qwen.svg",
  deepseek: "/brands/deepseek.svg",
  llama: "/brands/llama.svg",
  gemma: "/brands/gemma.svg",
  mistral: "/brands/mistral.svg",
  "gpt-oss": "/brands/gpt-oss.svg",
  phi: "/brands/phi.svg",
  nemotron: "/brands/nemotron.svg",
};

function LearnHint({
  term,
  onLearn,
  children,
}: {
  term: string;
  onLearn: (term?: string) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onLearn(term)}
      className="inline-flex items-center gap-1 text-faint underline decoration-dotted underline-offset-4 hover:text-ink"
    >
      {children}
      <BookOpen size={12} aria-hidden="true" />
    </button>
  );
}

function fitLabel(level: ReturnType<typeof fitOf>["level"]) {
  if (level === "runs") return "Fits";
  if (level === "tight") return "Tight";
  return "Does not fit";
}

interface ArtifactResult {
  release: Release;
  size: SizeNode;
  variant: string;
  artifact: Artifact;
}

function FamilyRail({
  familyId,
  onFamily,
}: {
  familyId: string;
  onFamily: (id: string) => void;
}) {
  return (
    <aside className="min-w-0" aria-label="Model families">
      <h2 className={`mb-2.5 ${SECTION_LABEL}`}>Families</h2>
      <div className="flex gap-1.5 overflow-x-auto pb-1 md:block md:overflow-visible md:pb-0">
        {FAMILIES.map((family) => (
          <button
            key={family.id}
            aria-current={family.id === familyId}
            onClick={() => onFamily(family.id)}
            className={`group mb-1 flex min-w-[148px] items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left md:w-full md:min-w-0 ${
              family.id === familyId
                ? "border-ink bg-panel"
                : "border-transparent hover:border-line hover:bg-panel"
            }`}
          >
            <Image
              src={FAMILY_LOGOS[family.id]}
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              className={`h-6 w-6 flex-none object-contain transition-opacity ${
                family.id === familyId
                  ? "opacity-100"
                  : "opacity-55 group-hover:opacity-100 group-focus-visible:opacity-100"
              }`}
            />
            <span className="min-w-0">
              <span
                className={`block font-display text-[15px] font-semibold ${
                  family.id === familyId
                    ? "text-ink"
                    : "text-muted group-hover:text-ink group-focus-visible:text-ink"
                }`}
              >
                {family.name}
              </span>
              <span
                className={`mt-px block text-xs ${
                  family.id === familyId
                    ? "text-muted"
                    : "text-faint group-hover:text-muted group-focus-visible:text-muted"
                }`}
              >
                {family.vendor}
              </span>
            </span>
          </button>
        ))}
      </div>
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
  familyId,
  releaseId,
  sizeLabel,
  variant,
  rig,
  onlyRunnable,
  checked,
  quantizations,
  artifactBenches,
  onFamily,
  onRelease,
  onSize,
  onVariant,
  onToggleQuantization,
  onCheck,
  onToggleArtifactBench,
  onLearn,
}: {
  familyId: string;
  releaseId: string | null;
  sizeLabel: string | null;
  variant: string | null;
  rig: RigProfile;
  onlyRunnable: boolean;
  checked: Set<string>;
  quantizations: Set<string>;
  artifactBenches: Set<BenchKey>;
  onFamily: (id: string) => void;
  onRelease: (id: string) => void;
  onSize: (label: string) => void;
  onVariant: (variant: string) => void;
  onToggleQuantization: (format: string) => void;
  onCheck: (repo: string, on: boolean) => void;
  onToggleArtifactBench: (bench: BenchKey) => void;
  onLearn: (term?: string) => void;
}) {
  const [previewReleaseId, setPreviewReleaseId] = useState<string | null>(null);
  const [showAllArtifacts, setShowAllArtifacts] = useState(false);
  const family = FAMILIES.find((item) => item.id === familyId) ?? FAMILIES[0];
  const release = family.releases.find((item) => item.id === releaseId) ?? null;
  const size = release?.sizes.find((item) => item.label === sizeLabel) ?? null;
  const activeVariant = size
    ? size.variants.length === 1
      ? size.variants[0]
      : variant && size.variants.includes(variant)
        ? variant
        : null
    : null;
  const metadataRelease =
    family.releases.find((item) => item.id === previewReleaseId) ?? release;
  const licenses = [...new Set(family.releases.map((item) => item.license))];
  const selectedBenches = BENCHES.filter((bench) => artifactBenches.has(bench.key));

  const allResults = RESULTS_BY_FAMILY.get(family.id) ?? [];
  const scopedResults = allResults.filter(
    (result) =>
      (!release || result.release.id === release.id) &&
      (!size || result.size.label === size.label) &&
      (!activeVariant || result.variant === activeVariant),
  );
  const quantizationOptions = [
    ...new Set(scopedResults.map((result) => result.artifact.format)),
  ];
  const filteredResults = scopedResults.filter(
    (result) =>
      quantizations.size === 0 || quantizations.has(result.artifact.format),
  );
  const visibleResults = filteredResults.filter(
    (result) => !onlyRunnable || fitOf(result.artifact, rig).level !== "no",
  );
  const showResults = Boolean(release) || showAllArtifacts;
  const compareLimitReached = checked.size >= 4;

  const scores =
    release && size && activeVariant ? size.scores?.[activeVariant] : undefined;
  const segmentClass = (active: boolean) =>
    `inline-flex min-h-11 items-center gap-1.5 rounded-[7px] border px-3 py-1.5 text-[13px] font-semibold sm:min-h-8 ${
      active
        ? "border-ink bg-ink text-paper"
        : "border-line bg-panel hover:border-ink"
    }`;

  return (
    <div className="grid gap-4 pt-4 md:grid-cols-[248px_minmax(0,1fr)]">
      <FamilyRail
        familyId={family.id}
        onFamily={onFamily}
      />

      <section className="min-w-0">
        <div className="border-b border-line pb-4">
          <header>
            <div className="flex items-center gap-3">
              <Image
                src={FAMILY_LOGOS[family.id]}
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                className="h-8 w-8 flex-none object-contain"
              />
              <div className="min-w-0">
                <h2 className="font-display text-[25px] font-semibold leading-tight">
                  {family.name}
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  {family.vendor} / {release?.license ?? licenses.join(", ")}
                </p>
              </div>
            </div>
          </header>

          <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)]">
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
                      {" · "}
                      <LearnHint term="context" onLearn={onLearn}>
                        context
                      </LearnHint>{" "}
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
              <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)]">
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
              <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)]">
                <span className={`${SECTION_LABEL} pt-2`}>
                  <LearnHint term="variant" onLearn={onLearn}>
                    Variant
                  </LearnHint>
                </span>
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

            {size && activeVariant ? (
              <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)]">
                <span className={`${SECTION_LABEL} pt-2`}>
                  <LearnHint term="quantization" onLearn={onLearn}>
                    Quant
                  </LearnHint>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quantizationOptions.map((format) => (
                    <button
                      key={format}
                      aria-pressed={quantizations.has(format)}
                      onClick={() => onToggleQuantization(format)}
                      className={segmentClass(quantizations.has(format))}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3.5">
          {!showResults ? (
            <div className="rounded-[10px] border border-line bg-panel px-5 py-10 text-center">
              <h3 className="font-display text-[19px] font-semibold">Choose a release</h3>
              <p className="mx-auto mt-1 max-w-[58ch] text-[13px] leading-relaxed text-muted">
                Select a release to reveal its sizes, variants, and artifacts in sequence.
                The complete family remains available when you need a broad scan.
              </p>
              <button
                type="button"
                onClick={() => setShowAllArtifacts(true)}
                className="mt-4 min-h-11 rounded-[7px] border border-line bg-paper px-3 text-[12.5px] font-semibold hover:border-ink sm:min-h-9"
              >
                Show all artifacts
              </button>
            </div>
          ) : (
          <div className="rounded-[10px] border border-line bg-panel px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              {!release && showAllArtifacts ? (
                <button
                  type="button"
                  onClick={() => setShowAllArtifacts(false)}
                  className="min-h-8 text-[12.5px] font-semibold text-muted hover:text-ink"
                >
                  Back to release selection
                </button>
              ) : (
                <span />
              )}
              <details className="relative">
                <summary className="flex min-h-11 list-none cursor-pointer items-center gap-1.5 rounded-[7px] border border-line bg-paper px-2.5 py-1 text-[12.5px] font-semibold text-muted hover:border-ink sm:min-h-8 [&::-webkit-details-marker]:hidden">
                  <ListFilter size={14} aria-hidden="true" />
                  Benchmarks
                  {selectedBenches.length > 0 ? (
                    <span className="font-mono text-[11px] text-ink">
                      {selectedBenches.length}
                    </span>
                  ) : null}
                  <ChevronDown size={13} aria-hidden="true" />
                </summary>
                <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-[8px] border border-ink bg-panel p-2.5">
                  {BENCHES.map((bench) => (
                    <label
                      key={bench.key}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-1.5 text-[12.5px] hover:bg-panel2 sm:min-h-8"
                    >
                      <input
                        type="checkbox"
                        checked={artifactBenches.has(bench.key)}
                        onChange={() => onToggleArtifactBench(bench.key)}
                      />
                      {bench.label}
                    </label>
                  ))}
                </div>
              </details>
            </div>

            <div className="divide-y divide-linesoft md:hidden">
              {visibleResults.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-muted">
                  No artifacts in this scope fit within {rig.gb} GB. Open the VRAM
                  filter or show all artifacts.
                </p>
              ) : (
                visibleResults.map((result) => {
                  const { artifact } = result;
                  const fit = fitOf(artifact, rig);
                  const selected = checked.has(artifact.repo);
                  const disabled = !selected && compareLimitReached;
                  return (
                    <article key={artifact.repo} className="py-3.5">
                      <div className="flex items-start gap-2.5">
                        <label className="-ml-2 inline-flex h-11 w-11 flex-none cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={disabled}
                            onChange={(event) => onCheck(artifact.repo, event.target.checked)}
                            aria-label={`Compare ${artifact.repo}`}
                            className="disabled:cursor-not-allowed disabled:opacity-35"
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-display text-[15px] font-semibold">
                              {result.release.name} {sizeDisplay(result.size.label)}
                            </span>
                            <PropertyChip>{result.variant}</PropertyChip>
                            {activeParamsLabel(result.size.label) ? (
                              <PropertyChip>{activeParamsLabel(result.size.label)}</PropertyChip>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onLearn(learnTermForFormat(artifact.format))}
                              className="font-mono text-[12.5px] font-bold underline decoration-dotted underline-offset-4"
                            >
                              {artifact.format}
                            </button>
                            <PropertyChip tone="meta">{uploaderDisplay(artifact.repo)}</PropertyChip>
                            <TrustBadge trust={artifact.trust} />
                            <ConfidenceNote confidence={artifact.confidence} />
                          </div>
                        </div>
                      </div>

                      <a
                        href={`https://huggingface.co/${artifact.repo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all pl-11 font-mono text-[11px] text-faint underline-offset-2 hover:text-ink hover:underline"
                      >
                        {artifact.repo}
                      </a>

                      <dl className="mt-3 grid grid-cols-2 gap-3 border-y border-linesoft py-2.5">
                        <div>
                          <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">VRAM</dt>
                          <dd className="mt-0.5 font-mono text-[13px] tabular-nums">
                            {artifact.minVramGb}–{artifact.recVramGb} GB
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">Fit</dt>
                          <dd className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold">
                            <FitBadge fit={fit} /> {fitLabel(fit.level)}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {artifact.runtimes.map((runtime) => (
                          <span key={runtime} className="rounded bg-panel2 px-1.5 py-px font-mono text-[11.5px] text-muted">
                            {runtime}
                          </span>
                        ))}
                      </div>
                      {selectedBenches.length > 0 ? (
                        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
                          {selectedBenches.map((bench) => (
                            <div key={bench.key} className="flex items-center justify-between gap-2">
                              <dt className="text-[11.5px] text-muted">{bench.label}</dt>
                              <dd><DeltaChip delta={artifact.deltas[bench.key]} measured={artifact.measured} /></dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>

            <div
              className="hidden overflow-x-auto md:block"
              tabIndex={0}
              aria-label="Model artifacts table; scroll horizontally for more columns"
            >
              <table className="w-full min-w-[820px] border-collapse">
                <thead className="sticky top-0 z-10 bg-panel">
                  <tr>
                    {[
                      "",
                      "Model",
                      "Runtimes",
                      "VRAM",
                      "Fit",
                      ...selectedBenches.map((bench) => `${bench.label} Δ`),
                    ].map((heading, index) => (
                        <th
                          key={`${heading}-${index}`}
                          scope="col"
                          className="whitespace-nowrap border-b border-line px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted"
                        >
                          <span className={index === 0 ? "sr-only" : undefined}>
                            {heading === "VRAM" ? (
                              <LearnHint term="vram" onLearn={onLearn}>VRAM</LearnHint>
                            ) : heading === "Fit" ? (
                              <LearnHint term="fit" onLearn={onLearn}>Fit</LearnHint>
                            ) : (
                              heading || "Compare"
                            )}
                          </span>
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + selectedBenches.length}
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
                      const selected = checked.has(artifact.repo);
                      const disabled = !selected && compareLimitReached;
                      return (
                        <tr
                          key={artifact.repo}
                          className="border-b border-linesoft last:border-b-0"
                        >
                          <td className="px-2.5 py-2.5 align-top">
                            <label className="inline-flex h-6 w-6 cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={disabled}
                                onChange={(event) =>
                                  onCheck(artifact.repo, event.target.checked)
                                }
                                aria-label={`Compare ${artifact.repo}`}
                                className="disabled:cursor-not-allowed disabled:opacity-35"
                              />
                            </label>
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-display text-[15px] font-semibold">
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
                              <button
                                type="button"
                                onClick={() => onLearn(learnTermForFormat(artifact.format))}
                                className="font-mono text-[12.5px] font-bold underline decoration-dotted underline-offset-4"
                              >
                                {artifact.format}
                              </button>
                              <PropertyChip tone="meta">
                                {uploaderDisplay(artifact.repo)}
                              </PropertyChip>
                              <TrustBadge trust={artifact.trust} />
                              <ConfidenceNote confidence={artifact.confidence} />
                            </span>
                            <a
                              href={`https://huggingface.co/${artifact.repo}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block break-all font-mono text-[11px] text-faint underline-offset-2 hover:text-ink hover:underline"
                            >
                              {artifact.repo}
                            </a>
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
                          {selectedBenches.map((bench) => (
                            <td
                              key={bench.key}
                              className="px-2.5 py-2.5 align-top"
                            >
                              <DeltaChip
                                delta={artifact.deltas[bench.key]}
                                measured={artifact.measured}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {release && size && activeVariant ? (
            <aside className="mt-3.5 rounded-[10px] border border-line bg-panel px-4 py-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <h2 className={SECTION_LABEL}>
                  <LearnHint term="benchmark" onLearn={onLearn}>
                    Reference benchmarks
                  </LearnHint>
                </h2>
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
                      <span className="text-[11.5px] text-meta">
                        {bench.source}
                      </span>
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
