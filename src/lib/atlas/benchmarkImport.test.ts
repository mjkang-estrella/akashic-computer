import { describe, it, expect } from "vitest";
import { convertQwenRecords, groups } from "../../../scripts/convert-qwen-benchmarks";
import { fixtureBuild, fixtureDeployment } from "../../../test/deploymentFixture";
import { decodeMedian, parseEvidenceImport } from "./evidence";
const provenance = { model_repository: fixtureBuild.repo, model_revision: fixtureBuild.revision,
  model_file: fixtureBuild.files[0].path, model_size_bytes: fixtureBuild.bytes, model_sha256: fixtureBuild.files[0].sha256,
  runtime_release: "b11146", runtime_asset: "https://example.com/runtime.tar.gz", runtime_sha256: "c".repeat(64) };
describe("local handoff adapter", () => {
  it("preserves baseline, MTP and long-input speeds as distinct protocols without importing answers", () => {
    const speeds = [53.1587, 74.9650, 51.3652, 66.6689, 74.8656, 75.5864, 70.4575, 70.9897, 65.3186, 63.9930];
    const files = Object.fromEntries(groups.map((g, i) => [g.file,
      Array.from({ length: g.long ? 1 : 3 }, (_, j) => ({ case: j,
        wall_seconds: 67, usage: { prompt_tokens: g.long ? 43225 : 40, completion_tokens: 512 },
        timings: { predicted_per_second: speeds[i], prompt_per_second: 752.8468, prompt_ms: 57415.4 },
        finish_reason: "length", response: { privateAnswer: "Do not import" } }))]));
    const reports = convertQwenRecords({ provenance, deployment: fixtureDeployment, files,
      results: { system_memory_used_bytes: 54735187968, swap_used_bytes: 0, timestamp: "2026-10-03T16:19:47-07:00" } });
    expect(reports).toHaveLength(10);
    expect(reports.flatMap((r) => r.trials!)).toHaveLength(28);
    expect(reports.map(decodeMedian)).toEqual(speeds);
    expect(reports[2].trials![0]).toMatchObject({ promptTokens: 43225, prefillSeconds: 57.4154, finishReason: "length" });
    expect(reports[8].deployment!.settings).toMatchObject({ draftMax: 2, thinking: "on", temperature: 1 });
    expect(reports[1].memory![0]).toMatchObject({ kind: "snapshot", scope: "system", bytes: 54735187968 });
    expect(reports.filter((r) => r.memory)).toHaveLength(1);
    expect(JSON.stringify(reports)).not.toContain("privateAnswer");
    expect(parseEvidenceImport(JSON.stringify(reports)).errors).toEqual([]);
  });
  it("refuses to attach the handoff to a different exact artifact", () => {
    expect(() => convertQwenRecords({ provenance, deployment: { ...fixtureDeployment, buildKey: "other" }, files: {} })).toThrow("pin must match");
  });
});
