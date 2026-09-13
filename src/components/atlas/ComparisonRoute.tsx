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
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Scenario {side} · EXL3</p>
      <label className="mt-4 block text-[12px] font-semibold">
        Model {side}
        <select value={scenario.modelSlug} onChange={(event) => onChange({ ...scenario, modelSlug: event.target.value, variant: "" })} className={inputClass}>
          <option value="">Choose a model</option>
          {scenario.modelSlug && !model ? <option value={scenario.modelSlug}>Unavailable model: {scenario.modelSlug}</option> : null}
          {entries.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.name}</option>)}
        </select>
      </label>
      {model ? <label className="mt-3 block text-[12px] font-semibold">
        Variant {side}
        <select value={scenario.variant || model.size.variants[0] || ""} onChange={(event) => onChange({ ...scenario, variant: event.target.value })} className={inputClass}>
          {!variantValid ? <option value={scenario.variant}>Unavailable variant: {scenario.variant}</option> : null}
          {model.size.variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
        </select>
      </label> : null}
      <label className="mt-3 block text-[12px] font-semibold">
        Target bits per weight {side}
        <input type="number" min="0.01" max="16" step="0.01" value={scenario.bpw} onChange={(event) => onChange({ ...scenario, bpw: event.target.value })} className={inputClass} />
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
          <p className="text-[11px] text-muted">Packed weight proxy · decimal GB</p>
          <p className="mt-1 font-mono text-[30px] font-semibold tabular-nums">{weights !== null ? `${numberLabel(weights)} GB` : "—"}</p>
          <p className="mt-1 text-[11px] text-muted">Total parameters × entered bpw ÷ 8. Not a measured checkpoint size.</p>
          {weights !== null && budget !== null ? <p className="mt-3 text-[12px] font-semibold">
            {weights > budget ? `${numberLabel(weights - budget)} GB above the weight budget` : `${numberLabel(budget - weights)} GB left in the weight budget`}
          </p> : null}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">{model.size.isMoe ? "MoE active parameters do not represent all stored expert weights. " : ""}Exact EXL3 checkpoint availability, effective bpw, quality and speed are unverified for this scenario.</p>
        <Link href={`/models/${model.slug}?variant=${encodeURIComponent(scenario.variant || model.size.variants[0] || "")}`} className="mt-4 inline-flex min-h-11 items-center text-[12px] font-semibold underline underline-offset-4">View model evidence →</Link>
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
  const sameModel = a?.slug === b?.slug && (left.variant || a?.size.variants[0]) === (right.variant || b?.size.variants[0]);
  const larger = a && b && a.size.paramsB !== b.size.paramsB ? a.size.paramsB > b.size.paramsB ? a : b : null;
  const higher = aBits !== null && bBits !== null && aBits !== bBits ? aBits > bBits ? "A" : "B" : null;
  const update = (setter: (value: QuantScenario) => void, value: QuantScenario) => { setter(value); setCopyStatus(""); };
  return (
    <section className="py-8 sm:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Model × quantization</p>
      <h1 className="mt-3 font-display text-[34px] font-semibold leading-tight sm:text-[46px]">More model or more precision?</h1>
      <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-muted">Compare a larger model at lower bpw with a smaller model at higher bpw. See the weight tradeoff, then check evidence for the tasks you care about.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {example ? <Link href={example} className="inline-flex min-h-11 items-center rounded-[7px] border border-line px-4 text-[12px] font-semibold hover:border-ink">Try GLM-5.3 2.75 vs Flash 3 bpw</Link> : null}
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(new URL(href, window.location.origin).href); setCopyStatus("Link copied"); }
          catch { setCopyStatus("Copy unavailable. Use the comparison link."); }
        }} className="min-h-11 rounded-[7px] bg-ink px-4 text-[12px] font-semibold text-paper">Copy comparison link</button>
        <Link href={href} className="inline-flex min-h-11 items-center text-[12px] text-muted underline underline-offset-4">Comparison link</Link>
        <span role="status" className="text-[12px] text-muted">{copyStatus}</span>
      </div>
      <div className="mt-7 flex flex-wrap items-end gap-3 rounded-[8px] border border-line bg-panel p-4">
        <label className="text-[12px] font-semibold">Weight budget (GB)
          <input aria-label="Weight budget (GB)" type="number" min="0.01" step="0.01" value={budgetInput} onChange={(event) => { setBudgetInput(event.target.value); setCopyStatus(""); }} placeholder="Optional" className={`${inputClass} max-w-[200px] block`} />
        </label>
        <button type="button" onClick={() => { setBudgetInput(String(rig.gb)); setCopyStatus(""); }} className="min-h-11 rounded-[7px] border border-line px-3 text-[12px] font-semibold">Use {rig.gb} GB as ceiling</button>
        <p className="basis-full text-[11px] text-muted">Weights only. Reserve additional memory for KV cache, workspace and runtime overhead. Combined device memory does not verify that a model can run.</p>
        {budgetInput.trim() && budget === null ? <p role="alert" className="text-[12px] text-caution">Enter a positive, finite weight budget.</p> : null}
      </div>
      {loading ? <p role="status" className="mt-7 text-muted">Loading published models…</p> : <div className="mt-6 grid gap-5 md:grid-cols-2">
        <ScenarioCard side="A" scenario={left} entries={candidates} budget={budget} onChange={(value) => update(setLeft, value)} />
        <ScenarioCard side="B" scenario={right} entries={candidates} budget={budget} onChange={(value) => update(setRight, value)} />
      </div>}
      {a && b && aWeights !== null && bWeights !== null ? <section aria-label="Comparison tradeoffs" className="mt-6 rounded-[10px] border border-ink bg-paper p-5 sm:p-6">
        <h2 className="font-display text-[23px] font-semibold">What this tradeoff tells you</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div><h3 className="text-[12px] font-semibold">Model scale</h3><p className="mt-2 text-[13px] leading-relaxed text-muted">{sameModel ? "Same catalog model and variant; this isolates the entered precision assumption." : larger ? `${larger.name} has more total parameters. That does not establish a task-quality advantage after quantization.` : "Different model identities at the same parameter count. Their architecture and training still matter."}</p></div>
          <div><h3 className="text-[12px] font-semibold">Quantization precision</h3><p className="mt-2 text-[13px] leading-relaxed text-muted">{higher ? `Scenario ${higher} allocates ${numberLabel((Math.max(aBits!, bBits!) / Math.min(aBits!, bBits!) - 1) * 100)}% more target bits per weight. ` : "Both scenarios use the same target bpw. "}Higher target bpw is not proof of better overall model quality; conversion recipes and calibration also matter.</p></div>
          <div><h3 className="text-[12px] font-semibold">Weight cost</h3><p className="mt-2 text-[13px] leading-relaxed text-muted">{aWeights === bWeights ? "Both scenarios have the same packed weight proxy." : `Scenario ${aWeights > bWeights ? "A" : "B"} uses approximately ${numberLabel(Math.abs(aWeights - bWeights))} GB more packed weights.`} Actual files include mixed-precision layers and quantization overhead.</p></div>
        </div>
        {aWeights > 0 && bWeights > 0 ? <p className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed">At A’s {numberLabel(aWeights)} GB packed weight budget, B would have an equivalent uniform-packing budget of <strong>{numberLabel(equalWeightBudgetBpw(b.size.paramsB, aWeights)!)} bpw</strong>. This is a mathematical budget, not an available EXL3 conversion.</p> : null}
        <p className="mt-4 text-[13px] leading-relaxed text-muted">Quality verdict: unverified. To choose a winner, compare the exact checkpoints on the same tasks, prompts, generation settings and context. Measure speed on the same hardware and runtime. Reference-model scores do not measure these quantizations.</p>
      </section> : null}
      <details className="mt-6 border-y border-line py-4 text-[12px] text-muted">
        <summary className="cursor-pointer font-semibold text-ink">How these estimates work</summary>
        <p className="mt-3 max-w-[85ch] leading-relaxed">The planner uses published total parameter counts and your target bpw in decimal GB (1 GB = 10⁹ bytes). Uniform packing does not account for embeddings or other layers stored at different precision, scales, padding or metadata. KV cache and runtime buffers are excluded. Target bpw can differ from the effective bitrate and actual artifact size. Neither parameter count nor active parameters predict tokens per second.</p>
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
