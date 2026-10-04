import { z } from "zod";
import { deploymentSchema, shortText, bytesSchema, stableJson, performanceComputer, type DeploymentConfiguration } from "./deployments";
const nonnegative = z.number().nonnegative();
const count = z.number().int().nonnegative();
export const protocolSchema = z.object({
  id: shortText.optional(), dataset: shortText.optional(), datasetRevision: shortText.optional(),
  promptSetHash: shortText.optional(), promptSetId: shortText.optional(), tokenizer: shortText.optional(),
  tool: shortText.optional(), toolVersion: shortText.optional(),
  referenceRepo: shortText.optional(), referenceRevision: shortText.optional(),
  kldDirection: z.enum(["reference-to-quant", "quant-to-reference", "unknown"]).optional(),
  top1Definition: z.string().max(500).optional(),
  sampleCount: count.optional(), warmups: count.optional(), repeatsPerPrompt: count.optional(),
  cache: z.enum(["disabled", "cold", "warm", "unknown"]),
  order: z.array(shortText).max(100).optional(),
  aggregation: z.enum(["median-across-prompts", "median-repeated-trials", "single-trial", "source-reported"]),
}).strict();
export const trialSchema = z.object({
  caseId: shortText, repetition: count.optional(), promptTokens: count, generatedTokens: count,
  cachedTokens: count.optional(), decodeTps: nonnegative.optional(), prefillTps: nonnegative.optional(),
  prefillSeconds: nonnegative.optional(), ttftSeconds: nonnegative.optional(), wallSeconds: nonnegative.optional(),
  finishReason: z.enum(["length", "stop", "error", "unknown"]),
  thinkingTokens: count.optional(), draftTokens: count.optional(), acceptedTokens: count.optional(),
}).strict().refine((r) => r.acceptedTokens === undefined || (r.draftTokens !== undefined && r.acceptedTokens <= r.draftTokens),
  "Accepted draft tokens cannot exceed drafted tokens");
export const memoryObservationSchema = z.object({
  kind: z.enum(["snapshot", "peak"]), scope: z.enum(["system", "process", "gpu"]),
  bytes: bytesSchema, method: shortText, measuredAt: nonnegative.optional(),
  sampleIntervalMs: z.number().positive().optional(), durationSeconds: z.number().positive().optional(),
  swapBytes: bytesSchema.optional(),
}).strict().refine((m) => m.kind !== "peak" || (m.sampleIntervalMs !== undefined && m.durationSeconds !== undefined),
  "A peak requires a sampling interval and duration; use snapshot for one observation");
export const evidenceSchema = z.object({
  schemaVersion: z.literal(2), id: shortText, modelSlug: shortText, artifactRepo: shortText,
  buildKey: z.string().min(1).max(1600).optional(),
  kind: z.enum(["fidelity", "performance"]),
  source: z.object({ label: shortText, url: z.url().max(2048).refine((s) => /^https?:\/\//.test(s)).optional(),
    origin: z.enum(["published", "local_import"]), measuredAt: nonnegative.optional(),
    limitations: z.array(z.string().max(1000)).max(30) }).strict(),
  protocol: protocolSchema,
  deployment: deploymentSchema.optional(),
  fidelity: z.object({
    kld: nonnegative.optional(), top1: z.object({ value: nonnegative, unit: z.enum(["fraction", "percent"]) }).strict()
      .refine((x) => x.value <= (x.unit === "percent" ? 100 : 1), "Top-1 agreement is outside its unit range").optional(),
    uncertainty: z.object({ value: nonnegative, kind: z.enum(["standard-deviation", "standard-error", "confidence-interval", "unknown"]),
      description: z.string().max(300).optional() }).strict().optional(),
  }).strict().optional(),
  trials: z.array(trialSchema).max(100).optional(),
  memory: z.array(memoryObservationSchema).max(20).optional(),
}).strict().superRefine((r, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (r.kind === "performance" && (!r.deployment || !r.buildKey || !r.trials?.length)) issue("Performance requires an exact deployment and trials");
  if (r.kind === "fidelity" && (r.fidelity?.kld === undefined && r.fidelity?.top1 === undefined)) issue("Fidelity requires KLD or Top-1 agreement");
  if (r.kind === "fidelity" && (r.deployment || r.trials)) issue("Fidelity and performance use separate records");
  if (r.kind === "performance" && r.fidelity) issue("Store fidelity separately from performance");
  if (r.deployment && (r.deployment.buildKey !== r.buildKey || r.deployment.modelSlug !== r.modelSlug ||
    r.deployment.artifactRepo !== r.artifactRepo)) issue("Evidence subject does not match the deployment");
});
export type EvidenceReport = z.infer<typeof evidenceSchema>;
export function parseEvidenceImport(text: string): { reports: EvidenceReport[]; errors: string[] } {
  if (new TextEncoder().encode(text).length > 1_048_576) return { reports: [], errors: ["Import exceeds 1 MiB."] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { reports: [], errors: ["Invalid JSON."] }; }
  const rows = Array.isArray(raw) ? raw : [raw];
  if (!rows.length || rows.length > 100) return { reports: [], errors: ["Select 1–100 reports per import."] };
  const reports: EvidenceReport[] = [], errors: string[] = [];
  const ids = new Set<string>();
  rows.forEach((row, i) => {
    if (new TextEncoder().encode(JSON.stringify(row)).length > 65536) { errors.push("Record " + (i + 1) + ": exceeds 64 KiB."); return; }
    const parsed = evidenceSchema.safeParse(row);
    if (!parsed.success) errors.push("Record " + (i + 1) + ": " + parsed.error.issues.map((e) => e.path.join(".") + " " + e.message).join("; "));
    else if (ids.has(parsed.data.id)) errors.push("Record " + (i + 1) + ": Duplicate report ID.");
    else { ids.add(parsed.data.id); reports.push(parsed.data); }
  });
  return { reports, errors };
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function decodeMedian(report: EvidenceReport) {
  return median((report.trials ?? []).flatMap((t) => t.finishReason === "error" || t.decodeTps === undefined ? [] : [t.decodeTps]));
}
export function performanceSummary(reports: EvidenceReport[]) {
  const performance = reports.filter((r) => r.kind === "performance");
  const trials = performance.flatMap((r) => r.trials ?? []).filter((t) => t.finishReason !== "error");
  return { reports: performance, largestInput: trials.length ? Math.max(...trials.map((t) => t.promptTokens)) : undefined,
    memory: performance.flatMap((r) => (r.memory ?? []).map((observation) => ({ source: r.source.label, observation }))),
    // Several workloads do not have one defensible aggregate speed.
    sortableDecode: performance.length === 1 ? decodeMedian(performance[0]) : null };
}
export function evidenceAssessments(options: Array<{ label: string; reports: EvidenceReport[] }>) {
  return options.flatMap((a, i) => options.slice(i + 1).flatMap((b) => a.reports.flatMap((left) =>
    b.reports.filter((right) => right.kind === left.kind).map((right) => ({ kind: left.kind,
      label: a.label + " (" + left.source.label + ") ↔ " + b.label + " (" + right.source.label + ")",
      result: compareEvidence(left, right, left.buildKey === right.buildKey ? "mtp" : "artifact") })))));
}
export function fidelityLabel(report: EvidenceReport) {
  const f = report.fidelity;
  if (!f) return "Unknown";
  const parts: string[] = [];
  if (f.kld !== undefined) parts.push("KLD " + f.kld);
  if (f.top1) parts.push("Top-1 " + (f.top1.unit === "fraction" ? f.top1.value * 100 : f.top1.value).toFixed(2) + "%");
  if (f.uncertainty) parts.push("Reported uncertainty " + f.uncertainty.value + " (" +
    f.uncertainty.kind.replaceAll("-", " ") + (f.uncertainty.description ? "; " + f.uncertainty.description : "") + ")");
  return parts.join(" · ");
}
/** These are descriptive checks, not a significance test or quality verdict. */
export function compareEvidence(a: EvidenceReport, b: EvidenceReport, varying: "artifact" | "mtp" = "artifact") {
  const reasons: string[] = [];
  if (a.kind !== b.kind) return { comparable: false, conclusion: "Different evidence classes", reasons: ["Fidelity and performance measure different things."] };
  const keys = a.kind === "fidelity"
    ? ["dataset", "datasetRevision", "tokenizer", "tool", "toolVersion", "referenceRepo", "referenceRevision"] as const
    : ["tool", "toolVersion", "cache", "aggregation"] as const;
  if (a.kind === "performance") {
    const promptKey = a.protocol.promptSetHash || b.protocol.promptSetHash ? "promptSetHash" : "promptSetId";
    if (!a.protocol[promptKey] || !b.protocol[promptKey]) reasons.push("Prompt-set identity is unrecorded");
    else if (a.protocol[promptKey] !== b.protocol[promptKey]) reasons.push("Prompt-set identity differs");
    if (a.protocol.id && b.protocol.id && a.protocol.id !== b.protocol.id) reasons.push("Protocol id differs");
  }
  for (const key of keys) {
    if (!a.protocol[key] || !b.protocol[key] || a.protocol[key] === "unknown" || b.protocol[key] === "unknown") reasons.push(key + " is unrecorded");
    else if (a.protocol[key] !== b.protocol[key]) reasons.push(key + " differs");
  }
  if (!a.buildKey || !b.buildKey) reasons.push("Exact artifact identity is missing");
  if (a.kind === "fidelity") {
    const metrics: Array<"kldDirection" | "top1Definition"> = [];
    if (a.fidelity?.kld !== undefined && b.fidelity?.kld !== undefined) metrics.push("kldDirection");
    if (a.fidelity?.top1 && b.fidelity?.top1) metrics.push("top1Definition");
    if (!metrics.length) reasons.push("No shared fidelity metric");
    for (const metric of metrics) if (!a.protocol[metric] || a.protocol[metric] === "unknown" || a.protocol[metric] !== b.protocol[metric])
      reasons.push(metric + " differs or is unrecorded");
  } else if (a.deployment && b.deployment) {
    for (const field of ["name", "version", "backend", "platform"] as const) {
      if ([a.deployment.runtime[field], b.deployment.runtime[field]].includes("unknown")) reasons.push("Runtime " + field + " is unrecorded");
    }
    for (const field of ["thinking", "cacheK", "cacheV", "flashAttention", "offload"] as const) {
      if ([a.deployment.settings[field], b.deployment.settings[field]].includes("unknown")) reasons.push(field + " is unrecorded");
    }
    for (const field of ["temperature", "seed", "threads", "batch", "ubatch", "chatTemplate"] as const) {
      if (a.deployment.settings[field] === undefined || b.deployment.settings[field] === undefined) reasons.push(field + " is unrecorded");
    }
    const deploymentProtocol = (d: DeploymentConfiguration) => {
      const s = { ...d.settings };
      if (varying === "mtp") { s.mtp = "unknown"; s.draftMax = 0; }
      return { runtime: d.runtime, computer: performanceComputer(d.computer), settings: s, ...(varying === "mtp" ? { build: d.buildKey } : {}) };
    };
    if (stableJson(deploymentProtocol(a.deployment)) !== stableJson(deploymentProtocol(b.deployment))) reasons.push("Computer, runtime or non-varied settings differ");
    const trialIdentity = (r: EvidenceReport) => (r.trials ?? []).map((t) => [t.caseId, t.repetition, t.promptTokens, t.generatedTokens, t.cachedTokens])
      .sort((x, y) => stableJson(x).localeCompare(stableJson(y)));
    if (stableJson(trialIdentity(a)) !== stableJson(trialIdentity(b)))
      reasons.push("Prompt cases, filled context, output lengths or cached tokens differ");
  }
  const repeated = (a.protocol.repeatsPerPrompt ?? 0) > 1 && (b.protocol.repeatsPerPrompt ?? 0) > 1;
  return { comparable: !reasons.length, reasons,
    conclusion: reasons.length ? "Contextual evidence; no controlled delta"
      : a.kind === "performance" && !repeated ? "Descriptive comparison; no established winner"
        : a.kind === "performance" && (!a.protocol.promptSetHash || !b.protocol.promptSetHash)
          ? "Source-described prompt set; inspect reported uncertainty" : "Aligned protocol; inspect reported uncertainty" };
}
/** Publication preview is exactly the object the public API will expose. */
export function publicationProjection(report: EvidenceReport): EvidenceReport {
  const copy = structuredClone(report);
  if (copy.deployment) {
    copy.deployment.id = "published";
    copy.deployment.label = "Published configuration";
    copy.deployment.computer.name = "Published hardware";
    copy.deployment.workload.name = "Published workload";
  }
  return copy;
}
