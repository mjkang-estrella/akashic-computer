"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, BookOpen02Icon } from "@hugeicons/core-free-icons";
import type { DocArticle } from "@/lib/atlas/docsArticles";
import { compareModelEntriesByRecency, type ModelEntry } from "@/lib/atlas/models";
import { MODEL_CATEGORIES } from "@/lib/atlas/taxonomy";
import { useCatalog } from "../CatalogProvider";
import { FamilyLogo } from "../FamilyLogo";
import { PRODUCT_DESTINATIONS, productTabClassName } from "../ProductNavigation";
import { comparisonExample } from "./comparisonExample";

type IntroGuide = Pick<DocArticle, "slug" | "title" | "readMinutes">;

const PREVIEWS = [
  PRODUCT_DESTINATIONS.discover,
  PRODUCT_DESTINATIONS.compare,
  PRODUCT_DESTINATIONS.learn,
] as const;
type PreviewId = typeof PREVIEWS[number]["id"];
const numberLabel = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

function PreviewLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold underline-offset-4 hover:underline">
      {children}
      <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}

function CatalogPreview({ entries, loading }: { entries: ModelEntry[]; loading: boolean }) {
  const sorted = [...entries].sort(compareModelEntriesByRecency);
  // Show a cross-section of the catalog without implying a quality ranking.
  const samples = ["language", "image-generation", "audio-speech"].flatMap((category) => {
    const entry = sorted.find((candidate) => candidate.category === category);
    return entry ? [entry] : [];
  });
  const visible = samples.concat(sorted.filter((entry) => !samples.includes(entry))).slice(0, 3);

  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">Models, downloadable weights, and the tools that run them.</p>
      <div className="mt-5" aria-busy={loading}>
        {loading ? (
          <div role="status" className="py-3">
            <span className="sr-only">Loading model preview</span>
            {[0, 1, 2].map((row) => <div key={row} className="flex h-20 items-center gap-4 border-b border-linesoft" aria-hidden="true"><span className="catalog-skeleton h-9 w-9 rounded-[6px]" /><span className="catalog-skeleton h-4 w-2/3 max-w-64 rounded-[4px]" /></div>)}
          </div>
        ) : visible.length ? (
          <ul className="divide-y divide-linesoft border-y border-line">
            {visible.map((entry) => (
              <li key={entry.slug}>
                <Link href={`/models/${entry.slug}`} className="group flex min-h-[88px] items-center gap-3 py-4 sm:gap-4" aria-label={`Explore ${entry.name}`}>
                  <FamilyLogo familyId={entry.family.id} familyName={entry.family.name} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[18px] font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">{entry.name}</span>
                    <span className="mt-1 block text-[12px] text-muted">{MODEL_CATEGORIES.find((category) => category.id === entry.category)?.label} <span aria-hidden="true">·</span> {entry.family.vendor}</span>
                  </span>
                  <span className="hidden max-w-[30%] flex-wrap justify-end gap-1.5 sm:flex">
                    {entry.quantizations.slice(0, 3).map((format) => <span key={format} className="rounded-[4px] bg-panel2 px-2 py-1 font-mono text-[11px] text-muted">{format}</span>)}
                  </span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="flex-none text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="py-12 text-[14px] text-muted">The model preview is unavailable. You can still explore the catalog or start with a guide.</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4">
        <PreviewLink href="/models">Browse the catalog</PreviewLink>
        {entries.length > 0 ? <span className="text-[12px] text-muted">{entries.length.toLocaleString("en-US")} model sizes</span> : null}
      </div>
    </>
  );
}

function ComparisonPreview({ entries, loading }: { entries: ModelEntry[]; loading: boolean }) {
  const { href, scenarios, maxWeights } = comparisonExample(entries);

  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">A larger model or more precision? See the memory tradeoff.</p>
      {scenarios.length === 2 ? (
        <div className="my-6 space-y-6" aria-label="Example weight comparison">
          {scenarios.map(({ model, bpw, weights }) => (
            <div key={model.slug}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-display text-[20px] font-semibold">{model.name}</span>
                <span className="font-mono text-[20px] font-medium tabular-nums">{numberLabel(weights)} GB</span>
              </div>
              <p className="mt-1 text-[12px] text-muted">EXL3 target · {bpw} bits per weight</p>
              <div className="mt-3 h-2 rounded-full bg-track" aria-hidden="true">
                <div className="h-full rounded-full bg-ink" style={{ width: `${weights / maxWeights * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="text-[12px] leading-relaxed text-muted">Estimated weights only. Model quality requires testing the exact checkpoints.</p>
        </div>
      ) : <p role="status" className="py-16 text-[14px] text-muted">{loading ? "Loading the comparison…" : "Choose two models in the comparison tool to explore the tradeoff."}</p>}
      <PreviewLink href={href ?? "/compare"}>{href ? "Open this comparison" : "Open comparison tool"}</PreviewLink>
    </>
  );
}

function LearningPreview({ guides }: { guides: IntroGuide[] }) {
  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">Build your understanding with practical guides and original sources.</p>
      <ul className="mt-5 divide-y divide-linesoft border-y border-line">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link href={`/docs/${guide.slug}`} className="group flex min-h-[88px] items-center gap-4 py-4">
              <HugeiconsIcon icon={BookOpen02Icon} size={24} strokeWidth={1.4} aria-hidden="true" className="flex-none text-muted" />
              <span className="min-w-0 flex-1 font-display text-[18px] font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">{guide.title}</span>
              <span className="flex-none text-[12px] text-muted">{guide.readMinutes} min</span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} aria-hidden="true" className="hidden flex-none text-muted sm:block" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3"><PreviewLink href="/docs">Explore the study hub</PreviewLink></div>
    </>
  );
}

export function ProductPreview({ guides }: { guides: IntroGuide[] }) {
  const { entries, loading } = useCatalog();
  const [active, setActive] = useState<PreviewId>("discover");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % PREVIEWS.length;
    else if (event.key === "ArrowLeft") next = (index + PREVIEWS.length - 1) % PREVIEWS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = PREVIEWS.length - 1;
    else return;
    event.preventDefault();
    setActive(PREVIEWS[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <section aria-label="Explore Akashic" className="overflow-hidden rounded-[12px] border border-line bg-panel">
      <div role="tablist" aria-label="Product preview" className="grid grid-cols-3 border-b border-line bg-paper/50 px-2 sm:px-6">
        {PREVIEWS.map((preview, index) => (
          <button key={preview.id} ref={(node) => { buttons.current[index] = node; }} type="button" role="tab" id={`preview-tab-${preview.id}`} aria-controls={`preview-panel-${preview.id}`} aria-selected={active === preview.id} tabIndex={active === preview.id ? 0 : -1} onClick={() => setActive(preview.id)} onKeyDown={(event) => moveTab(event, index)} className={productTabClassName(active === preview.id)}>
            <HugeiconsIcon icon={preview.icon} size={17} strokeWidth={1.7} aria-hidden="true" className="flex-none" />
            {preview.label}
          </button>
        ))}
      </div>
      {PREVIEWS.map((preview) => (
        <div key={preview.id} role="tabpanel" id={`preview-panel-${preview.id}`} aria-labelledby={`preview-tab-${preview.id}`} hidden={active !== preview.id} tabIndex={0} className="min-h-[400px] px-5 py-6 sm:min-h-[430px] sm:px-10 sm:py-8">
          {active === preview.id ? preview.id === "discover" ? <CatalogPreview entries={entries} loading={loading} /> : preview.id === "compare" ? <ComparisonPreview entries={entries} loading={loading} /> : <LearningPreview guides={guides} /> : null}
        </div>
      ))}
    </section>
  );
}
