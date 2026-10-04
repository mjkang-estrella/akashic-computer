import { describe, expect, it } from "vitest";
import { parseEvidenceImport, compareEvidence, fidelityLabel, decodeMedian, performanceSummary, evidenceAssessments, type EvidenceReport } from "./evidence";
import { deploymentMatchKey, decimalGbToBytes, workloadSchema } from "./deployments";
import { fixtureReport } from "../../../test/deploymentFixture";
describe("evidence boundaries", () => {
  it("retains a system snapshot and refuses to reinterpret it as a peak", () => {
    const report = { ...fixtureReport, memory: [{ kind: "snapshot", scope: "system", bytes: 54735187968, method: "MemTotal minus MemAvailable", swapBytes: 0 }] };
    expect(parseEvidenceImport(JSON.stringify(report)).reports).toHaveLength(1);
    report.memory[0].kind = "peak";
    expect(parseEvidenceImport(JSON.stringify(report)).errors.join()).toContain("sampling interval");
  });
  it("keeps missing metrics absent, preserves truncation and rejects hidden extra fields", () => {
    const parsed = parseEvidenceImport(JSON.stringify(fixtureReport));
    expect(parsed.errors).toEqual([]);
    expect(parsed.reports[0].trials![0].ttftSeconds).toBeUndefined();
    expect(decodeMedian(parsed.reports[0])).toBe(53.15867051725467);
    expect(parseEvidenceImport(JSON.stringify({ ...fixtureReport, apiKey: "not-allowed" })).errors).toHaveLength(1);
  });
  it("does not claim a winner for draft lengths measured once per prompt", () => {
    const a = structuredClone(fixtureReport), b = structuredClone(fixtureReport);
    for (const report of [a, b]) Object.assign(report.deployment!.settings, { temperature: 0, seed: 1234,
      threads: 16, batch: 2048, ubatch: 512, chatTemplate: "embedded-jinja", flashAttention: "on", offload: "all" });
    a.deployment!.settings.mtp = "draft-mtp"; a.deployment!.settings.draftMax = 2;
    b.deployment!.settings.mtp = "draft-mtp"; b.deployment!.settings.draftMax = 3;
    expect(compareEvidence(a, b, "mtp").conclusion).toContain("no established winner");
    b.deployment!.settings.thinking = "off";
    expect(compareEvidence(a, b, "mtp").comparable).toBe(false);
  });
  it("does not align two equally unknown protocols or different filled contexts", () => {
    expect(compareEvidence(fixtureReport, fixtureReport).reasons).toContain("temperature is unrecorded");
    const b = structuredClone(fixtureReport);
    b.trials![0].promptTokens = 43225;
    expect(compareEvidence(fixtureReport, b).reasons).toContain("Prompt cases, filled context, output lengths or cached tokens differ");
  });
  it("retains short and long workload speeds, largest input and setup snapshots regardless of reference order", () => {
    const short = structuredClone(fixtureReport), long = structuredClone(fixtureReport);
    short.trials![0].decodeTps = 74.9650;
    short.memory = [{ kind: "snapshot", scope: "system", bytes: 54735187968, method: "Setup observation" }];
    long.id = "long"; long.protocol.id = "long";
    long.trials![0] = { caseId: "long", promptTokens: 43225, generatedTokens: 512, decodeTps: 51.3652, prefillSeconds: 57.4154, finishReason: "length" };
    const summary = performanceSummary([short, long]);
    expect(summary.reports.map(decodeMedian)).toEqual([74.9650, 51.3652]);
    expect(summary.largestInput).toBe(43225);
    expect(summary.memory[0].observation.bytes).toBe(54735187968);
    expect(summary.sortableDecode).toBeNull();
    expect(performanceSummary([long, short]).largestInput).toBe(43225);
    short.trials![0].finishReason = "error";
    expect(decodeMedian(short)).toBeNull();
  });
  it("keeps performance attached after bookkeeping changes but detaches for driver/device changes", () => {
    const a = fixtureReport.deployment!, b = structuredClone(a);
    b.computer.name = "Saved Framework"; b.computer.revision++;
    b.computer.source = "manual"; b.computer.observedAt = 123;
    b.computer.pools[0].label = "My RAM"; b.computer.pools[0].usableBytes = 125 * 2 ** 30;
    expect(deploymentMatchKey(a)).toBe(deploymentMatchKey(b));
    b.computer.environment = { driver: "Different driver" };
    expect(deploymentMatchKey(a)).not.toBe(deploymentMatchKey(b));
    expect(workloadSchema.parse({ ...a.workload, totalMemoryBytes: decimalGbToBytes("32.2"), reserveBytes: decimalGbToBytes("8.2") }))
      .toMatchObject({ totalMemoryBytes: 32200000000, reserveBytes: 8200000000 });
  });
  it("normalizes explicit Top-1 units and never transfers unbound KLD", () => {
    const fidelity: EvidenceReport = { schemaVersion: 2, id: "external", modelSlug: fixtureReport.modelSlug,
      artifactRepo: "AesSedai/example", kind: "fidelity", source: { label: "External", origin: "published", limitations: [] },
      protocol: { cache: "unknown", aggregation: "source-reported" }, fidelity: { kld: 0, top1: { value: .92, unit: "fraction" } } };
    expect(fidelityLabel(fidelity)).toBe("KLD 0 · Top-1 92.00%");
    expect(compareEvidence(fidelity, fidelity).comparable).toBe(false);
    fidelity.fidelity!.top1!.value = 92;
    expect(parseEvidenceImport(JSON.stringify(fidelity)).errors).toHaveLength(1);
  });
  it("preserves reported uncertainty and requires a common fidelity metric and definition", () => {
    const a: EvidenceReport = { schemaVersion: 2, id: "fidelity", modelSlug: fixtureReport.modelSlug,
      artifactRepo: fixtureReport.artifactRepo, buildKey: fixtureReport.buildKey, kind: "fidelity",
      source: { label: "Published example", origin: "published", limitations: [] },
      protocol: { cache: "unknown", aggregation: "source-reported", dataset: "dataset", datasetRevision: "1",
        tokenizer: "tokenizer", tool: "tool", toolVersion: "1", referenceRepo: "reference", referenceRevision: "1",
        kldDirection: "reference-to-quant", top1Definition: "argmax token agreement" },
      fidelity: { kld: 0.005988, uncertainty: { value: 0.000117, kind: "standard-error" } } };
    expect(fidelityLabel(a)).toContain("0.000117 (standard error)");
    const b = structuredClone(a);
    b.fidelity = { top1: { value: 98, unit: "percent" } };
    expect(compareEvidence(a, b).reasons).toContain("No shared fidelity metric");
    a.fidelity!.top1 = b.fidelity.top1;
    b.fidelity.kld = 0.006;
    b.protocol.top1Definition = "different denominator";
    expect(compareEvidence(a, b).comparable).toBe(false);
    const pairs = evidenceAssessments([{ label: "A", reports: [fixtureReport, a] }, { label: "B", reports: [b] },
      { label: "C", reports: [fixtureReport, b] }]);
    expect(pairs.filter((p) => p.kind === "fidelity")).toHaveLength(3);
    expect(pairs.filter((p) => p.kind === "performance")).toHaveLength(1);
  });
});
