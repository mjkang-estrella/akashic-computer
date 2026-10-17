import { describe, expect, it } from "vitest";
import { artifact } from "../../../test/catalogFixture";
import { contextLabel, fitOf, kvCacheAt, memoryAssumptions, memoryRange } from "./fit";

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
  it("makes no judgment without a budget", () => {
    expect(fitOf(fp8, null)).toEqual({ level: "unset", text: "No memory budget set" });
    expect(fitOf(fp8, null, { context: 8192 }).level).toBe("unset");
  });
  it("scales the native-context KV estimate to the selected context", () => {
    const estimate = { ...fp8.vramEstimate, kvCacheBytes: 12_000_000_000 };
    expect(kvCacheAt(estimate, "native")).toEqual({ bytes: 12_000_000_000, tokens: 1048576, capped: false });
    expect(kvCacheAt(estimate, 131072)).toEqual({ bytes: 1_500_000_000, tokens: 131072, capped: false });
    expect(kvCacheAt({ ...estimate, contextTokens: 32768 }, 131072)).toEqual({ bytes: 12_000_000_000, tokens: 32768, capped: true });
    expect(kvCacheAt({ ...estimate, kvCacheBytes: undefined }, 524288).bytes).toBe(6_000_000_000);
  });
  it("adds context-scaled KV only when a context is chosen", () => {
    expect(fitOf(fp8, rig(330)).level).toBe("tight");
    expect(fitOf(fp8, rig(330), { context: "native" })).toEqual({
      level: "no", text: "Weights + native-context BF16 KV exceed 330 GB; offload not assessed",
    });
    expect(fitOf(fp8, rig(330), { context: 131072 }).level).toBe("tight");
    expect(memoryAssumptions(fp8, 131072)).toBe("+ 1.5 GB KV estimate · 131,072 tokens · concurrency 1 · BF16");
  });
  it("labels context lengths compactly", () => {
    expect([8192, 32768, 262144, 1048576, 40960, 1000].map(contextLabel)).toEqual(["8K", "32K", "256K", "1M", "40K", "1,000"]);
  });
});

