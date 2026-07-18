"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
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
  const active = activeParamsLabel(entry.size.label);

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

        <dl className={`mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-linesoft pt-4 ${entry.context === "N/A" ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
          <div>
            <dt className="text-[11.5px] text-muted">Size</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold">
              {sizeDisplay(entry.size.label)}{active ? ` · ${active}` : ""}
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
              Original and quantized weights from every provider remain grouped under this model.
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

        <div className="mt-4 overflow-hidden rounded-[8px] border border-line bg-panel">
          <div className="hidden grid-cols-[44px_minmax(170px,0.8fr)_minmax(170px,1fr)_130px_150px_40px] gap-3 border-b border-line px-3 py-2 text-[11.5px] font-semibold text-muted md:grid">
            <span className="sr-only">Compare</span>
            <span><LexiconHint term="quantization" onLearn={onLearn}>Quant</LexiconHint></span>
            <span><LexiconHint term="provider" onLearn={onLearn}>Provider and repository</LexiconHint></span>
            <span>Recommended VRAM</span>
            <span>Profile fit</span>
            <span className="sr-only">Open repository</span>
          </div>
          <div className="divide-y divide-linesoft">
            {artifacts.map((artifact) => {
              const fits = rig.gb >= artifact.recVramGb;
              const selected = checked.has(artifact.repo);
              const disabled = !selected && compareLimitReached;
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
                    <span className="font-mono text-[13px] font-semibold">{artifact.format}</span>
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
                    <span className="text-[11px] text-muted md:hidden">Recommended VRAM · </span>
                    <span className="font-mono text-[13px] font-semibold">{artifact.recVramGb} GB</span>
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
          Green meets the recommended VRAM estimate for your profile. Red requires more memory.
        </p>
      </section>
    </article>
  );
}
