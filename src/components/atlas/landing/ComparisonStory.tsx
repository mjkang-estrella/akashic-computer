"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useCatalog } from "../CatalogProvider";
import { modelReleaseName, parameterTotalLabel } from "@/lib/atlas/naming";
import { comparisonExample } from "./comparisonExample";

const numberLabel = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function ComparisonStory() {
  const { entries, loading } = useCatalog();
  const { href, scenarios } = comparisonExample(entries);
  const difference = scenarios.length === 2 ? Math.abs(scenarios[0].weights - scenarios[1].weights) : null;

  return (
    <section id="model-tradeoffs" aria-labelledby="model-tradeoffs-title" className="grid scroll-mt-8 items-center gap-10 border-t border-line py-16 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
      <div>
        <h2 id="model-tradeoffs-title" className="max-w-[15ch] text-balance font-display text-[36px] font-medium leading-[1.12] tracking-[-0.025em] sm:text-[44px]">More model, or more precision?</h2>
        <p className="mt-5 max-w-[38ch] text-[16px] leading-relaxed text-muted">A smaller model at higher precision can use less memory. See the tradeoff before you download.</p>
        <Link href={href ?? "/compare"} className="group mt-5 inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold underline-offset-4 hover:underline">
          {href ? "Compare these models" : "Explore comparisons"}
          <HugeiconsIcon icon={ArrowRight01Icon} size={17} strokeWidth={1.8} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
      <figure className="min-w-0 rounded-[12px] border border-line bg-panel p-5 sm:p-8" aria-busy={loading}>
        {scenarios.length === 2 ? (
          <>
            <div className="grid grid-cols-2 divide-x divide-line">
              {scenarios.map(({ model, bpw, weights }) => (
                <div key={model.slug} className="min-w-0 first:pr-4 last:pl-4 sm:first:pr-6 sm:last:pl-6">
                  <h3 className="font-display text-[20px] font-semibold leading-snug">{modelReleaseName(model.family, model.release)}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">{parameterTotalLabel(model.size)} parameters<br />{bpw} bits per weight</p>
                  <p className="mt-6 font-mono text-[clamp(1.2rem,3vw,2rem)] font-medium tracking-[-0.04em] tabular-nums">{numberLabel(weights)}<span className="ml-1 text-[12px] tracking-normal text-muted">GB</span></p>
                </div>
              ))}
            </div>
            <p className="mt-7 border-t border-line pt-5 text-[14px] leading-relaxed"><strong>{numberLabel(difference!)} GB</strong> difference in estimated weights.</p>
          </>
        ) : <p className="py-12 text-[14px] leading-relaxed text-muted">{loading ? "Loading the model comparison…" : "Open the comparison tool to choose two models and their precision."}</p>}
        <figcaption className="mt-3 text-[12px] leading-relaxed text-muted">EXL3 planning estimates. Runtime memory is additional; checkpoint availability and quality need verification.</figcaption>
      </figure>
    </section>
  );
}
