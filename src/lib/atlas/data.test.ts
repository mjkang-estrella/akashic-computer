import { describe, expect, it } from "vitest";
import { DEFAULT_PRESET_ID, RIG_PRESETS } from "./data";
import { resolveProfile } from "./fit";

describe("hardware profile defaults", () => {
  it("defaults new sessions to 384 GB", () => {
    expect(DEFAULT_PRESET_ID).toBe("vram384");
    expect(resolveProfile(RIG_PRESETS, DEFAULT_PRESET_ID, null)).toMatchObject({
      gb: 384,
      label: "384 GB",
      manual: false,
    });
  });
});
