import { describe, expect, it } from "vitest";
import { capabilityGroup, getCapabilityComparisons, weightsRepo } from "./capabilityData";
import snapshot from "./snapshots/artificial-analysis.json";
import type { PublishedCatalogEntry } from "./published";

function entry(repo: string, name = "DeepSeek V4.1 Flash", variant = "Instruct"): PublishedCatalogEntry {
  return {
    slug: "test-model", name, category: "language", release: { name },
    size: { paramsB: 763, variants: [variant] },
    artifacts: [{ repo, variant }],
  } as PublishedCatalogEntry;
}

describe("capability snapshot identity and comparisons", () => {
  it("keeps Flash separate from flagship despite large parameter counts", () => {
    expect(capabilityGroup("DeepSeek V4.1 Flash", 763)).toBe("flash");
    expect(capabilityGroup("Kimi K3.1 Pro", 2780)).toBe("flagship");
    expect(capabilityGroup("Qwen3.8", 27)).toBe("compact");
  });
  it("only accepts exact Hugging Face checkpoint URLs", () => {
    expect(weightsRepo("https://huggingface.co/Qwen/Qwen3.8-27B")).toBe("qwen/qwen3.8-27b");
    expect(weightsRepo("https://huggingface.co/Qwen/Qwen3.8-27B/tree/main")).toBeNull();
    expect(weightsRepo("https://example.org/Qwen/Qwen3.8-27B")).toBeNull();
    expect(weightsRepo("https://huggingface.co/collections/qwen")).toBeNull();
  });
  it("preserves missing index scores and does not borrow 1017 results", () => {
    const result = getCapabilityComparisons(entry("deepseek-ai/DeepSeek-V4.1-Flash")).Instruct;
    const current = result.models.find(m => m.current)!;
    expect(result.metrics).toHaveLength(3);
    expect(current.scores.intelligenceIndex).toBeNull();
    expect(current.scores.terminalBench40).toBeCloseTo(26.7677, 3);
    expect(current.configuration).toBe("DeepSeek V4.1 Flash (Max)");
    expect(result.models.filter(m => m.closed)).toHaveLength(2);
    expect(result.models.filter(m => !m.current && !m.closed).map(m => m.repo)).toEqual([
      "zai-org/glm-5.3-flash", "qwen/qwen3.8-flash-next",
    ]);
  });
  it("selects reasoning effort rather than the best score and keeps exact release identity", () => {
    const current = getCapabilityComparisons(entry("deepseek-ai/DeepSeek-V4.1-Flash-1017")).Instruct.models.find(m => m.current)!;
    expect(current.configuration).toContain("Max");
    expect(current.repo).toContain("1017");
    expect(current.scores.intelligenceIndex).toBeCloseTo(32.5896, 3);
  });
  it("does not give quantized or fine-tuned artifacts the original checkpoint score", () => {
    for (const repo of ["nvidia/DeepSeek-V4.1-Flash-NVFP4", "someone/DeepSeek-V4.1-Flash-Uncensored"]) {
      const current = getCapabilityComparisons(entry(repo)).Instruct.models.find(m => m.current)!;
      expect(Object.values(current.scores).every(v => v === null)).toBe(true);
    }
  });
  it("isolates model variants", () => {
    const model = entry("deepseek-ai/DeepSeek-V4.1-Flash");
    model.size.variants.push("Base");
    model.artifacts.push({ repo: "nvidia/DeepSeek-V4.1-Flash-NVFP4", variant: "Base" } as PublishedCatalogEntry["artifacts"][number]);
    const result = getCapabilityComparisons(model);
    expect(result.Instruct.models.find(m => m.current)!.scores.terminalBench40).not.toBeNull();
    expect(result.Base.models.find(m => m.current)!.scores.terminalBench40).toBeNull();
  });
  it("does not apply language benchmarks to unrelated model categories", () => {
    expect(getCapabilityComparisons({ ...entry("x/y"), category: "image-generation" })).toEqual({});
  });
  it("keeps only finite measurements and preserves genuine zero values", () => {
    expect(new Set(snapshot.models.map(m => m.id)).size).toBe(snapshot.models.length);
    for (const model of snapshot.models) {
      for (const key of ["intelligenceIndex", "terminalBench40", "hleDiamond"] as const) {
        const value = model[key];
        expect(value === null || Number.isFinite(value)).toBe(true);
        if (value !== null) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(key === "intelligenceIndex" ? 100 : 1); }
      }
    }
    const zero = snapshot.models.find(m => m.terminalBench40 === 0 && m.modelWeightsSourceUrl);
    expect(zero).toBeDefined();
  });
});
