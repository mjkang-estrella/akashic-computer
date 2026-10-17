import Link from "next/link";
const example = {
  schemaVersion: 2, id: "my-source-result-1", modelSlug: "REPLACE_WITH_CATALOG_SLUG",
  artifactRepo: "provider/model-repository", kind: "fidelity",
  source: { label: "Replace with source and date", origin: "published", url: "https://example.com/report",
    limitations: ["Example only: replace the identity and measurements before importing."] },
  protocol: { cache: "unknown", aggregation: "source-reported", referenceRepo: "creator/reference-checkpoint",
    referenceRevision: "REPLACE_WITH_REFERENCE_REVISION", dataset: "REPLACE_WITH_DATASET",
    kldDirection: "reference-to-quant" },
  fidelity: { kld: 0.006, top1: { value: 98.2, unit: "percent" } },
};
export default function ComparisonGuide() {
  return <article className="comparison-page mx-auto max-w-3xl space-y-6 text-sm leading-relaxed">
    <h1>Compare for your computer</h1>
    <p>Select exact files, set your computer and workload, then compare the available evidence. You can save an undecided shortlist with missing measurements.</p>
    <h2>Read three kinds of evidence</h2>
    <p>Base-model benchmarks describe the published checkpoint. KLD and Top-1 agreement describe how a quantization follows a reference distribution. Performance records describe a particular computer, runtime, settings, and workload. These answer different questions; no one number measures all three.</p>
    <p>You do not need to benchmark every quantization. Existing fidelity reports are useful even without deployment tests. Missing KLD, speed, or task results stay unknown. Compare KLD or Top-1 values directly only when reference, dataset, tokenizer, and evaluation protocol align.</p>
    <h2>Memory and context</h2>
    <p>Download bytes, main KV cache, recurrent state, draft state, runtime buffers, and your reserve are separate components. A known subtotal is not a confirmed total requirement. Shared RAM and GPU-addressable memory can have different limits. Context is per slot; concurrency multiplies the estimated cache.</p>
    <p>Allocated context is a configuration. Largest measured input is an observation. Neither establishes full-context retrieval quality, stability, or support beyond the checkpoint’s native context.</p>
    <h2>Import existing evidence</h2>
    <p>Sign in, then paste one JSON report or an array in the private evidence library. Review the preview before importing. Each report needs a unique ID within your account. Importing identical content again is safe; changing an existing ID’s content is rejected. Use a new ID for a correction.</p>
    <p>The example below is fictional. Replace the source, subject, and values. You can include KLD, Top-1, or both. State whether Top-1 uses percent or fraction. Omit unknown fields; never encode missing data as zero.</p>
    <pre className="overflow-x-auto rounded border border-line p-4 text-xs">{JSON.stringify(example, null, 2)}</pre>
    <p>To attach fidelity to an exact file, add its <code>buildKey</code> from the selected option’s evidence template. Without that key, a report remains in your library as repository-level context and will not be attributed to a specific quantization.</p>
    <p>For performance, start with the selected configuration template, set <code>kind</code> to <code>performance</code>, and provide trials with prompt and generated token counts. Prefill, decode, time to first token, and whole-request latency are independent fields. Memory uses <code>kind: snapshot</code> or <code>kind: peak</code> and an explicit system/process/GPU scope. A peak requires a sampling interval and duration.</p>
    <p>Imports allow up to 100 reports and 1 MiB per batch, with at most 64 KiB per report. Your evidence stays private unless you review its public projection, explicitly submit it, and an administrator publishes it. Withdrawal removes that public projection.</p>
    <h2>Save and reproduce a choice</h2>
    <p>Save your configurations, evidence references, and rationale to keep a decision across sessions. Changing a reusable computer profile does not rewrite an earlier decision. The public shortlist link shares artifact pins only.</p>
    <p>The first exporter produces files for llama.cpp b11146 Vulkan on Linux x64, a separate systemd unit, and Pi configuration fragments. Inspect them before use. Downloads require pinned revisions and SHA-256 checksums. Exporting never installs models, starts services, or changes a client’s settings.</p>
    <Link className="comparison-button inline-flex items-center" href="/compare">Open comparison</Link>
  </article>;
}
