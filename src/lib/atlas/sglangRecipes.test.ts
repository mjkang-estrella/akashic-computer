import { describe, expect, it } from "vitest";
import { parseSglangRecipe } from "./sglangRecipes";

const configSource = `
export const config = {
  modelName: "Example-32B",
  supportedHardware: ["h100", "b200"],
  variants: [{ id: "instruct", label: "Instruct" }],
  quantizations: [{ id: "bf16", label: "BF16" }, { id: "fp8", label: "FP8" }],
  strategies: [{ id: "balanced", label: "Balanced" }],
  modelNames: {
    "instruct|bf16": "Example/Model-32B",
    "instruct|fp8": "Example/Model-32B-FP8",
  },
  cells: [
    { match: { hw: "h100", quant: "bf16" }, verified: true },
    { match: { hw: "b200", quant: "fp8" }, verified: false },
  ],
  ignored() { throw new Error("must never execute"); },
  github: { cookbookModel: "Example/Model-32B" },
};
`;

const pageSource = `---
title: Example-32B
description: "Deploy Example-32B with SGLang."
---

## Deployment
`;

describe("SGLang cookbook parser", () => {
  it("extracts literal model, quantization, and hardware evidence without executing code", () => {
    const recipe = parseSglangRecipe({
      configSource,
      pageSource,
      configPath: "docs/src/snippets/configs/Example/example-32b.jsx",
      pagePath: "docs/cookbook/autoregressive/Example/Example-32B.mdx",
      sourceSha: "abc123",
    });

    expect(recipe).toMatchObject({
      provider: "sglang",
      runtime: "SGLang",
      title: "Example-32B",
      description: "Deploy Example-32B with SGLang.",
      artifactRepos: ["Example/Model-32B", "Example/Model-32B-FP8"],
      hardware: [
        { id: "h100", label: "NVIDIA H100", status: "verified" },
        { id: "b200", label: "NVIDIA B200", status: "documented" },
      ],
    });
    expect(recipe?.variants).toEqual([
      { key: "instruct|bf16", modelId: "Example/Model-32B", precision: "BF16", description: "Instruct" },
      { key: "instruct|fp8", modelId: "Example/Model-32B-FP8", precision: "FP8", description: "Instruct" },
    ]);
  });

  it("returns null when a config has no exact Hugging Face model identity", () => {
    expect(parseSglangRecipe({
      configSource: "export const config = { modelName: 'No model' };",
      pageSource,
      configPath: "docs/src/snippets/configs/no-model.jsx",
      pagePath: "docs/cookbook/no-model.mdx",
      sourceSha: "abc123",
    })).toBeNull();
  });
});
