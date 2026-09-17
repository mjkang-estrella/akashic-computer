"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ModelEntry } from "@/lib/atlas/models";
import {
  comparisonHref, equalWeightBudgetBpw, glmComparisonHref, packedWeightGb,
  positiveNumber, scenarioBpw, scenarioFromParams, type QuantScenario,
} from "@/lib/atlas/comparison";
import { useAtlasUi } from "./AtlasShell";
import { useCatalog } from "./CatalogProvider";

const numberLabel = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const inputClass = "mt-2 min-h-11 w-full rounded-[7px] border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink";

function ScenarioCard({ side, scenario, entries, budget, onChange }: {
  side: "A" | "B"; scenario: QuantScenario; entries: ModelEntry[]; budget: number | null;
  onChange: (value: QuantScenario) => void;
}) {
  const model = entries.find((entry) => entry.slug === scenario.modelSlug);
  const bpw = scenarioBpw(scenario.bpw);
  const weights = model && bpw !== null ? packedWeightGb(model.size.paramsB, bpw) : null;
  const variantValid = !model || !scenario.variant || model.size.variants.includes(scenario.variant);
  return (
    <section aria-label={`Scenario ${side}`} className="min-w-0 rounded-[10px] border border-line bg-panel p-5 sm:p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[21px] font-semibold">Option {side}</h2>
        <span className="font-mono text-[10px] text-faint">EXL3</span>
      </header>
      <label className="mt-4 block text-[12px] font-semibold">
        Model
        <select aria-label={`Model ${side}`} value={scenario.modelSlug} onChange={(event) => onChange({ ...scenario, modelSlug: event.target.value, variant: "" })} className={inputClass}>
          <option value="">Choose a model</option>
          {scenario.modelSlug && !model ? <option value={scenario.modelSlug}>Unavailable model: {scenario.modelSlug}</option> : null}
          {entries.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.name}</option>)}
        </select>
      </label>
      {model ? <label className="mt-3 block text-[12px] font-semibold">
        Variant
        <select aria-label={`Variant ${side}`} value={scenario.variant || model.size.variants[0] || ""} onChange={(event) => onChange({ ...scenario, variant: event.target.value })} className={inputClass}>
          {!variantValid ? <option value={scenario.variant}>Unavailable variant: {scenario.variant}</option> : null}
          {model.size.variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
        </select>
      </label> : null}
      <label className="mt-3 block text-[12px] font-semibold">
        Bits per weight
        <input aria-label={`Target bits per weight ${side}`} type="number" min="0.01" max="16" step="0.01" value={scenario.bpw} onChange={(event) => onChange({ ...scenario, bpw: event.target.value })} className={inputClass} />
      </label>
      {bpw === null ? <p role="alert" className="mt-2 text-[12px] text-caution">Enter a target above 0 and at most 16 bpw.</p> : null}
      {!variantValid ? <p role="alert" className="mt-2 text-[12px] text-caution">Choose a published variant before comparing.</p> : null}
      {scenario.modelSlug && !model ? <p role="alert" className="mt-2 text-[12px] text-caution">This model is no longer in the published catalog. Choose another model.</p> : null}
      {model && variantValid ? <>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
          <div><dt className="text-[11px] text-muted">Total parameters</dt><dd className="mt-1 font-mono text-[18px]">{numberLabel(model.size.paramsB)}B</dd></div>
          <div><dt className="text-[11px] text-muted">Active parameters</dt><dd className="mt-1 font-mono text-[18px]">{model.size.activeParamsB ? `${numberLabel(model.size.activeParamsB)}B` : model.size.isMoe ? "Unknown" : "Not reported"}</dd></div>
        </dl>
        <div className="mt-5 rounded-[7px] bg-paper p-4">
          <p className="text-[11px] text-muted">Estimated packed weights</p>
          <p className="mt-1 font-mono text-[30px] font-semibold tabular-nums">{weights !== null ? `${numberLabel(weights)} GB` : "—"}</p>
          {weights !== null && budget !== null ? <p className="mt-3 text-[12px] font-semibold">
            {weights > budget ? `${numberLabel(weights - budget)} GB above the weight budget` : `${numberLabel(budget - weights)} GB left in the weight budget`}
          </p> : null}
        </div>
        <Link href={`/models/${model.slug}?variant=${encodeURIComponent(scenario.variant || model.size.variants[0] || "")}`} className="mt-3 inline-flex min-h-11 items-center text-[12px] font-semibold underline underline-offset-4">Model evidence →</Link>
      </> : <p className="mt-5 text-[13px] text-muted">Choose a model to explore its size and precision tradeoff.</p>}
    </section>
  );
}

function ComparisonWorkspace({ initialLeft, initialRight, initialBudget }: {
  initialLeft: QuantScenario; initialRight: QuantScenario; initialBudget: string;
}) {
  const { entries, loading } = useCatalog();
  const { rig } = useAtlasUi();
  const [left, setLeft] = useState(initialLeft);
  const [right, setRight] = useState(initialRight);
  const [budgetInput, setBudgetInput] = useState(initialBudget);
  const [copyStatus, setCopyStatus] = useState("");
  const candidates = entries.filter((entry) => entry.category === "language" && Number.isFinite(entry.size.paramsB) && entry.size.paramsB > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const a = candidates.find((entry) => entry.slug === left.modelSlug);
  const b = candidates.find((entry) => entry.slug === right.modelSlug);
  const aBits = scenarioBpw(left.bpw), bBits = scenarioBpw(right.bpw);
  const validVariant = (model: ModelEntry, variant: string) => !variant || model.size.variants.includes(variant);
  const aWeights = a && aBits !== null && validVariant(a, left.variant) ? packedWeightGb(a.size.paramsB, aBits) : null;
  const bWeights = b && bBits !== null && validVariant(b, right.variant) ? packedWeightGb(b.size.paramsB, bBits) : null;
  const budget = positiveNumber(budgetInput);
  const href = comparisonHref(
    { ...left, variant: left.variant || a?.size.variants[0] || "" },
    { ...right, variant: right.variant || b?.size.variants[0] || "" }, budgetInput,
  );
  const example = glmComparisonHref(entries);
  const showExample = example && href.split("&budget=")[0] !== example.split("&budget=")[0];
  const sameModel = a?.slug === b?.slug && (left.variant || a?.size.variants[0]) === (right.variant || b?.size.variants[0]);
  const larger = a && b && a.size.paramsB !== b.size.paramsB ? a.size.paramsB > b.size.paramsB ? a : b : null;
  const higher = aBits !== null && bBits !== null && aBits !== bBits ? aBits > bBits ? "A" : "B" : null;
  const higherPrecisionPercent = aBits !== null && bBits !== null && higher
    ? (Math.max(aBits, bBits) / Math.min(aBits, bBits) - 1) * 100
    : null;
  const update = (setter: (value: QuantScenario) => void, value: QuantScenario) => { setter(value); setCopyStatus(""); };
  return (
    <section className="py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <h1 className="font-display text-[34px] font-semibold leading-tight sm:text-[46px]">More model or more precision?</h1>
        <Link href="/docs/paths/quantization" className="inline-flex min-h-11 items-center text-[12px] font-semibold underline underline-offset-4">How to compare →</Link>
      </header>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {showExample ? <Link href={example} className="inline-flex min-h-11 items-center rounded-[7px] border border-line px-4 text-[12px] font-semibold hover:border-ink">Try GLM-5.3 vs Flash</Link> : null}
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(new URL(href, window.location.origin).href); setCopyStatus("Link copied"); }
          catch { setCopyStatus("Copy unavailable. Use the comparison link."); }
        }} className="min-h-11 rounded-[7px] bg-ink px-4 text-[12px] font-semibold text-paper">Copy link</button>
        <Link href={href} className="inline-flex min-h-11 items-center text-[12px] text-muted underline underline-offset-4">Open saved view</Link>
        <span role="status" className="text-[12px] text-muted">{copyStatus}</span>
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-3 border-y border-line py-4">
        <label className="text-[12px] font-semibold">Weight budget (GB)
          <input aria-label="Weight budget (GB)" type="number" min="0.01" step="0.01" value={budgetInput} onChange={(event) => { setBudgetInput(event.target.value); setCopyStatus(""); }} placeholder="Optional" className={`${inputClass} max-w-[200px] block`} />
        </label>
        <button type="button" onClick={() => { setBudgetInput(String(rig.gb)); setCopyStatus(""); }} className="min-h-11 rounded-[7px] border border-line px-3 text-[12px] font-semibold">Use {rig.gb} GB as ceiling</button>
        {budgetInput.trim() && budget === null ? <p role="alert" className="text-[12px] text-caution">Enter a positive, finite weight budget.</p> : null}
      </div>
      {loading ? <p role="status" className="mt-7 text-muted">Loading published models…</p> : <div className="mt-6 grid gap-5 md:grid-cols-2">
        <ScenarioCard side="A" scenario={left} entries={candidates} budget={budget} onChange={(value) => update(setLeft, value)} />
        <ScenarioCard side="B" scenario={right} entries={candidates} budget={budget} onChange={(value) => update(setRight, value)} />
      </div>}
      {a && b && aWeights !== null && bWeights !== null ? <section aria-label="Comparison tradeoffs" className="mt-6 rounded-[10px] border border-ink bg-paper p-5 sm:p-6">
        <h2 className="font-display text-[23px] font-semibold">The tradeoff</h2>
        <p className="mt-3 max-w-[76ch] text-[15px] leading-relaxed">
          {sameModel
            ? "The model stays fixed, so this comparison isolates the entered precision."
            : larger
              ? `${larger.name} is the larger model by total parameters.`
              : "The models have the same total parameter count."}
          {higher && higherPrecisionPercent !== null ? ` Option ${higher} uses ${numberLabel(higherPrecisionPercent)}% more bits per weight.` : " Both options use the same bits per weight."}
        </p>
        <div className="mt-5 grid gap-4 border-y border-line py-4 sm:grid-cols-2">
          <div><p className="text-[11px] text-muted">Packed-weight difference</p><p className="mt-1 font-mono text-[17px] font-semibold">{aWeights === bWeights ? "Equal" : `${numberLabel(Math.abs(aWeights - bWeights))} GB more for ${aWeights > bWeights ? "A" : "B"}`}</p></div>
          <div><p className="text-[11px] text-muted">A’s weight budget applied to B</p><p className="mt-1 font-mono text-[17px] font-semibold">{numberLabel(equalWeightBudgetBpw(b.size.paramsB, aWeights)!)} bpw</p></div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted"><strong className="text-ink">No quality verdict.</strong> Test the exact checkpoints on the same tasks and hardware.</p>
      </section> : null}
      <details className="mt-6 border-y border-line py-4 text-[12px] text-muted">
        <summary className="min-h-11 cursor-pointer font-semibold text-ink">Method and limits</summary>
        <p className="mt-3 max-w-[85ch] leading-relaxed">Packed weights = published total parameters × target bpw ÷ 8, in decimal GB. This estimate excludes mixed-precision layers, scales, padding, metadata, KV cache, workspace, and runtime buffers. MoE active parameters do not reduce stored expert weights. Target bpw can differ from effective bitrate and artifact size; parameter counts do not predict speed or quality.</p>
        <a href="https://github.com/turboderp-org/exllamav3/blob/master/doc/convert.md" target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center underline underline-offset-4">EXL3 conversion settings ↗</a>
      </details>
    </section>
  );
}

export function ComparisonRoute() {
  const params = useSearchParams();
  // A shared URL and browser back/forward start a fresh workspace with those assumptions.
  return <ComparisonWorkspace key={params.toString()} initialLeft={scenarioFromParams(params, "left")} initialRight={scenarioFromParams(params, "right")} initialBudget={params.get("budget") ?? ""} />;
}
