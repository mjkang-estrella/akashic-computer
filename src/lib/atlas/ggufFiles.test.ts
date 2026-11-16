import { describe, expect, it } from "vitest";
import type { ArtifactBuild } from "./artifactBuilds";
import { ggufBits, ggufFiles } from "./ggufFiles";

const build = (quantization: string, bytes: number | null, overrides: Partial<ArtifactBuild> = {}): ArtifactBuild => ({
  key: `${quantization}-${bytes}`,
  repo: "unsloth/Model-GGUF",
  revision: "a".repeat(40),
  label: `${quantization}/Model-${quantization}.gguf`,
  files: [],
  bytes,
  complete: true,
  container: "gguf",
  quantization,
  mtp: "unknown",
  baseModels: [],
  sourceUrl: "https://huggingface.co/unsloth/Model-GGUF",
  ...overrides,
});

describe("GGUF files", () => {
  it("reads nominal bits from common tags", () => {
    expect(ggufBits("Q4_K_M")).toBe(4);
    expect(ggufBits("UD-Q4_K_XL")).toBe(4);
    expect(ggufBits("UD-IQ1_S")).toBe(1);
    expect(ggufBits("IQ2_XXS")).toBe(2);
    expect(ggufBits("Q8_0")).toBe(8);
    expect(ggufBits("BF16")).toBe(16);
    expect(ggufBits("F16")).toBe(16);
    expect(ggufBits("MXFP4_MOE")).toBeNull();
  });

  it("keeps complete GGUF file sets, largest first", () => {
    const files = ggufFiles([
      build("UD-IQ1_S", 93e9),
      build("Q8_0", 341e9),
      build("UD-Q4_K_XL", 200e9),
      build("Q6_K", 280e9, { complete: false }),
      build("BF16", 640e9, { container: "safetensors" }),
      build("Q5_K_M", null),
    ]);
    expect(files.map((file) => file.quantization)).toEqual(["Q8_0", "UD-Q4_K_XL", "UD-IQ1_S"]);
    expect(files[1]).toEqual({ quantization: "UD-Q4_K_XL", bits: 4, bytes: 200e9 });
  });

  it("keeps the larger file set when a tag repeats", () => {
    expect(ggufFiles([build("Q4_K_M", 10e9), build("Q4_K_M", 12e9)])).toEqual([
      { quantization: "Q4_K_M", bits: 4, bytes: 12e9 },
    ]);
  });
});
