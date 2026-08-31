import { describe, expect, it } from "vitest";
import { matchesSourceRules } from "../src/lib/atlas/huggingface";
import { CURRENT_MONITORED_SOURCES } from "./sourceConfig";
import { FAMILY_BY_ID } from "./familyConfig";

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

  it("references defined catalog families", () => {
    const missing = CURRENT_MONITORED_SOURCES.flatMap((source) =>
      source.familyIds.filter((familyId) => !FAMILY_BY_ID.has(familyId)),
    );
    expect(missing).toEqual([]);
  });
});
