"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  ComputerCheckIcon,
  Rocket01Icon,
  SourceCodeIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { modelDescription, type ModelEntry } from "@/lib/atlas/models";
import { activeParamsLabel, sizeDisplay, uploaderDisplay } from "@/lib/atlas/naming";
import type { RigProfile } from "@/lib/atlas/types";
import { LexiconHint } from "./LexiconHint";
import { FamilyLogo } from "./FamilyLogo";

export function ModelDetailView({
  entry,
  rig,
  preferredVariant,
  checked,
  onBack,
  onCheck,
  onLearn,
}: {
  entry: ModelEntry;
  rig: RigProfile;
  preferredVariant?: string | null;
  checked: Set<string>;
  onBack: () => void;
  onCheck: (repo: string, on: boolean) => void;
  onLearn: (term?: string) => void;
}) {
  const initialVariant =
    preferredVariant && entry.size.variants.includes(preferredVariant)
      ? preferredVariant
      : entry.size.variants[0];
  const [variant, setVariant] = useState(initialVariant);
  const artifacts = entry.artifacts.filter((artifact) => artifact.variant === variant);
  const compareLimitReached = checked.size >= 4;
  const active = activeParamsLabel(entry.size.label, entry.size.activeParamsB);
  const displayRecipes = useMemo(() => {
    const grouped = new Map<string, (typeof entry.recipeReferences)[number]>();
    for (const recipe of entry.recipeReferences) {
      const existing = grouped.get(recipe.recipeUrl);
      if (!existing) {
        grouped.set(recipe.recipeUrl, recipe);
        continue;
      }
      grouped.set(recipe.recipeUrl, {
        ...existing,
        variants: [...new Map(
          [...existing.variants, ...recipe.variants]
            .map((item) => [`${item.modelId}:${item.precision}`, item]),
        ).values()],
        verifiedHardware: [...new Map(
          [...existing.verifiedHardware, ...recipe.verifiedHardware]
            .map((item) => [item.id, item]),
        ).values()],
        artifactRepos: [...new Set([...existing.artifactRepos, ...recipe.artifactRepos])],
        tasks: [...new Set([...existing.tasks, ...recipe.tasks])],
        features: [...new Set([...existing.features, ...recipe.features])],
      });
    }
    return [...grouped.values()];
  }, [entry]);
  const displayMaterialChanges = useMemo(() => [
    ...new Map(
      entry.materialChanges.map((change) => [
        `${change.type}:${change.title}:${change.sourceUrls[0] ?? ""}`,
        change,
      ]),
    ).values(),
  ], [entry]);
  const recipeCheckpointByRepo = useMemo(() => {
    const checkpoints = new Map<
      string,
      { recipe: (typeof displayRecipes)[number]; variant: (typeof displayRecipes)[number]["variants"][number] }
    >();
    for (const recipe of displayRecipes) {
      for (const recipeVariant of recipe.variants) {
        checkpoints.set(recipeVariant.modelId.toLowerCase(), {
          recipe,
          variant: recipeVariant,
        });
      }
    }
    return checkpoints;
  }, [displayRecipes]);

  return (
    <article className="pt-5" aria-labelledby="model-detail-title">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.8} aria-hidden="true" />
        Models
      </button>

      <header className="border-b border-line pb-5 pt-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <FamilyLogo familyId={entry.family.id} familyName={entry.family.name} size={42} />
            <div className="min-w-0">
              <h2 id="model-detail-title" className="text-wrap-balance font-display text-[25px] font-semibold leading-tight">
                {entry.name}
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                {entry.family.vendor} · {entry.release.license}
              </p>
            </div>
          </div>
          <span className={`pt-1 text-[12.5px] ${entry.updated ? "font-semibold text-meta" : "text-muted"}`}>
            {entry.dateLabel}
          </span>
        </div>
        <p className="mt-5 max-w-[72ch] text-[13px] leading-6 text-muted">
          {modelDescription(entry)}
        </p>

        {entry.introduction ? (
          <details className="group/introduction mt-5 border-y border-linesoft">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 marker:hidden">
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold">
                  {entry.introduction.heading}
                </span>
                <span className="mt-0.5 block max-w-[76ch] text-[11.5px] leading-relaxed text-muted">
                  {entry.introduction.summary}
                </span>
              </span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="flex-none text-faint transition-transform group-open/introduction:rotate-180"
              />
            </summary>
            <div className="border-t border-linesoft pb-5 pt-4">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {entry.introduction.highlights.map((highlight) => (
                  <div key={`${highlight.label}-${highlight.value}`} className="min-w-0">
                    <dt className="text-[10.5px] text-faint">{highlight.label}</dt>
                    <dd className="mt-0.5 text-[12.5px] font-semibold leading-relaxed">{highlight.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 max-w-[76ch] space-y-3 text-[13px] leading-6 text-muted">
                {entry.introduction.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <a
                href={entry.introduction.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-[11.5px] font-semibold text-meta hover:text-ink"
              >
                {entry.introduction.sourceLabel}
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.8} aria-hidden="true" />
              </a>
            </div>
          </details>
        ) : null}

        <dl className={`mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-linesoft pt-4 ${entry.context === "N/A" ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
          <div>
            <dt className="text-[11.5px] text-muted">Parameters</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold">
              {sizeDisplay(entry.size.label)}{entry.size.isMoe ? " · MoE" : ""}{active ? ` · ${active}` : ""}
            </dd>
          </div>
          {entry.context !== "N/A" ? (
            <div>
              <dt className="text-[11.5px] text-muted">Context</dt>
              <dd className="mt-0.5 font-mono text-[13px] font-semibold">{entry.context}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[11.5px] text-muted">Variants</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold">{entry.size.variants.length}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted">Current profile</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold">{rig.gb} GB VRAM</dd>
          </div>
        </dl>
      </header>

      {entry.benchmarkRefs.length > 0 ? (
        <section className="border-b border-line py-5" aria-labelledby="benchmark-evidence-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="benchmark-evidence-title" className="font-display text-[17px] font-semibold">
              Benchmark evidence
            </h3>
            <span className="text-[11.5px] text-muted">Sourced results, not inferred</span>
          </div>
          <div className="mt-3 divide-y divide-linesoft border-y border-linesoft">
            {entry.benchmarkRefs.map((benchmark) => (
              <a
                key={`${benchmark.name}-${benchmark.sourceUrl}`}
                href={benchmark.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="group grid min-h-14 gap-1 py-3 hover:text-meta sm:grid-cols-[minmax(180px,0.7fr)_minmax(240px,1fr)_auto] sm:items-center sm:gap-4"
              >
                <span className="text-[12.5px] font-semibold">{benchmark.name}</span>
                <span className="font-mono text-[12px] text-muted group-hover:text-meta">{benchmark.result}</span>
                <span className="inline-flex items-center gap-1 text-[11.5px] text-muted group-hover:text-meta">
                  {benchmark.sourceLabel}
                  <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.8} aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="py-5" aria-labelledby="artifact-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="artifact-title" className="font-display text-[19px] font-semibold">
              Available artifacts
            </h3>
            <p className="mt-1 text-[12.5px] text-muted">
              Original checkpoints, quantized weights, and their official vLLM deployment references.
            </p>
          </div>
          {entry.size.variants.length > 1 ? (
            <div className="flex flex-wrap gap-1.5" aria-label="Model variant">
              {entry.size.variants.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={variant === item}
                  onClick={() => setVariant(item)}
                  className={`min-h-9 rounded-[7px] border px-3 text-[12.5px] font-semibold ${
                    variant === item
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-panel hover:border-ink"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <span className="rounded-[5px] bg-panel2 px-2 py-1 font-mono text-[13px] text-muted">
              {variant}
            </span>
          )}
        </div>

        {displayRecipes.length > 0 ? (
          <div className="mt-4 divide-y divide-linesoft border-y border-line">
            {displayRecipes.map((recipe) => (
              <details key={recipe.recipeUrl} className="group/recipe">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 marker:hidden">
                  <HugeiconsIcon icon={Rocket01Icon} size={17} strokeWidth={1.8} aria-hidden="true" className="flex-none text-meta" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold">Official vLLM recipe · {recipe.title}</span>
                      <span className="rounded-[4px] bg-metasoft px-1.5 py-0.5 font-mono text-[10px] text-meta">
                        vLLM {recipe.minimumVllmVersion ?? "version in recipe"}+
                      </span>
                    </span>
                    <span className="mt-0.5 block max-w-[76ch] text-[11.5px] leading-relaxed text-muted">
                      {recipe.description}
                    </span>
                  </span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={15}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="flex-none text-faint transition-transform group-open/recipe:rotate-180"
                  />
                </summary>
                <div className="border-t border-linesoft pb-4 pt-3">
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-[10.5px] text-faint">Minimum vLLM</dt>
                      <dd className="mt-0.5 font-mono text-[12px] font-semibold">{recipe.minimumVllmVersion ?? "See recipe"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] text-faint">Recipe revision</dt>
                      <dd className="mt-0.5 font-mono text-[12px] font-semibold">{recipe.sourceSha.slice(0, 9)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] text-faint">Maintainer</dt>
                      <dd className="mt-0.5 text-[12px] font-semibold">{recipe.publisher}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                        <HugeiconsIcon icon={ComputerCheckIcon} size={15} strokeWidth={1.8} aria-hidden="true" />
                        Upstream verified hardware
                      </p>
                      {recipe.verifiedHardware.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {recipe.verifiedHardware.map((hardware) => (
                            <span key={hardware.id} className="rounded-[5px] bg-verifysoft px-2 py-1 text-[11px] font-semibold text-verify">
                              Verified on {hardware.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11.5px] text-muted">No hardware is marked verified upstream. This does not mean unsupported.</p>
                      )}
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                        <HugeiconsIcon icon={SourceCodeIcon} size={15} strokeWidth={1.8} aria-hidden="true" />
                        Recipe capabilities
                      </p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                        {[...recipe.tasks, ...recipe.features].join(" · ") || "See the upstream recipe for supported features."}
                      </p>
                    </div>
                  </div>
                  <a
                    href={recipe.recipeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-[11.5px] font-semibold text-meta hover:text-ink"
                  >
                    Open official recipe
                    <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.8} aria-hidden="true" />
                  </a>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="mt-4 border-y border-linesoft py-3">
            <p className="text-[12px] font-semibold">No exact official vLLM recipe match</p>
            <p className="mt-0.5 max-w-[76ch] text-[11.5px] leading-relaxed text-muted">
              Absence means unverified, not unsupported. Akashic only attaches recipes through exact artifact IDs.
            </p>
          </div>
        )}

        {entry.runReports.length > 0 ? (
          <details className="group/reports mt-3 border-y border-linesoft">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 marker:hidden">
              <HugeiconsIcon icon={Activity01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="text-faint" />
              <span className="flex-1 text-[12px] font-semibold">Akashic run reports · {entry.runReports.length}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={1.8} aria-hidden="true" className="text-faint transition-transform group-open/reports:rotate-180" />
            </summary>
            <div className="divide-y divide-linesoft border-t border-linesoft">
              {entry.runReports.map((report) => (
                <div key={report.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(160px,0.8fr)_minmax(180px,1fr)_repeat(2,minmax(100px,0.5fr))] sm:items-center sm:gap-4">
                  <span>
                    <span className="block text-[12px] font-semibold">{report.hardwareProfile}</span>
                    <span className="font-mono text-[10.5px] text-faint">{report.runtime} {report.runtimeVersion}</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-muted">{report.artifactRepo}</span>
                  <span className="font-mono text-[11.5px]">{report.peakMemoryGb ? `${report.peakMemoryGb} GB peak` : "Memory not reported"}</span>
                  <span className="font-mono text-[11.5px]">{report.throughputTokensPerSecond ? `${report.throughputTokensPerSecond} tok/s` : report.verificationStatus}</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-[8px] border border-line bg-panel">
          <div className="hidden grid-cols-[44px_minmax(170px,0.8fr)_minmax(170px,1fr)_130px_150px_40px] gap-3 border-b border-line px-3 py-2 text-[11.5px] font-semibold text-muted md:grid">
            <span aria-hidden="true"><span className="sr-only">Compare</span></span>
            <span><LexiconHint term="quantization" onLearn={onLearn}>Quant</LexiconHint></span>
            <span><LexiconHint term="provider" onLearn={onLearn}>Provider and repository</LexiconHint></span>
            <span>VRAM</span>
            <span>Profile fit</span>
            <span className="sr-only">Open repository</span>
          </div>
          <div className="divide-y divide-linesoft">
            {artifacts.map((artifact) => {
              const fits = rig.gb >= artifact.recVramGb;
              const selected = checked.has(artifact.repo);
              const disabled = !selected && compareLimitReached;
              const recipeCheckpoint = recipeCheckpointByRepo.get(artifact.repo.toLowerCase());
              return (
                <div
                  key={`${artifact.variant}-${artifact.repo}`}
                  className={`relative grid min-w-0 gap-3 px-3 py-3.5 md:grid-cols-[44px_minmax(170px,0.8fr)_minmax(170px,1fr)_130px_150px_40px] md:items-center ${
                    fits ? "bg-verifysoft" : "bg-alertsoft"
                  }`}
                >
                  <label className="absolute flex h-10 w-10 cursor-pointer items-center justify-center md:static" title="Compare artifact">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={(event) => onCheck(artifact.repo, event.target.checked)}
                      aria-label={`Compare ${artifact.repo}`}
                      className="disabled:cursor-not-allowed disabled:opacity-35"
                    />
                  </label>
                  <div className="min-w-0 pl-11 md:pl-0">
                    <span className="flex flex-wrap items-center gap-1.5 font-mono text-[13px] font-semibold">
                      {artifact.format}
                      {recipeCheckpoint ? (
                        <span
                          title={`Official checkpoint in ${recipeCheckpoint.recipe.title}`}
                          className="inline-flex items-center gap-1 rounded-[4px] bg-metasoft px-1.5 py-0.5 font-sans text-[10px] font-semibold text-meta"
                        >
                          <HugeiconsIcon icon={StarIcon} size={12} strokeWidth={2} aria-hidden="true" />
                          Recipe checkpoint
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {artifact.runtimes.map((runtime) => (
                        <span key={runtime} className="rounded-[4px] bg-panel/70 px-1.5 py-px font-mono text-[10.5px] text-muted">
                          {runtime}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="min-w-0 pl-11 md:pl-0">
                    <span className="block text-[12.5px] font-semibold">{uploaderDisplay(artifact.repo)}</span>
                    <span className="mt-0.5 block break-all font-mono text-[10.5px] text-muted">{artifact.repo}</span>
                  </div>
                  <div className="pl-11 md:pl-0">
                    <span className="text-[11px] text-muted md:hidden">VRAM · </span>
                    <span className="font-mono text-[13px] font-semibold">{artifact.recVramGb} GB</span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                      {artifact.vramEstimate
                        ? `${artifact.vramEstimate.weightGb} GB weights + ${artifact.vramEstimate.kvCacheGb} GB BF16 KV · ${artifact.vramEstimate.contextTokens.toLocaleString()} ctx · c1`
                        : artifact.vramEstimated ? "Estimated · weight based" : "Curated"}
                    </span>
                    {recipeCheckpoint?.variant.minimumVramGb ? (
                      <span className="mt-0.5 block text-[10px] font-semibold text-meta">
                        vLLM recipe minimum · {recipeCheckpoint.variant.minimumVramGb} GB
                      </span>
                    ) : null}
                  </div>
                  <div className={`flex items-center gap-1.5 pl-11 text-[13px] font-semibold md:pl-0 ${fits ? "text-verify" : "text-alert"}`}>
                    <HugeiconsIcon
                      icon={fits ? CheckmarkCircle02Icon : CancelCircleIcon}
                      size={17}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {fits ? `Fits ${rig.gb} GB` : `Needs ${artifact.recVramGb} GB`}
                  </div>
                  <a
                    href={`https://huggingface.co/${artifact.repo}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${artifact.repo} on Hugging Face`}
                    title="Open on Hugging Face"
                    className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-[7px] text-muted hover:bg-panel hover:text-ink md:static"
                  >
                    <HugeiconsIcon icon={ArrowUpRight01Icon} size={17} strokeWidth={1.8} aria-hidden="true" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2.5 text-[11.5px] text-muted">
          Green meets the default VRAM estimate for your profile. When architecture metadata is available, it equals checkpoint weights plus BF16 KV cache at maximum context and concurrency 1; runtime headroom is not included.
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
          <HugeiconsIcon icon={StarIcon} size={13} strokeWidth={1.9} aria-hidden="true" className="text-meta" />
          A star marks an exact checkpoint referenced by an official vLLM recipe.
        </p>
      </section>

      {displayMaterialChanges.length > 0 ? (
        <section className="border-t border-line py-5" aria-labelledby="model-history-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="model-history-title" className="font-display text-[18px] font-semibold">Material history</h3>
            <span className="text-[10.5px] text-faint">Description-only commits excluded</span>
          </div>
          <ol className="mt-3 divide-y divide-linesoft border-y border-linesoft">
            {displayMaterialChanges.map((change) => (
              <li key={change.id} className="grid gap-1 py-3 sm:grid-cols-[105px_minmax(180px,0.55fr)_minmax(260px,1fr)_auto] sm:items-center sm:gap-4">
                <time className="font-mono text-[10.5px] text-faint">{change.dateLabel}</time>
                <span className="text-[12px] font-semibold">{change.title}</span>
                <span className="text-[11.5px] leading-relaxed text-muted">{change.summary}</span>
                {change.sourceUrls[0] ? (
                  <a href={change.sourceUrls[0]} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-meta hover:text-ink">
                    {change.sourceLabel}
                    <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} strokeWidth={1.8} aria-hidden="true" />
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
