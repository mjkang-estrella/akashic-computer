"use client";
import { useState } from "react";
import Link from "next/link";
import { memoryBytesLabel } from "@/lib/atlas/memory";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { parseEvidenceImport, decodeMedian, fidelityLabel, publicationProjection, type EvidenceReport } from "@/lib/atlas/evidence";

export function EvidenceSummary({ report }: { report: EvidenceReport }) {
  const decode = decodeMedian(report);
  const trials = report.trials ?? [];
  return <div className="space-y-2 text-xs">
    <p className="font-semibold">{report.source.label}</p>
    <p>{report.kind === "fidelity" ? fidelityLabel(report) :
      (decode === null ? "Decode unknown" : decode.toFixed(2) + " decode tok/s") + " · " + trials.length + " trials · " + report.protocol.aggregation.replaceAll("-", " ")}</p>
    {report.kind === "performance" ? <>
      <p>Allocated: {report.deployment?.settings.contextTokens.toLocaleString()} · Largest input: {Math.max(0, ...trials.map((t) => t.promptTokens)).toLocaleString()} tokens</p>
      <p>Thinking: {report.deployment?.settings.thinking} · MTP: {report.deployment?.settings.mtp} / {report.deployment?.settings.draftMax}</p>
      <p>Prefill: {trials.some((t) => t.prefillSeconds !== undefined) ? trials.map((t) => t.prefillSeconds?.toFixed(3) ?? "unknown").join(", ") + " s" : "Unknown"} · TTFT: {trials.some((t) => t.ttftSeconds !== undefined) ? trials.map((t) => t.ttftSeconds?.toFixed(3) ?? "unknown").join(", ") + " s" : "Unknown"}</p>
      {trials.some((t) => t.finishReason === "length") ? <p>Output reached the token limit. Throughput does not establish answer correctness or completion.</p> : null}
    </> : <p>Fidelity to a reference distribution; not a task-quality score.</p>}
    {report.memory?.map((m, i) => <p key={i}>{m.scope} memory {m.kind}: {memoryBytesLabel(m.bytes)} · {m.method}</p>)}
    {report.source.url ? <a className="underline" href={report.source.url} target="_blank" rel="noreferrer">Evidence source</a> : null}
    <details><summary className="min-h-11 cursor-pointer py-3">Protocol and limitations</summary>
      <ul className="list-disc pl-4">{report.source.limitations.map((s, i) => <li key={i}>{s}</li>)}</ul>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify({ protocol: report.protocol, fidelity: report.fidelity, trials: report.trials, memory: report.memory }, null, 2)}</pre>
    </details>
  </div>;
}
export function EvidenceLibrary() {
  const [text, setText] = useState(""), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const preview = text.trim() ? parseEvidenceImport(text) : { reports: [], errors: [] };
  const { results, status: loadStatus, loadMore } = usePaginatedQuery(api.evidence.listMine, {}, { initialNumItems: 10 });
  const commit = useMutation(api.evidence.importBatch), consent = useMutation(api.evidence.consentToPublication),
    withdraw = useMutation(api.evidence.withdrawPublication), remove = useMutation(api.evidence.remove);
  const identity = useQuery(api.workspace.identity);
  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setStatus("");
    try { await action(); setStatus(success); } catch (e) { setStatus(e instanceof Error ? e.message : "Could not save evidence."); }
    finally { setBusy(false); }
  }
  return <section className="my-6 border-t border-line pt-6" aria-label="Private evidence library">
    <h2>Evidence library</h2>
    <p className="my-3 text-sm text-muted">Import existing KLD, Top-1 agreement, or performance records. Imports are private; no benchmark run is needed.</p>
    <label className="comparison-label">Choose JSON files<input type="file" accept=".json,application/json" onChange={async (e) => {
      const file = e.target.files?.[0];
      if (file) { if (file.size > 1_048_576) { setStatus("Import exceeds 1 MiB."); return; } setText(await file.text()); }
    }} /></label>
    <label className="comparison-label mt-3">Or paste report JSON<textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Version 2 evidence JSON" /></label>
    <p className="my-3 text-xs text-muted">Up to 100 reports / 1 MiB per batch. <Link className="underline" href="/docs/deployment-comparison">Import format and comparison guide</Link></p>
    {preview.errors.length ? <ul role="alert" className="my-3 list-disc pl-5 text-sm">{preview.errors.map((s) => <li key={s}>{s}</li>)}</ul> : null}
    {preview.reports.length ? <div className="my-3 space-y-3" aria-label="Import preview">
      <p className="font-semibold">{preview.reports.length} reports ready for your private account</p>
      {preview.reports.map((r) => <div key={r.id} className="border-l border-line pl-3"><EvidenceSummary report={r} /></div>)}
    </div> : null}
    <button className="comparison-button comparison-primary" disabled={busy || !preview.reports.length || !!preview.errors.length}
      onClick={() => void act(async () => { const r = await commit({ json: JSON.stringify(preview.reports) }); setText(""); return r; }, "Import saved privately. Existing identical reports were preserved.")}>Import privately</button>
    {status ? <p role="status" className="comparison-status">{status}</p> : null}
    <div className="mt-5 space-y-4">
      {results.map((r) => <article key={r.reportId} className="comparison-option">
        <p className="mb-2 text-xs text-muted">{r.published ? "Published" : r.consented ? "Awaiting publication review" : "Private"} · {r.evidence.artifactRepo}</p>
        <EvidenceSummary report={r.evidence} />
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Review publication preview</summary>
          <p className="text-xs">This exact preview includes hardware and protocol details. Submitting authorizes an administrator to publish it.</p>
          <pre className="my-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(publicationProjection({ ...r.evidence, id: r.reportId }), null, 2)}</pre>
          <button className="comparison-button" disabled={busy || r.consented} onClick={() => void act(() => consent({ reportId: r.reportId }), "Submitted for publication review.")}>Submit this preview for publication</button>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          {r.consented ? <button className="comparison-button" disabled={busy} onClick={() => void act(() => withdraw({ reportId: r.reportId }), "Public projection withdrawn; your private report remains.")}>Withdraw publication</button> : null}
          <button className="comparison-button" disabled={busy} onClick={() => void act(() => remove({ reportId: r.reportId }), "Report removed.")}>Delete report</button>
        </div>
      </article>)}
    </div>
    {loadStatus === "CanLoadMore" ? <button className="comparison-button mt-4" onClick={() => loadMore(10)}>More reports</button> : null}
    {identity?.role === "admin" ? <PublicationQueue /> : null}
  </section>;
}
function PublicationQueue() {
  const { results, status, loadMore } = usePaginatedQuery(api.evidence.publicationQueue, {}, { initialNumItems: 10 });
  const publish = useMutation(api.evidence.publish), [message, setMessage] = useState("");
  return <section className="mt-6"><h2>Publication review</h2>
    {results.map((r) => <details key={r.reportId} className="my-3 border-t border-line py-3">
      <summary className="min-h-11 cursor-pointer">{r.evidence.source.label}</summary>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(r.evidence, null, 2)}</pre>
      <button className="comparison-button" onClick={() => void publish({ reportId: r.reportId }).then(() => setMessage("Published the consented projection.")).catch((e) => setMessage(e.message))}>Publish reviewed projection</button>
    </details>)}
    {!results.length ? <p className="text-sm text-muted">No consented reports awaiting review.</p> : null}
    {status === "CanLoadMore" ? <button className="comparison-button" onClick={() => loadMore(10)}>More submissions</button> : null}
    <p role="status">{message}</p>
  </section>;
}
