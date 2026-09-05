import { describe, expect, it } from "vitest";
import { artifact } from "../../../test/catalogFixture";
import { fitOf, memoryRange } from "./fit";

const fp8 = { ...artifact("zai-org/GLM-5.3-Flash", "FP8"), minVramGb: 328, recVramGb: 340,
  vramEstimate: { weightGb: 328, kvCacheGb: 12, kvCacheDtype: "BF16" as const, contextTokens: 1048576, concurrency: 1 as const, cacheMethod: "mla" as const } };
const rig = (gb: number) => ({ gb, kind: "dgx" as const, label: "Combined device memory", manual: true });
describe("memory evidence", () => {
  it.each([328, 340, 384, 386, 1024])("does not certify runtime fit at %i GB", (gb) => {
    expect(fitOf(fp8, rig(gb))).toEqual({ level: "tight", text: "Runtime fit unverified" });
  });
  it("distinguishes a weight-only deficit from runtime requirements", () => {
    expect(fitOf(fp8, rig(327)).level).toBe("no");
    expect(fitOf(fp8, rig(328)).level).toBe("tight");
    expect(fitOf({ ...fp8, vramEstimate: undefined }, rig(1)).level).toBe("tight");
  });
  it("collapses equal bounds and rejects absent estimates", () => {
    expect(memoryRange(340, 340)).toBe("340 GB");
    expect(memoryRange(328, 340)).toBe("328–340 GB");
    expect(memoryRange(0, 0)).toBe("Unknown");
  });
});
