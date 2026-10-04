"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConvexAuth, useMutation, usePaginatedQuery, useQueries, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCatalog, useCatalogEntry } from "../atlas/CatalogProvider";
import { computerTemplates, defaultWorkload, defaultDeployment, deploymentMatchKey, compatibilityNotes, configurationId,
  type ComputerProfile, type WorkloadProfile, type DeploymentConfiguration } from "@/lib/atlas/deployments";
import { estimateDeploymentMemory, memoryBytesLabel } from "@/lib/atlas/memory";
import type { ArtifactBuild } from "@/lib/atlas/artifactBuilds";
import { compareEvidence, decodeMedian, fidelityLabel, median, type EvidenceReport } from "@/lib/atlas/evidence";
import { exportRecipe, vulkanB11146 } from "@/lib/atlas/recipeExports";
import { useDeploymentComparison, type Selection } from "./ComparisonProvider";
import { ArtifactBuildPicker } from "./ArtifactBuildPicker";
import { ComputerEditor, WorkloadEditor } from "./ProfileEditors";
import { AccountPanel, SignInComparison } from "./AccountPanel";
import { EvidenceSummary } from "./EvidenceLibrary";
import { ScenarioComparison } from "./ScenarioComparison";

import { comparisonEnabled } from "@/lib/atlas/comparisonFlags";
type SavedValue = { name: string; configurations: DeploymentConfiguration[]; rationale: string; evidenceIds: string[]; selectedConfigurationId?: string };
export function ComparisonRoute({ savedId }: { savedId?: string }) {
  const params = useSearchParams();
  if (!comparisonEnabled) return <section className="comparison-page"><h1>Deployment comparison</h1><p className="my-4">This feature is not enabled on this installation.</p></section>;
  if (params.get("mode") === "scenario" || params.has("left") || params.has("right")) return <>
    <Link className="my-4 inline-block underline" href="/compare">Compare exact deployments →</Link><ScenarioComparison />
  </>;
  return savedId ? <SavedComparison id={savedId} /> : <PublicComparison />;
}
function SavedComparison({ id }: { id: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const saved = useQuery(api.comparisons.get, isAuthenticated ? { id: id as Id<"comparisons"> } : "skip");
  if (isLoading) return <p role="status">Checking account…</p>;
  if (!isAuthenticated) return <div className="comparison-page"><SignInComparison /></div>;
  if (saved === undefined) return <p role="status">Loading your decision…</p>;
  if (!saved) return <div className="comparison-page"><h1>Comparison not found</h1><Link href="/compare">Start a comparison</Link></div>;
  return <BuildLoader key={id} keys={saved.configurations.map((d) => d.buildKey)} saved={saved} savedId={id as Id<"comparisons">} />;
}
function PublicComparison() {
  const params = useSearchParams(), { selections } = useDeploymentComparison();
  const keys = params.getAll("build").slice(0, 4);
  return keys.length ? <BuildLoader key={params.toString()} keys={keys} /> : <ComparisonEditor initial={selections} />;
}
function BuildLoader({ keys, saved, savedId }: { keys: string[]; saved?: SavedValue; savedId?: Id<"comparisons"> }) {
  const queries = useMemo(() => Object.fromEntries(keys.map((key, i) => [String(i), { query: api.artifactBuilds.get, args: { key } }])), [keys]);
  const results = useQueries(queries), { entries, loading } = useCatalog();
  if (loading || keys.some((_, i) => results[String(i)] === undefined)) return <p role="status">Loading pinned artifacts…</p>;
  const selections: Selection[] = [];
  keys.forEach((_, i) => {
    const build = results[String(i)] as ArtifactBuild | null | Error;
    if (!build || build instanceof Error) return;
    const model = entries.find((m) => m.slug === build.modelSlug || m.artifacts.some((a) => a.repo === build.repo));
    const configuration = saved?.configurations[i] ?? (model ? defaultDeployment(build.key, model.slug, build.repo, model.name + " · " + build.quantization) : null);
    if (configuration) selections.push({ build, configuration });
  });
  if (selections.length !== keys.length) return <section className="comparison-page"><h1>A pinned artifact is unavailable</h1>
    <p className="my-4">The saved decision has not been changed. Its source may be unavailable or catalog metadata may still be loading.</p><Link className="underline" href="/compare">Open a new comparison</Link></section>;
  return <ComparisonEditor initial={selections} saved={saved} savedId={savedId} />;
}

function ComparisonEditor({ initial, saved, savedId }: { initial: Selection[]; saved?: SavedValue; savedId?: Id<"comparisons"> }) {
  const { entries, materialChanges } = useCatalog(), { replace } = useDeploymentComparison();
  const [selections, setSelections] = useState(initial);
  const [name, setName] = useState(saved?.name ?? "My deployment decision"), [rationale, setRationale] = useState(saved?.rationale ?? "");
  const [selected, setSelected] = useState(saved?.selectedConfigurationId ?? "");
  const [evidenceIds, setEvidenceIds] = useState(saved?.evidenceIds ?? []);
  const [currentSavedId, setCurrentSavedId] = useState(savedId);
  const [chosenReports, setChosenReports] = useState<Record<string, EvidenceReport>>({});
  const [computer, setComputer] = useState<ComputerProfile>(initial[0]?.configuration.computer ?? computerTemplates.framework);
  const [workload, setWorkload] = useState<WorkloadProfile>(initial[0]?.configuration.workload ?? defaultWorkload);
  const [modelSlug, setModelSlug] = useState(""), [search, setSearch] = useState("");
  const [message, setMessage] = useState(""), [sort, setSort] = useState("selection"), [hideDeficits, setHideDeficits] = useState(false);
  const { isAuthenticated } = useConvexAuth(), save = useMutation(api.comparisons.save);
  const savedEvidence = useQuery(api.evidence.references, isAuthenticated ? { reportIds: evidenceIds } : "skip");
  const reports = isAuthenticated && savedEvidence !== undefined ? savedEvidence.map((r) => r.evidence) : Object.values(chosenReports);
  const applicable = (d: DeploymentConfiguration) => reports.filter((r) => r.buildKey === d.buildKey &&
    (r.kind === "fidelity" || (r.deployment && deploymentMatchKey(r.deployment) === deploymentMatchKey(d)))).reverse();
  useEffect(() => { replace(selections); }, [selections, replace]);
  const currentModel = entries.find((m) => m.slug === modelSlug);
  const models = entries.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  function applyComputer(p: ComputerProfile) {
    setComputer(p); setSelections((items) => items.map((s) => ({ ...s, configuration: { ...s.configuration, computer: p } })));
  }
  function applyWorkload(p: WorkloadProfile) {
    setWorkload(p); setSelections((items) => items.map((s) => ({ ...s, configuration: { ...s.configuration, workload: p,
      settings: { ...s.configuration.settings, contextTokens: p.contextTokens, concurrency: p.concurrency, thinking: p.thinking } } })));
  }
  function update(id: string, d: DeploymentConfiguration) {
    setSelections((items) => items.map((s) => s.configuration.id === id ? { ...s, configuration: d } : s));
  }
  function add(build: ArtifactBuild, slug: string, label: string) {
    setSelections((items) => items.length >= 4 || items.some((s) => s.build.key === build.key) ? items
      : [...items, { build, configuration: { ...defaultDeployment(build.key, slug, build.repo, label + " · " + build.quantization),
        computer, workload, settings: { ...defaultDeployment(build.key, slug, build.repo, label).settings,
          contextTokens: workload.contextTokens, concurrency: workload.concurrency, thinking: workload.thinking } } }]);
  }
  const visible = selections.filter((s) => !hideDeficits || (s.build.bytes ?? 0) <= s.configuration.workload.totalMemoryBytes);
  function sortMetric(s: Selection) {
    const evidence = applicable(s.configuration);
    if (sort === "decode") { const r = evidence.find((r) => r.kind === "performance"); return r ? -(decodeMedian(r) ?? -Infinity) : Infinity; }
    if (sort === "kld") return evidence.find((r) => r.fidelity?.kld !== undefined)?.fidelity?.kld ?? Infinity;
    const top1 = evidence.find((r) => r.fidelity?.top1)?.fidelity?.top1;
    return top1 ? -(top1.unit === "percent" ? top1.value : top1.value * 100) : Infinity;
  }
  const ordered = [...visible].sort((a, b) => sort === "bytes" ? (a.build.bytes ?? Infinity) - (b.build.bytes ?? Infinity)
    : sort === "name" ? a.configuration.label.localeCompare(b.configuration.label)
      : ["decode", "kld", "top1"].includes(sort) ? sortMetric(a) - sortMetric(b) : 0);
  // Assess each evidence class independently: a speed record must not hide a KLD mismatch.
  const assessments = selections.flatMap((a, i) => selections.slice(i + 1).flatMap((b) =>
    (["fidelity", "performance"] as const).flatMap((kind) => {
      const left = applicable(a.configuration).find((r) => r.kind === kind);
      const right = applicable(b.configuration).find((r) => r.kind === kind);
      return left && right ? [{ key: a.configuration.id + b.configuration.id + kind, kind,
        label: a.configuration.label + " ↔ " + b.configuration.label,
        result: compareEvidence(left, right, left.buildKey === right.buildKey ? "mtp" : "artifact") }] : [];
    })));
  const relevantChanges = materialChanges.filter((c) => selections.some((s) => s.configuration.modelSlug === c.modelSlug));
  return <section className="comparison-page">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-widest text-muted">For your computer</p>
      <h1>Compare deployments</h1></div><Link className="text-sm underline" href="/compare?mode=scenario">Explore hypothetical precision</Link></div>
    <p className="my-4 max-w-3xl text-sm leading-relaxed text-muted">Balance model capability, quantization fidelity, memory, context, and responsiveness. Use the evidence available; unknown results stay visible.</p>
    <details className="my-5 border-y border-line py-3" open={!selections.length}>
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">Add a model and exact quantization · {selections.length}/4 selected</summary>
      <div className="comparison-fields">
        <label>Find a model<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalog" /></label>
        <label>Model<select value={modelSlug} onChange={(e) => setModelSlug(e.target.value)}><option value="">Choose a model</option>
          {models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>
      </div>
      {currentModel ? [...new Set(currentModel.artifacts.map((a) => a.repo))].map((repo) => <ArtifactBuildPicker key={repo} repo={repo} modelSlug={currentModel.slug} modelName={currentModel.name} onAdd={add} />) : null}
    </details>
    <details className="my-5 border-y border-line py-3">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">{computer.name} · {workload.totalMemoryBytes / 1e9} GB total ceiling · {workload.contextTokens.toLocaleString()} token target</summary>
      <p className="text-xs text-muted">Changing these controls applies the profile to every selected option. Configuration details below retain their own runtime settings.</p>
      <ComputerEditor profile={computer} onChange={applyComputer} /><WorkloadEditor profile={workload} onChange={applyWorkload} />
    </details>
    <div className="flex flex-wrap items-center gap-5 text-sm">
      <label>Order <select className="comparison-button ml-2" value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="selection">Selection order</option><option value="bytes">Download bytes</option><option value="name">Model name</option>
        <option value="decode">Reported decode</option><option value="kld">Reported KLD</option><option value="top1">Reported Top-1 agreement</option>
      </select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={hideDeficits} onChange={(e) => setHideDeficits(e.target.checked)} />Hide known weight deficits</label>
      <button className="comparison-button" disabled={!selections.length} onClick={async () => {
        const p = new URLSearchParams();
        for (const s of selections) p.append("build", s.build.key);
        try { await navigator.clipboard.writeText(window.location.origin + "/compare?" + p); setMessage("Copied a public artifact shortlist. Personal profiles, settings, evidence and notes are excluded."); }
        catch { setMessage("Clipboard unavailable. Save this comparison to retain it."); }
      }}>Copy public shortlist</button>
    </div>
    {["decode", "kld", "top1"].includes(sort) ? <p className="my-3 text-xs text-muted">Sorting reported values does not align their protocols. Inspect the evidence before interpreting a difference. Unknowns sort last.</p> : null}
    {!selections.length ? <p className="comparison-status">Choose up to four exact files to start. You can also save profiles or import evidence below.</p> : null}
    <div className="comparison-columns">
      {ordered.map((s) => <ConfigurationCard key={s.configuration.id} selection={s} evidence={applicable(s.configuration)} onChange={(d) => update(s.configuration.id, d)}
        onRemove={() => { setSelections((items) => items.filter((item) => item.configuration.id !== s.configuration.id)); if (selected === s.configuration.id) setSelected(""); }}
        onDuplicate={selections.length < 4 ? () => setSelections((items) => [...items, { ...s, configuration: { ...s.configuration, id: configurationId(), label: s.configuration.label + " · alternative settings" } }]) : undefined}
        onEvidence={(reportId, report) => {
          setChosenReports((old) => ({ ...old, [reportId]: report }));
          setEvidenceIds((ids) => [...ids.filter((id) => id !== reportId), reportId]);
          if (report.deployment) update(s.configuration.id, { ...report.deployment, id: s.configuration.id, workload: s.configuration.workload });
        }} />)}
    </div>
    {assessments.length ? <section className="comparison-status" aria-label="Evidence alignment"><h2>Evidence alignment</h2>
      {assessments.map(({ key, kind, label, result }) => <details key={key} className="my-2">
        <summary className="min-h-11 cursor-pointer py-3"><strong>{kind === "fidelity" ? "Fidelity" : "Performance"}: {result.conclusion}</strong><span className="block text-xs text-muted">{label}</span></summary>
        {result.reasons.length ? <ul className="mt-2 list-disc pl-5">{result.reasons.map((s) => <li key={s}>{s}</li>)}</ul> : null}
      </details>)}</section> : null}
    {selections.length ? <section className="my-6 border-y border-line py-5">
      <h2>Save a decision</h2><p className="my-3 text-sm text-muted">Keep the exact configurations, constraints, evidence references, and your reasoning. Future updates will not replace these pins.</p>
      {evidenceIds.length ? <details className="my-3"><summary className="min-h-11 cursor-pointer py-3">Referenced evidence · {evidenceIds.length}</summary>
        {evidenceIds.map((id) => <div key={id} className="my-2 flex flex-wrap items-center gap-3 text-xs">
          <span>{savedEvidence?.find((r) => r.reportId === id)?.evidence.source.label ?? chosenReports[id]?.source.label ?? "Unavailable or withdrawn evidence"}</span>
          <button className="comparison-button" onClick={() => { setEvidenceIds((ids) => ids.filter((x) => x !== id)); setChosenReports((items) => Object.fromEntries(Object.entries(items).filter(([key]) => key !== id))); }}>Remove reference</button>
        </div>)}
      </details> : null}
      <div className="comparison-fields"><label>Comparison name<input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></label>
        <label>Selected deployment<select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Undecided</option>
          {selections.map((s) => <option key={s.configuration.id} value={s.configuration.id}>{s.configuration.label}</option>)}</select></label></div>
      <label className="comparison-label">Rationale<textarea rows={3} maxLength={5000} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="What matters for this choice, and what remains unknown?" /></label>
      <button className="comparison-button comparison-primary mt-4" disabled={!isAuthenticated} onClick={async () => {
        try { const id = await save({ id: currentSavedId, value: { name, configurations: selections.map((s) => s.configuration), rationale, evidenceIds,
          ...(selected ? { selectedConfigurationId: selected } : {}) } }); setCurrentSavedId(id); setMessage("Saved privately. Reopen this decision from Your saved work below."); }
        catch (e) { setMessage(e instanceof Error ? e.message : "Could not save."); }
      }}>{isAuthenticated ? "Save private decision" : "Sign in below to save"}</button>
    </section> : null}
    {message ? <p role="status" className="comparison-status">{message}</p> : null}
    {relevantChanges.length ? <details className="my-5"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Recent changes relevant to this comparison</summary>
      <ul className="space-y-3">{relevantChanges.map((c) => <li key={c.id}><a className="underline" href={c.sourceUrls[0]} target="_blank" rel="noreferrer">{c.title}</a><p className="text-xs text-muted">{c.dateLabel} · {c.summary}</p></li>)}</ul>
    </details> : null}
    <AccountPanel applyComputer={applyComputer} applyWorkload={applyWorkload} />
  </section>;
}

function ConfigurationCard({ selection: { build, configuration: d }, evidence, onChange, onRemove, onDuplicate, onEvidence }: {
  selection: Selection; evidence: EvidenceReport[]; onChange: (d: DeploymentConfiguration) => void; onRemove: () => void; onDuplicate?: () => void;
  onEvidence: (id: string, report: EvidenceReport) => void;
}) {
  const entry = useCatalogEntry(d.modelSlug), s = d.settings;
  const [recipe, setRecipe] = useState<Record<string, string> | null>(null), [error, setError] = useState("");
  const performance = evidence.find((r) => r.kind === "performance");
  const fidelity = evidence.filter((r) => r.kind === "fidelity");
  const trials = performance?.trials ?? [];
  const decode = performance ? decodeMedian(performance) : null;
  const ttft = median(trials.flatMap((t) => t.ttftSeconds === undefined ? [] : [t.ttftSeconds]));
  const prefill = median(trials.flatMap((t) => t.prefillTps === undefined ? [] : [t.prefillTps]));
  const exercised = trials.length ? Math.max(...trials.map((t) => t.promptTokens)) : undefined;
  const [recipeKey, setRecipeKey] = useState("");
  const estimate = estimateDeploymentMemory({ weightBytes: build.bytes, architecture: build.architecture,
    contextTokens: s.contextTokens, concurrency: s.concurrency, k: s.cacheK, v: s.cacheV,
    mtp: s.mtp !== "off", reserveBytes: d.workload.reserveBytes });
  const settings = (patch: Partial<DeploymentConfiguration["settings"]>) => onChange({ ...d, settings: { ...s, ...patch } });
  return <article className="comparison-option" aria-label={d.label}>
    <div className="flex items-start justify-between gap-2"><h2 className="break-words">{d.label}</h2>
      <button className="comparison-button" onClick={onRemove} aria-label={"Remove " + d.label}>×</button></div>
    <p className="mt-3 break-all font-mono text-xs">{build.repo}<br />{build.label}</p>
    <a className="my-2 inline-block text-xs underline" href={build.sourceUrl} target="_blank" rel="noreferrer">Revision {build.revision.slice(0, 12)}</a>
    <dl><div><dt>Download</dt><dd>{memoryBytesLabel(build.bytes)}</dd></div>
      <div><dt>Quantization</dt><dd>{build.quantization} · {build.container}</dd></div>
      <div><dt>Computer</dt><dd>{d.computer.name}</dd></div>
      <div><dt>Runtime</dt><dd>{d.runtime.name} {d.runtime.version} · {d.runtime.backend}</dd></div>
      <div><dt>Native context</dt><dd>{build.architecture?.nativeContext?.toLocaleString() ?? "Unknown"}</dd></div>
      <div><dt>Allocated target / slot</dt><dd>{s.contextTokens.toLocaleString()} tokens × {s.concurrency}</dd></div>
      <div><dt>Largest measured input</dt><dd>{exercised?.toLocaleString() ?? "Unknown"} tokens</dd></div>
      <div><dt>Fidelity evidence</dt><dd>{fidelity.length ? fidelity.map((r) => <p key={r.id}>{fidelityLabel(r)}<span className="block text-[11px] text-muted">{r.source.label}</span></p>) : "Unknown"}</dd></div>
      <div><dt>Measured decode</dt><dd>{decode === null ? "Unknown" : decode.toFixed(2) + " tok/s"}</dd></div>
      <div><dt>Prefill / TTFT</dt><dd>{prefill?.toFixed(1) ?? "Unknown"} input tok/s · {ttft?.toFixed(3) ?? "Unknown"} s</dd></div>
      {performance?.memory?.map((m, i) => <div key={i}><dt>{m.scope} memory {m.kind}</dt><dd>{memoryBytesLabel(m.bytes)}<span className="block text-[11px] text-muted">{m.method}</span></dd></div>)}
      <div><dt>Full-context quality</dt><dd>Not validated by allocation</dd></div>
      {estimate.components.map((c) => <div key={c.key}><dt>{c.label}</dt><dd>{memoryBytesLabel(c.bytes)}<span className="mt-1 block text-[11px] text-muted">{c.basis}</span></dd></div>)}
      <div><dt>Known subtotal</dt><dd>{memoryBytesLabel(estimate.knownSubtotalBytes)}<strong className="mt-1 block">Total requirement unknown</strong></dd></div>
    </dl>
    {performance ? <p className="my-3 text-xs text-muted">{performance.source.label} · {performance.protocol.aggregation.replaceAll("-", " ")}. {s.thinking === "on" ? "Generated thinking is included in throughput." : ""} {trials.some((t) => t.finishReason === "length") ? "Outputs reached the token limit; answer completion is unverified." : ""}</p> : null}
    {d.workload.desiredDecodeTps ? <p className="my-2 text-xs">Decode target {d.workload.desiredDecodeTps} tok/s: {decode === null ? "unknown" : decode >= d.workload.desiredDecodeTps ? "met on this recorded workload" : "below target on this recorded workload"}.</p> : null}
    {d.workload.desiredTtftSeconds ? <p className="my-2 text-xs">TTFT target {d.workload.desiredTtftSeconds} s: {ttft === null ? "unknown" : ttft <= d.workload.desiredTtftSeconds ? "met on this recorded workload" : "above target on this recorded workload"}.</p> : null}
    {s.contextTokens < d.workload.contextTokens ? <p className="comparison-status">Configured context is below the workload target.</p> : null}
    {build.architecture?.nativeContext && s.contextTokens > build.architecture.nativeContext ? <p className="comparison-status">Beyond native context. Extension support and filled-context behavior are unverified.</p> : null}
    {estimate.knownSubtotalBytes > d.workload.totalMemoryBytes ? <p className="comparison-status">Known components already exceed the {d.workload.totalMemoryBytes / 1e9} GB ceiling.</p> : null}
    {d.computer.pools.map((p) => p.accessibleBytes !== undefined && s.offload === "all" && estimate.knownSubtotalBytes > p.accessibleBytes
      ? <p key={p.id} className="text-xs text-muted">Inspect placement against the {memoryBytesLabel(p.accessibleBytes)} GPU-addressable limit. Not every component necessarily occupies that pool.</p> : null)}
    <ul className="list-disc space-y-1 pl-4 text-xs text-muted">{compatibilityNotes(d).map((n) => <li key={n}>{n}</li>)}</ul>
    <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Runtime and settings</summary>
      <ComputerEditor profile={d.computer} onChange={(computer) => onChange({ ...d, computer })} />
      <div className="comparison-fields">
        <label>Label<input value={d.label} onChange={(e) => onChange({ ...d, label: e.target.value })} /></label>
        <label>Runtime<input value={d.runtime.name} onChange={(e) => onChange({ ...d, runtime: { ...d.runtime, name: e.target.value } })} /></label>
        <label>Version<input value={d.runtime.version} onChange={(e) => onChange({ ...d, runtime: { ...d.runtime, version: e.target.value } })} /></label>
        <label>Runtime archive URL<input value={d.runtime.archiveUrl ?? ""} onChange={(e) => onChange({ ...d, runtime: { ...d.runtime, archiveUrl: e.target.value || undefined } })} /></label>
        <label>Runtime SHA-256<input value={d.runtime.archiveSha256 ?? ""} maxLength={64} onChange={(e) => onChange({ ...d, runtime: { ...d.runtime, archiveSha256: e.target.value || undefined } })} /></label>
        <label>Backend<select value={d.runtime.backend} onChange={(e) => onChange({ ...d, runtime: { ...d.runtime, backend: e.target.value as DeploymentConfiguration["runtime"]["backend"] } })}>
          {["unknown", "vulkan", "cuda", "rocm", "metal", "cpu"].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Binary platform<select value={d.runtime.platform} onChange={(e) => onChange({ ...d, runtime: { ...d.runtime, platform: e.target.value as DeploymentConfiguration["runtime"]["platform"] } })}>
          {["unknown", "linux-x64", "linux-arm64", "mac-arm64", "windows-x64"].map((v) => <option key={v}>{v}</option>)}</select></label>
        {(["cacheK", "cacheV", "draftCacheK", "draftCacheV"] as const).map((key) => <label key={key}>{key}
          <select value={s[key]} onChange={(e) => settings({ [key]: e.target.value })}>{["unknown", "bf16", "f16", "q8_0", "q4_0"].map((v) => <option key={v}>{v}</option>)}</select></label>)}
        <label>MTP<select value={s.mtp} onChange={(e) => settings({ mtp: e.target.value as typeof s.mtp, draftMax: e.target.value === "off" ? 0 : 3 })}>
          <option value="off">Off</option><option value="draft-mtp">MTP</option><option value="unknown">Unknown</option></select></label>
        <label>Draft maximum<input type="number" min="0" max="32" value={s.draftMax} onChange={(e) => settings({ draftMax: Number(e.target.value) })} /></label>
        <label>Thinking<select value={s.thinking} onChange={(e) => settings({ thinking: e.target.value as typeof s.thinking })}>{["on", "off", "unknown"].map((v) => <option key={v}>{v}</option>)}</select></label>
        {(["contextTokens", "concurrency", "temperature", "seed", "topP", "topK", "threads", "batch", "ubatch"] as const).map((key) => <label key={key}>{key}
          <input type="number" step={key === "temperature" || key === "topP" ? "0.01" : "1"} value={s[key] ?? ""} onChange={(e) => { if ((key === "contextTokens" || key === "concurrency") && Number(e.target.value) < 1) return; settings({ [key]: e.target.value ? Number(e.target.value) : undefined }); }} /></label>)}
        <label>Flash attention<select value={s.flashAttention} onChange={(e) => settings({ flashAttention: e.target.value as typeof s.flashAttention })}>{["unknown", "on", "off"].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Offload<select value={s.offload} onChange={(e) => settings({ offload: e.target.value as typeof s.offload })}>{["unknown", "all", "partial", "cpu"].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Chat template<input value={s.chatTemplate ?? ""} placeholder="embedded-jinja" onChange={(e) => settings({ chatTemplate: e.target.value || undefined })} /></label>
        <label>Reasoning format<select value={s.reasoningFormat ?? "unknown"} onChange={(e) => settings({ reasoningFormat: e.target.value as typeof s.reasoningFormat })}>{["unknown", "deepseek", "none"].map((v) => <option key={v}>{v}</option>)}</select></label>
      </div>
      <button className="comparison-button" onClick={() => onChange({ ...d, runtime: vulkanB11146, settings: { ...s,
        offload: "all", flashAttention: "on", threads: 16, batch: 2048, ubatch: 512, chatTemplate: "embedded-jinja", reasoningFormat: "deepseek" } })}>Use pinned b11146 Vulkan recipe settings</button>
      <p className="my-2 text-xs text-muted">Choosing settings does not establish compatibility or performance on this computer.</p>
    </details>
    <section className="comparison-evidence"><h3 className="font-semibold">Base-model capability</h3>
      <p className="my-2 text-xs text-muted">Published creator evidence; not tests of this quantized file.</p>
      {entry?.benchmarkRefs.length ? <ul className="space-y-2 text-xs">{entry.benchmarkRefs.map((b, i) => <li key={i}><a className="underline" href={b.sourceUrl} target="_blank" rel="noreferrer">{b.name}: {b.result}</a> · {b.sourceLabel}</li>)}</ul>
        : <p className="text-xs text-muted">No linked capability result.</p>}
    </section>
    <AvailableEvidence configuration={d} onUse={onEvidence} />
    <div className="mt-4 flex flex-wrap gap-2">
      {onDuplicate ? <button className="comparison-button" onClick={onDuplicate}>Compare other settings</button> : null}
      <button className="comparison-button" onClick={() => {
        try { setRecipe(exportRecipe(d, build, exercised)); setRecipeKey(JSON.stringify(d)); setError(""); } catch (e) { setRecipe(null); setError(e instanceof Error ? e.message : "Cannot export."); }
      }}>Prepare pinned export</button>
    </div>
    {error ? <p role="alert" className="comparison-status">{error}</p> : null}
    {recipe && recipeKey === JSON.stringify(d) ? <details open className="mt-4"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Review export files</summary>
      <p className="text-xs text-muted">Downloads contain configuration and instructions. Nothing is installed or changed.</p>
      {Object.entries(recipe).map(([filename, content]) => <details key={filename} className="my-2"><summary className="min-h-11 cursor-pointer py-2 font-mono text-xs">{filename}</summary>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">{content}</pre>
        <button className="comparison-button" onClick={() => {
          const url = URL.createObjectURL(new Blob([content], { type: "text/plain" })), a = document.createElement("a");
          a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download {filename}</button>
      </details>)}
    </details> : null}
  </article>;
}
function AvailableEvidence({ configuration, onUse }: { configuration: DeploymentConfiguration; onUse: (id: string, report: EvidenceReport) => void }) {
  const { isAuthenticated } = useConvexAuth();
  const published = usePaginatedQuery(api.evidence.listPublic, { buildKey: configuration.buildKey }, { initialNumItems: 10 });
  const own = usePaginatedQuery(api.evidence.listMine, isAuthenticated ? { buildKey: configuration.buildKey } : "skip", { initialNumItems: 10 });
  const results = [...new Map([...published.results, ...own.results].map((r) => [r.reportId, r])).values()];
  return <section className="comparison-evidence" aria-label="Artifact fidelity and performance">
    <h3 className="font-semibold">Fidelity and performance</h3>
    <details className="my-3"><summary className="min-h-11 cursor-pointer py-3 text-xs">Prepare an evidence import</summary>
      <p className="my-2 text-xs text-muted">These templates include this exact identity. Fill in measurements and source details before importing; blank results are unknown.</p>
      <div className="flex flex-wrap gap-2">{(["fidelity", "performance"] as const).map((kind) => <button className="comparison-button" key={kind} onClick={() => {
        const value = { schemaVersion: 2, id: "REPLACE_WITH_UNIQUE_REPORT_ID", kind,
          modelSlug: configuration.modelSlug, artifactRepo: configuration.artifactRepo, buildKey: configuration.buildKey,
          source: { label: "REPLACE_WITH_SOURCE", origin: "local_import", limitations: [] },
          protocol: { cache: "unknown", aggregation: "source-reported" },
          ...(kind === "fidelity" ? { fidelity: { kld: null } } : { deployment: configuration, trials: [] }) };
        const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })), a = document.createElement("a");
        a.href = url; a.download = kind + "-template.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Download {kind} template</button>)}</div>
    </details>
    {!results.length ? <p className="my-3 text-xs text-muted">No exact-artifact KLD, Top-1 agreement, or performance evidence available. You can keep this option and import existing evidence later.</p> : null}
    {results.map((r) => {
      const matching = r.evidence.deployment && deploymentMatchKey(r.evidence.deployment) === deploymentMatchKey(configuration);
      return <details key={r.reportId} className="my-3 border-t border-linesoft pt-2"><summary className="min-h-11 cursor-pointer py-3 text-xs">
        {r.evidence.source.label} · {r.evidence.kind === "fidelity" ? "Exact-artifact fidelity" : matching ? "Matching configuration" : "Other configuration"} · {r.published ? "Public" : "Private"}
      </summary><EvidenceSummary report={r.evidence} />
        <button className="comparison-button" onClick={() => onUse(r.reportId, r.evidence)}>{r.evidence.deployment ? "Use measured configuration" : "Reference this fidelity result"}</button>
      </details>;
    })}
    {published.status === "CanLoadMore" ? <button className="comparison-button" onClick={() => published.loadMore(10)}>More public evidence</button> : null}
    {own.status === "CanLoadMore" ? <button className="comparison-button" onClick={() => own.loadMore(10)}>More private evidence</button> : null}
  </section>;
}
