import { describe, expect, it } from "vitest";
import { parseEvidenceImport, compareEvidence, fidelityLabel, decodeMedian, type EvidenceReport } from "./evidence";
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
    a.deployment!.settings.mtp = "draft-mtp"; a.deployment!.settings.draftMax = 2;
    b.deployment!.settings.mtp = "draft-mtp"; b.deployment!.settings.draftMax = 3;
    expect(compareEvidence(a, b, "mtp").conclusion).toContain("no established winner");
    b.deployment!.settings.thinking = "off";
    expect(compareEvidence(a, b, "mtp").comparable).toBe(false);
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
});
