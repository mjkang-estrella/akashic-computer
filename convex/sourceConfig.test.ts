import { describe, expect, it } from "vitest";
import { matchesSourceRules } from "../src/lib/atlas/huggingface";
import { MODEL_ENTRIES } from "../src/lib/atlas/models";
import { CURRENT_MONITORED_SOURCES } from "./sourceConfig";

describe("Poolside source configuration", () => {
  const poolside = CURRENT_MONITORED_SOURCES.find((source) => source.owner === "poolside");

  it("includes canonical Laguna artifacts and excludes draft models", () => {
    expect(poolside).toBeDefined();
    if (!poolside) return;
    expect(matchesSourceRules("poolside/Laguna-S-2.1", poolside)).toBe(true);
    expect(matchesSourceRules("poolside/Laguna-S-2.1-NVFP4", poolside)).toBe(true);
    expect(matchesSourceRules("poolside/Laguna-S-2.1-DFlash-NVFP4", poolside)).toBe(false);
    expect(matchesSourceRules("poolside/Laguna-XS.2-speculator.dflash", poolside)).toBe(false);
    expect(matchesSourceRules("poolside/Laguna-tiny-per-element", poolside)).toBe(false);
  });

  it("publishes the four curated Laguna releases", () => {
    const entries = MODEL_ENTRIES.filter((entry) => entry.family.id === "laguna");
    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.release.name)).toEqual(expect.arrayContaining([
      "Laguna S 2.1",
      "Laguna XS 2.1",
      "Laguna M.1",
      "Laguna XS.2",
    ]));
    expect(entries.flatMap((entry) => entry.artifacts).some((artifact) => /dflash|speculator/i.test(artifact.repo))).toBe(false);
  });
});
