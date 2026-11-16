"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUpRight01Icon,
  CheckmarkBadge01Icon,
  ComputerCheckIcon,
  Rocket01Icon,
  RssIcon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import type { ModelEntry } from "@/lib/atlas/models";
import { activeParamsLabel, isCompanionModel, sizeDisplay, uploaderDisplay } from "@/lib/atlas/naming";
import { contextLabel, fitOf, gbLabel, kvCacheAt, memoryRange } from "@/lib/atlas/fit";
import { CONTEXT_CHOICES } from "@/lib/atlas/data";
import { runCommandsFor } from "@/lib/atlas/runCommands";
import { compactFact, licenseLabel } from "@/lib/atlas/modelFacts";
import { disambiguationTags } from "@/lib/atlas/artifactTags";
import { modelTransitionName } from "@/lib/atlas/motion";
import type { ContextChoice, RigProfile } from "@/lib/atlas/types";
import { LexiconHint } from "./LexiconHint";
import { RunningModelLink } from "../workspace/RunningModelLink";
import { FamilyLogo } from "./FamilyLogo";
import { ModelCapabilityCharts } from "./ModelCapabilityCharts";
import type { CapabilityComparisons } from "@/lib/atlas/capabilityTypes";
import { RunCommands } from "./RunCommands";
import { ARTIFACT_ROW_COLUMNS } from "./artifactTable";
import { GgufArtifactGroup } from "./GgufArtifactGroup";
import { useGgufFiles } from "./useGgufFiles";

/** Base checkpoints are rarely what people run; show them only when nothing else exists. */
export function visibleModelVariants(variants: string[]) {
  const tuned = variants.filter((variant) => variant.toLowerCase() !== "base");
  return tuned.length > 0 ? tuned : variants;
}

/** Paragraphs of the model-card summary shown before "Read more"; sized to sit level with the fact grid. */
const ABOUT_PREVIEW_PARAGRAPHS = 2;

export function resolveModelVariant(variants: string[], selected: string) {
  return variants.includes(selected) ? selected : variants[0];
}

export function ModelDetailView({
  entry,
  capabilityComparisons,
  rig,
  context,
  onContext,
  preferredVariant,
  checked,
  onCheck,
  onLearn,
}: {
  entry: ModelEntry;
  capabilityComparisons?: CapabilityComparisons;
  rig: RigProfile | null;
  context: ContextChoice;
  onContext: (context: ContextChoice) => void;
  preferredVariant?: string | null;
  checked: Set<string>;
  onCheck: (repo: string, on: boolean) => void;
  onLearn: (term?: string) => void;
}) {
  const variants = useMemo(() => visibleModelVariants(entry.size.variants), [entry.size.variants]);
  const initialVariant =
    preferredVariant && variants.includes(preferredVariant)
      ? preferredVariant
      : variants[0];
  const [selectedVariant, setVariant] = useState(initialVariant);
  const [aboutOpen, setAboutOpen] = useState(false);
  const variant = resolveModelVariant(variants, selectedVariant);
  // A ?variant= link resolves after hydration; apply it once per distinct preference.
  const [appliedPreference, setAppliedPreference] = useState(preferredVariant);
  if (preferredVariant !== appliedPreference) {
    setAppliedPreference(preferredVariant);
    if (preferredVariant && variants.includes(preferredVariant)) setVariant(preferredVariant);
  }
  // Hide draft/assistant companions, unless this entry is itself one (then nothing else exists).
  const hideCompanions = entry.artifacts.some((artifact) => !isCompanionModel(artifact.repo));
  const listed = (artifact: { repo: string; variant: string }) =>
    artifact.variant === variant && !(hideCompanions && isCompanionModel(artifact.repo));
  const artifacts = entry.artifacts.filter(listed);
  const compareLimitReached = checked.size >= 4;
  const nativeContext = artifacts.find((artifact) => artifact.vramEstimate)?.vramEstimate?.contextTokens ?? null;
  // The choice is shared across models; at or beyond this model's native context it means native.
  // Without a known native context, commands keep runtime defaults instead of guessing a length.
  const effectiveContext: ContextChoice = context === "native" || !nativeContext || context >= nativeContext
    ? "native"
    : context;
  // The creator's own uploads first, then each group by largest memory (the number shown in each row).
  // A GGUF repository's real files replace its rough estimate once their manifest loads.
  const filesByRepo = useGgufFiles(artifacts.filter((artifact) => artifact.format.toUpperCase() === "GGUF").map((artifact) => artifact.repo));
  // GGUF files and rows without an exact estimate carry weights only; borrow the KV cache from a
  // sibling artifact of the same variant so every row counts the same memory.
  // Take it from the largest sibling: small draft or adapter repos can share an entry with smaller caches.
  const kvTemplate = artifacts
    .flatMap((artifact) => (artifact.vramEstimate ? [artifact.vramEstimate] : []))
    .sort((left, right) => right.weightGb - left.weightGb)[0];
  const siblingKvBytes = kvTemplate ? kvCacheAt(kvTemplate, effectiveContext).bytes : 0;
  const sortedArtifacts = artifacts
    .map((artifact) => {
      const kv = artifact.vramEstimate ? kvCacheAt(artifact.vramEstimate, effectiveContext) : null;
      const files = filesByRepo[artifact.repo];
      const weightsOnly = !files && !(artifact.vramEstimate && kv) &&
        Number.isFinite(artifact.minVramGb) && Number.isFinite(artifact.recVramGb) &&
        artifact.minVramGb > 0 && artifact.recVramGb > 0
        ? { low: artifact.minVramGb + siblingKvBytes / 1e9, high: artifact.recVramGb + siblingKvBytes / 1e9 }
        : null;
      const memoryGb = files
        ? (files[0].bytes + siblingKvBytes) / 1e9
        : artifact.vramEstimate && kv
          ? artifact.vramEstimate.weightGb + kv.bytes / 1e9
          : weightsOnly?.high ?? -1;
      return { artifact, kv, files, weightsOnly, memoryGb };
    })
    .sort((left, right) =>
      Number(right.artifact.trust === "official") - Number(left.artifact.trust === "official") ||
      right.memoryGb - left.memoryGb ||
      left.artifact.repo.localeCompare(right.artifact.repo));
  // Rows sharing a quant and provider (several checkpoints from one uploader) get a short tag.
  const tags = useMemo(() => {
    const hide = entry.artifacts.some((artifact) => !isCompanionModel(artifact.repo));
    return disambiguationTags(
      entry.artifacts
        .filter((artifact) => artifact.variant === variant && !(hide && isCompanionModel(artifact.repo)))
        .map((artifact) => ({ repo: artifact.repo, format: artifact.format, provider: uploaderDisplay(artifact.repo) })),
      variant,
    );
  }, [entry.artifacts, variant]);
  const active = activeParamsLabel(entry.size.label, entry.size.activeParamsB);
  // One fact grid: the catalog's own facts merged with the model card's highlights. The card's
  // architecture line already states the parameter split, and its context repeats ours.
  const highlights = entry.introduction?.highlights ?? [];
  const architecture = highlights.find((item) => /architecture|parameters/i.test(item.label));
  const facts = [
    architecture ?? {
      label: "Parameters",
      value: `${sizeDisplay(entry.size.label)}${entry.size.isMoe ? " · MoE" : ""}${active ? ` · ${active}` : ""}`,
    },
    ...(entry.context !== "N/A" ? [{ label: "Context", value: entry.context }] : []),
    ...highlights.filter((item) => item !== architecture && !/context/i.test(item.label)),
  ].map((fact) => ({ label: fact.label, value: compactFact(fact.label, fact.value) }));
  const license = licenseLabel(entry.release.license);
  const displayRecipes = useMemo(() => {
    const grouped = new Map<string, (typeof entry.deploymentRecipes)[number]>();
    const repos = new Set(entry.artifacts.filter((artifact) => artifact.variant === variant).map((artifact) => artifact.repo.toLowerCase()));
    for (const sourceRecipe of entry.deploymentRecipes) {
      if (!sourceRecipe.artifactRepos.some((repo) => repos.has(repo.toLowerCase()))) continue;
      const recipe = { ...sourceRecipe, variants: sourceRecipe.variants.filter((item) => repos.has(item.modelId.toLowerCase())) };
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
        hardware: [...new Map(
          [...existing.hardware, ...recipe.hardware]
            .sort((left, right) => left.status === right.status ? 0 : left.status === "verified" ? -1 : 1)
            .map((item) => [item.id, item]),
        ).values()],
        artifactRepos: [...new Set([...existing.artifactRepos, ...recipe.artifactRepos])],
        tasks: [...new Set([...existing.tasks, ...recipe.tasks])],
        features: [...new Set([...existing.features, ...recipe.features])],
      });
    }
    return [...grouped.values()];
  }, [entry, variant]);
  const displayMaterialChanges = useMemo(() => [
    ...new Map(
      entry.materialChanges.map((change) => [
        `${change.type}:${change.title}:${change.sourceUrls[0] ?? ""}`,
        change,
      ]),
    ).values(),
  ], [entry]);


  return (
    <article className="pt-5" aria-labelledby="model-detail-title">
      <Link
        href="/models"
        className="inline-flex min-h-10 items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.8} aria-hidden="true" />
        Models
      </Link>

      <header className={`border-b border-line pb-5 pt-2 ${entry.introduction ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10" : ""}`}>
        <div className="min-w-0">
          <div
            className="flex min-w-0 items-center gap-3.5"
            style={{ viewTransitionName: modelTransitionName(entry.slug) }}
          >
            <FamilyLogo familyId={entry.family.id} familyName={entry.family.name} size={42} />
            <div className="min-w-0">
              <h1 id="model-detail-title" className="text-wrap-balance font-display text-[25px] font-semibold leading-tight">
                {entry.name}
              </h1>
              <p className="mt-1 text-[13px] text-muted">
                {[entry.family.vendor, license, `Updated ${entry.dateLabel}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <dl className={`mt-5 grid grid-cols-2 content-start gap-x-6 gap-y-3 border-t border-linesoft pt-4 ${entry.introduction ? "" : "sm:grid-cols-3"}`}>
            {facts.map((fact) => (
              <div key={`${fact.label}-${fact.value}`} className="min-w-0">
                <dt className="text-[11.5px] text-muted">{fact.label}</dt>
                <dd className="mt-0.5 text-[12.5px] font-semibold leading-relaxed">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {entry.introduction ? (
          <section aria-labelledby="model-about-title" className="min-w-0">
            <h2 id="model-about-title" className="font-display text-[15px] font-semibold">
              About
            </h2>
            <div className="mt-2 max-w-[76ch] text-[13px] leading-6 text-muted">
              <div className="space-y-3">
                {(aboutOpen ? entry.introduction.paragraphs : entry.introduction.paragraphs.slice(0, ABOUT_PREVIEW_PARAGRAPHS)).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4">
              {entry.introduction.paragraphs.length > ABOUT_PREVIEW_PARAGRAPHS ? (
                <button
                  type="button"
                  aria-expanded={aboutOpen}
                  onClick={() => setAboutOpen((open) => !open)}
                  className="inline-flex min-h-9 items-center gap-1 text-[11.5px] font-semibold text-meta hover:text-ink"
                >
                  {aboutOpen ? "Show less" : "Read more"}
                  <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} aria-hidden="true" className={`transition-transform ${aboutOpen ? "rotate-180" : ""}`} />
                </button>
              ) : null}
              <a
                href={entry.introduction.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 text-[11.5px] font-semibold text-muted hover:text-ink"
              >
                {entry.introduction.sourceLabel}
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.8} aria-hidden="true" />
              </a>
            </div>
          </section>
        ) : null}
      </header>

      {capabilityComparisons?.[variant] ? <ModelCapabilityCharts comparison={capabilityComparisons[variant]} /> : null}

      {entry.benchmarkRefs.length > 0 ? (
        <section className="border-b border-line py-5" aria-labelledby="benchmark-evidence-title">
          <h2 id="benchmark-evidence-title" className="font-display text-[17px] font-semibold">
            Benchmark evidence
          </h2>
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
          <h2 id="artifact-title" className="font-display text-[19px] font-semibold">
            Available artifacts
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {variants.length > 1 ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Model variant">
                {variants.map((item) => (
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
            ) : null}
            {nativeContext ? (
              <span className="relative">
                <select
                  aria-label="Context length"
                  value={String(effectiveContext)}
                  onChange={(event) => onContext(event.target.value === "native" ? "native" : Number(event.target.value))}
                  className="h-9 cursor-pointer appearance-none rounded-[7px] border border-line bg-panel pl-2.5 pr-8 font-mono text-[12px] font-semibold outline-none hover:border-ink focus:border-ink"
                >
                  {CONTEXT_CHOICES.filter((choice) => choice.value === "native" || choice.value < nativeContext).reverse().map((choice) => (
                    <option key={String(choice.value)} value={String(choice.value)}>
                      {choice.value === "native"
                        ? `Native · ${entry.context !== "N/A" ? entry.context : contextLabel(nativeContext)} context`
                        : `${choice.label} context`}
                    </option>
                  ))}
                </select>
                <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
              </span>
            ) : null}
          </div>
        </div>

        {entry.runReports.length > 0 ? (
          <details className="motion-disclosure group/reports mt-3 border-y border-linesoft">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 marker:hidden">
              <HugeiconsIcon icon={Activity01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="text-faint" />
              <span className="flex-1 text-[12px] font-semibold">Akashic Computer run reports · {entry.runReports.length}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={1.8} aria-hidden="true" className="text-faint transition-transform group-open/reports:rotate-180" />
            </summary>
            <div className="disclosure-body">
              <div className="disclosure-content">
                <div className="divide-y divide-linesoft border-t border-linesoft">
                {entry.runReports.map((report) => (
                  <div key={report.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(160px,0.8fr)_minmax(180px,1fr)_repeat(2,minmax(100px,0.5fr))] sm:items-center sm:gap-4">
                    <span>
                      <span className="block text-[12px] font-semibold">{report.hardwareProfile}</span>
                      <span className="font-mono text-[11px] text-faint">{report.runtime} {report.runtimeVersion}</span>
                    </span>
                    <span className="font-mono text-[11px] text-muted">{report.artifactRepo}</span>
                    <span className="font-mono text-[11.5px]">{report.peakMemoryGb ? `${report.peakMemoryGb} GB peak` : "Memory not reported"}</span>
                    <span className="font-mono text-[11.5px]">{report.throughputTokensPerSecond ? `${report.throughputTokensPerSecond} tok/s` : report.verificationStatus}</span>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </details>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-[8px] border border-line bg-panel">
          <div className={`hidden ${ARTIFACT_ROW_COLUMNS} gap-3 border-b border-line px-3 py-2 text-[11.5px] font-semibold text-muted md:grid`}>
            <span aria-hidden="true"><span className="sr-only">Compare</span></span>
            <span><LexiconHint term="quantization" onLearn={onLearn}>Quant</LexiconHint></span>
            <span><LexiconHint term="provider" onLearn={onLearn}>Provider</LexiconHint></span>
            <span>Memory estimate</span>
            <span>Run locally</span>
          </div>
          <div className="divide-y divide-linesoft">
            {sortedArtifacts.map(({ artifact, kv, files, weightsOnly }) => {
              const selected = checked.has(artifact.repo);
              const disabled = !selected && compareLimitReached;
              if (files) {
                return (
                  <GgufArtifactGroup
                    key={`${artifact.variant}-${artifact.repo}`}
                    artifact={artifact}
                    vendor={entry.family.vendor}
                    tag={tags.get(artifact.repo)}
                    files={files}
                    kvBytes={siblingKvBytes}
                    budgetGb={rig?.gb ?? null}
                    context={effectiveContext}
                    selected={selected}
                    disabled={disabled}
                    onCheck={onCheck}
                  />
                );
              }
              const fit = fitOf(artifact, rig, { context: effectiveContext });
              const commands = runCommandsFor(artifact, effectiveContext);
              const exceeds = weightsOnly ? rig !== null && weightsOnly.low > rig.gb : fit.level === "no";
              return (
                <div
                  key={`${artifact.variant}-${artifact.repo}`}
                  className={`relative grid min-w-0 gap-3 px-3 py-3.5 transition-colors duration-200 ${ARTIFACT_ROW_COLUMNS} md:items-center ${
                    exceeds ? "bg-alertsoft" : "bg-panel"
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
                      <a
                        href={`https://huggingface.co/${artifact.repo}`}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open ${artifact.repo} on Hugging Face`}
                        className="underline-offset-4 hover:text-meta hover:underline"
                      >
                        {artifact.format}
                      </a>
                      {artifact.trust === "official" ? (
                        <span title={`Official release from ${entry.family.vendor}`} className="inline-flex text-meta">
                          <HugeiconsIcon icon={CheckmarkBadge01Icon} size={15} strokeWidth={2} aria-hidden="true" />
                          <span className="sr-only">Official release</span>
                        </span>
                      ) : null}
                      {tags.get(artifact.repo) ? (
                        <span className="font-sans text-[11.5px] font-normal text-muted">{tags.get(artifact.repo)}</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="min-w-0 pl-11 md:pl-0">
                    <span className="block text-[12.5px] font-semibold">{uploaderDisplay(artifact.repo)}</span>
                    <RunningModelLink repo={artifact.repo}/>
                    {artifact.confidence !== "verified" ? <span className="text-[11px] text-caution">Model link unverified</span> : null}
                  </div>
                  <div className="pl-11 md:pl-0">
                    <span className="text-[11px] text-muted md:hidden">Memory estimate · </span>
                    <span className={`font-mono text-[13px] font-semibold tabular-nums ${exceeds ? "text-alert" : ""}`}>
                      {artifact.vramEstimate && kv
                        ? `${gbLabel(artifact.vramEstimate.weightGb * 1e9 + kv.bytes)} GB`
                        : weightsOnly
                          ? gbLabel(weightsOnly.low * 1e9) === gbLabel(weightsOnly.high * 1e9)
                            ? `${gbLabel(weightsOnly.high * 1e9)} GB`
                            : `${gbLabel(weightsOnly.low * 1e9)}–${gbLabel(weightsOnly.high * 1e9)} GB`
                          : memoryRange(artifact.minVramGb, artifact.recVramGb)}
                    </span>
                  </div>
                  <RunCommands commands={commands} repo={artifact.repo} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="border-t border-line py-5" aria-labelledby="recipes-title">
        <h2 id="recipes-title" className="font-display text-[19px] font-semibold">Runtime recipes</h2>
        {displayRecipes.length > 0 ? (
          <div className="mt-4 divide-y divide-linesoft border-y border-line">
            {displayRecipes.map((recipe) => (
              <details key={recipe.recipeUrl} className="motion-disclosure group/recipe">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 marker:hidden">
                  <HugeiconsIcon icon={Rocket01Icon} size={17} strokeWidth={1.8} aria-hidden="true" className="flex-none text-meta" />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-semibold">Official {recipe.runtime} recipe · {recipe.title}</span>
                    <span className="rounded-[4px] bg-metasoft px-1.5 py-0.5 font-mono text-[11px] text-meta">
                      {recipe.runtime}{recipe.minimumRuntimeVersion ? ` ${recipe.minimumRuntimeVersion}+` : ""}
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
                <div className="disclosure-body">
                  <div className="disclosure-content">
                    <div className="border-t border-linesoft pb-4 pt-3">
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-[11px] text-faint">Minimum runtime</dt>
                      <dd className="mt-0.5 font-mono text-[12px] font-semibold">{recipe.minimumRuntimeVersion ?? "See recipe"}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-faint">Recipe revision</dt>
                      <dd className="mt-0.5 font-mono text-[12px] font-semibold">{recipe.sourceSha.slice(0, 9)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-faint">Maintainer</dt>
                      <dd className="mt-0.5 text-[12px] font-semibold">{recipe.publisher}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                        <HugeiconsIcon icon={ComputerCheckIcon} size={15} strokeWidth={1.8} aria-hidden="true" />
                        Upstream hardware
                      </p>
                      {recipe.hardware.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {recipe.hardware.map((hardware) => (
                            <span
                              key={hardware.id}
                              className={`rounded-[5px] px-2 py-1 text-[11px] font-semibold ${hardware.status === "verified" ? "bg-verifysoft text-verify" : "bg-panel2 text-muted"}`}
                            >
                              {hardware.status === "verified" ? "Verified" : "Documented"} on {hardware.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11.5px] text-muted">Hardware unverified, not unsupported.</p>
                      )}
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                        <HugeiconsIcon icon={SourceCodeIcon} size={15} strokeWidth={1.8} aria-hidden="true" />
                        Recipe capabilities
                      </p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                        {[...recipe.tasks, ...recipe.features].join(" · ") || "See recipe for features."}
                      </p>
                    </div>
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
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="mt-4 border-y border-linesoft py-3">
            <p className="text-[12px] font-semibold">No exact official deployment recipe match</p>
            <p className="mt-0.5 max-w-[76ch] text-[11.5px] leading-relaxed text-muted">
              Unverified, not unsupported.
            </p>
          </div>
        )}

      </section>

      {displayMaterialChanges.length > 0 ? (
        <section className="border-t border-line py-5" aria-labelledby="model-history-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="model-history-title" className="font-display text-[18px] font-semibold">Material history</h2>
            <a href={`/models/${entry.slug}/feed.xml`} className="inline-flex min-h-9 items-center gap-1 text-[11.5px] font-semibold text-meta hover:text-ink">
              <HugeiconsIcon icon={RssIcon} size={14} strokeWidth={1.8} aria-hidden="true" />
              RSS
              <span className="sr-only"> feed of changes to {entry.name}</span>
            </a>
          </div>
          <ol className="mt-3 divide-y divide-linesoft border-y border-linesoft">
            {displayMaterialChanges.map((change) => (
              <li key={change.id} className="grid gap-1 py-3 sm:grid-cols-[105px_minmax(180px,0.55fr)_minmax(260px,1fr)_auto] sm:items-center sm:gap-4">
                <time className="font-mono text-[11px] text-faint">{change.dateLabel}</time>
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
