"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { ModelEntry } from "@/lib/atlas/models";
import {
  resolveModelPath,
  type ModelPathSelection,
} from "@/lib/atlas/modelPath";
import { modelReleaseName, parameterCountLabel } from "@/lib/atlas/naming";
import { FamilyLogo } from "./FamilyLogo";

function PathField({
  step,
  label,
  value,
  onChange,
  children,
}: {
  step: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="flex items-baseline gap-2 text-[12px] font-semibold">
        <span className="font-mono text-[10px] font-normal text-faint">
          {step}
        </span>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-11 w-full min-w-0 rounded-[7px] border border-line bg-paper px-2.5 text-[13px] font-semibold"
      >
        {children}
      </select>
    </label>
  );
}

export function ModelPathExplorer({
  entries,
  loading,
}: {
  entries: ModelEntry[];
  loading: boolean;
}) {
  const [selection, setSelection] = useState<ModelPathSelection>({});
  const path = useMemo(
    () => resolveModelPath(entries, selection),
    [entries, selection],
  );

  return (
    <section
      aria-label="From model family to downloadable weights"
      className="min-w-0 rounded-[10px] border border-line bg-panel"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 id="model-path-title" className="text-[13px] font-semibold">
          Choose a model
        </h2>
      </header>
      {!path ? (
        <div className="min-h-[370px] p-5" aria-busy={loading}>
          <p role="status" className="text-[13px] text-muted">
            {loading
              ? "Loading model families from the live catalog…"
              : "Model families will appear when the catalog is published."}
          </p>
          {loading ? (
            <div aria-hidden="true" className="mt-5 grid grid-cols-2 gap-5">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  key={index}
                  className="catalog-skeleton h-20 rounded-[7px]"
                />
              ))}
              <span className="catalog-skeleton col-span-2 h-24 rounded-[7px]" />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-5">
            <PathField
              step="01"
              label="Family"
              value={path.family.id}
              onChange={(familyId) => setSelection({ familyId })}
            >
              {path.families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </PathField>
            <PathField
              step="02"
              label="Release"
              value={path.release.id}
              onChange={(releaseId) =>
                setSelection({ familyId: path.family.id, releaseId })
              }
            >
              {path.releases.map((release) => (
                <option key={release.id} value={release.id}>
                  {modelReleaseName(path.family, release)}
                </option>
              ))}
            </PathField>
            <PathField
              step="03"
              label="Size"
              value={path.entry.slug}
              onChange={(slug) =>
                setSelection({
                  familyId: path.family.id,
                  releaseId: path.release.id,
                  slug,
                })
              }
            >
              {path.sizes.map((entry) => (
                <option key={entry.slug} value={entry.slug}>
                  {parameterCountLabel(entry.size)}
                </option>
              ))}
            </PathField>
            <PathField
              step="04"
              label="Variant"
              value={path.variant ?? ""}
              onChange={(variant) =>
                setSelection({
                  familyId: path.family.id,
                  releaseId: path.release.id,
                  slug: path.entry.slug,
                  variant,
                })
              }
            >
              {path.variants.length ? (
                path.variants.map((variant) => (
                  <option key={variant} value={variant}>
                    {variant}
                  </option>
                ))
              ) : (
                <option value="">Not specified</option>
              )}
            </PathField>
          </div>
          <div className="border-t border-line px-5 pt-4 pb-5">
            <fieldset>
              <legend className="text-[12px] font-semibold">
                <span className="mr-2 font-mono text-[10px] font-normal text-faint">
                  05
                </span>
                Artifact
              </legend>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {["", ...path.formats].map((format) => (
                  <button
                    key={format}
                    type="button"
                    aria-pressed={path.format === format}
                    onClick={() =>
                      setSelection({
                        familyId: path.family.id,
                        releaseId: path.release.id,
                        slug: path.entry.slug,
                        variant: path.variant,
                        format,
                      })
                    }
                    className={`min-h-9 rounded-[6px] border px-2.5 text-[11.5px] font-semibold ${path.format === format ? "border-ink bg-ink text-paper" : "border-line bg-paper text-muted hover:border-ink hover:text-ink"}`}
                  >
                    {format || "All formats"}
                  </button>
                ))}
              </div>
            </fieldset>
            <div aria-live="polite" aria-atomic="true" className="mt-4">
              <p className="sr-only">
                {path.entry.name}, {path.variant}. {path.artifacts.length}{" "}
                published artifacts.
              </p>
              {path.artifacts.length ? (
                <ul className="divide-y divide-linesoft border-y border-line">
                  {path.artifacts.slice(0, 2).map((artifact, index) => (
                    <li
                      key={`${artifact.repo}-${artifact.format}-${index}`}
                      className="py-2.5"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 break-all font-mono text-[11.5px]">
                          {artifact.repo}
                        </span>
                        <span className="flex-none rounded-[4px] bg-panel2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                          {artifact.format}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        {artifact.runtimes.length
                          ? `Listed runtimes: ${artifact.runtimes.join(" · ")}`
                          : "Runtime support not listed"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-y border-line py-4 text-[12px] text-muted">
                  No published artifacts for this variant yet. Choose another
                  variant or inspect the model.
                </p>
              )}
              {path.artifacts.length > 2 ? (
                <p className="mt-2 text-[11px] text-muted">
                  + {path.artifacts.length - 2} more in the model detail
                </p>
              ) : null}
            </div>
            <footer className="mt-4 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <FamilyLogo
                  familyId={path.family.id}
                  familyName={path.family.name}
                  size={23}
                />
                <span className="truncate text-[11px] text-muted">
                  {path.family.vendor}
                </span>
              </span>
              <Link
                href={path.href}
                className="group inline-flex min-h-10 flex-none items-center gap-2 rounded-[7px] border border-line bg-paper px-3 text-[12px] font-semibold hover:border-ink"
              >
                Inspect this model
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={15}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </footer>
          </div>
        </>
      )}
    </section>
  );
}
