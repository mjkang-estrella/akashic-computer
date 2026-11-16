import { describe, expect, it } from "vitest";
import { disambiguationTags } from "./artifactTags";

describe("artifact disambiguation tags", () => {
  it("tags Google's several BF16 Gemma checkpoints by what differs in the repo name", () => {
    const tags = disambiguationTags([
      { repo: "google/gemma-4-12B-it", format: "BF16", provider: "Google" },
      { repo: "google/gemma-4-12B-it-qat-q4_0-unquantized", format: "BF16", provider: "Google" },
      { repo: "google/gemma-4-12B-it-qat-w4a16-ct", format: "BF16", provider: "Google" },
      { repo: "google/gemma-4-12B-it-qat-q4_0-unquantized-assistant", format: "BF16", provider: "Google" },
      { repo: "google/gemma-4-12B-it-qat-q4_0-gguf", format: "GGUF", provider: "Google" },
    ]);
    expect(tags.get("google/gemma-4-12B-it")).toBeUndefined();
    expect(tags.get("google/gemma-4-12B-it-qat-q4_0-unquantized")).toBe("QAT Q4_0");
    expect(tags.get("google/gemma-4-12B-it-qat-w4a16-ct")).toBe("QAT W4A16");
    expect(tags.get("google/gemma-4-12B-it-qat-q4_0-unquantized-assistant")).toBe("QAT Q4_0 Assistant");
    // The only Google GGUF is already unique.
    expect(tags.get("google/gemma-4-12B-it-qat-q4_0-gguf")).toBeUndefined();
  });

  it("leaves out the shown variant unless rows would read the same without it", () => {
    const rows = [
      { repo: "unsloth/gemma-4-12b-it", format: "BF16", provider: "Unsloth" },
      { repo: "unsloth/gemma-4-12b", format: "BF16", provider: "Unsloth" },
      { repo: "unsloth/gemma-4-12B-it-qat-w4a16", format: "BF16", provider: "Unsloth" },
    ];
    const tags = disambiguationTags(rows, "IT");
    expect(tags.get("unsloth/gemma-4-12B-it-qat-w4a16")).toBe("QAT W4A16");
    // Without "IT" these two would both be untagged, so the variant stays to tell them apart.
    expect(tags.get("unsloth/gemma-4-12b-it")).toBe("IT");
    expect(tags.get("unsloth/gemma-4-12b")).toBeUndefined();
    expect(disambiguationTags(rows.slice(0, 1).concat(rows.slice(2)), "IT").get("unsloth/gemma-4-12b-it")).toBeUndefined();
  });

  it("compares names case-insensitively and leaves unique rows alone", () => {
    const tags = disambiguationTags([
      { repo: "unsloth/gemma-4-12b-it-GGUF", format: "GGUF", provider: "Unsloth" },
      { repo: "unsloth/gemma-4-12B-it-qat-GGUF", format: "GGUF", provider: "Unsloth" },
      { repo: "zai-org/GLM-5.3-Flash", format: "FP8", provider: "Z.ai" },
      { repo: "unsloth/GLM-5.3-Flash-FP8", format: "FP8", provider: "Unsloth" },
    ]);
    expect(tags.get("unsloth/gemma-4-12B-it-qat-GGUF")).toBe("QAT");
    expect(tags.get("unsloth/gemma-4-12b-it-GGUF")).toBeUndefined();
    expect(tags.size).toBe(1);
  });
});
