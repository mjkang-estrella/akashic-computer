import { describe, expect, it } from "vitest";
import {
  materialChangeId,
  parseVllmRecipe,
  githubRevisionFromAtom,
} from "./intelligence";

const index = {
  hf_id: "Example/Model-32B",
  title: "Example 32B",
  provider: "Example",
  url: "/Example/Model-32B",
};

const recipe = {
  hf_id: "Example/Model-32B",
  meta: {
    title: "Example 32B deployment",
    provider: "Example",
    description: "A deployment reference.",
    date_updated: "2026-08-01",
    difficulty: "intermediate",
    tasks: ["text-generation"],
    hardware: {
      dgx_spark_gb10: "verified",
      h100: "compatible",
    },
  },
  model: {
    model_id: "Example/Model-32B",
    min_vllm_version: "0.11.0",
  },
  variants: {
    fp8: {
      precision: "fp8",
      model_id: "Example/Model-32B-FP8",
      vram_minimum_gb: 40,
    },
  },
  features: {
    tool_calling: { enabled: true },
  },
};

describe("vLLM recipe intelligence", () => {
  it("keeps only upstream-verified hardware and exact artifact identities", () => {
    const parsed = parseVllmRecipe(index, recipe, "abc123", {
      dgx_spark_gb10: "DGX Spark (GB10)",
      h100: "H100",
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.hardware).toEqual([
      { id: "dgx_spark_gb10", label: "DGX Spark (GB10)", status: "verified" },
    ]);
    expect(parsed?.artifactRepos).toEqual([
      "Example/Model-32B",
      "Example/Model-32B-FP8",
    ]);
    expect(parsed?.variants[0]).toMatchObject({
      precision: "FP8",
      minimumVramGb: 40,
      minimumRuntimeVersion: "0.11.0",
    });
  });

  it("does not treat an unrelated repository commit as a recipe content change", () => {
    const first = parseVllmRecipe(index, recipe, "abc123", {});
    const second = parseVllmRecipe(index, recipe, "def456", {});

    expect(first?.sourceSha).not.toBe(second?.sourceSha);
    expect(first?.contentHash).toBe(second?.contentHash);
  });

  it("produces deterministic material change identifiers", () => {
    expect(materialChangeId("example-32b", "recipe_updated", "abc123")).toBe(
      materialChangeId("example-32b", "recipe_updated", "abc123"),
    );
    expect(materialChangeId("example-32b", "recipe_updated", "abc123")).not.toBe(
      materialChangeId("example-32b", "recipe_updated", "def456"),
    );
  });

  it("reads the latest immutable revision from GitHub's public commit feed", () => {
    expect(githubRevisionFromAtom(`
      <feed>
        <id>tag:github.com,2008:/vllm-project/recipes/commits/main</id>
        <entry>
          <id>tag:github.com,2008:Grit::Commit/8959cf64189c71d36e11c6a30335f923f261b1f7</id>
        </entry>
      </feed>
    `)).toBe("8959cf64189c71d36e11c6a30335f923f261b1f7");
    expect(githubRevisionFromAtom("<feed />")).toBeNull();
  });
});
