import { describe, expect, it } from "vitest";
import { DEFAULT_CONTEXT, DEFAULT_PRESET_ID, HARDWARE_PRESETS, RIG_PRESETS } from "./data";
import { resolveProfile } from "./fit";

describe("hardware profile defaults", () => {
  it("starts new sessions without a memory budget", () => {
    expect(DEFAULT_PRESET_ID).toBeNull();
    expect(resolveProfile(RIG_PRESETS, DEFAULT_PRESET_ID, null)).toBeNull();
    expect(DEFAULT_CONTEXT).toBe(32768);
  });

  it("offers consumer budgets and keeps existing preset IDs resolvable", () => {
    expect(RIG_PRESETS.map((preset) => preset.gb)).toEqual([8, 12, 16, 24, 32, 48, 80, 128, 256, 384]);
    expect(resolveProfile(RIG_PRESETS, "vram384", null)).toMatchObject({ gb: 384, label: "384 GB", manual: false });
    expect(resolveProfile(RIG_PRESETS, "vram24", 64)).toMatchObject({ gb: 64, manual: true });
  });

  it("translates named hardware into a usable budget with its basis", () => {
    const ids = HARDWARE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(resolveProfile(HARDWARE_PRESETS, "rtx4090", null)).toMatchObject({ gb: 24, kind: "cuda", label: "RTX 3090 / 4090 · 24 GB" });
    // macOS GPU-addressable memory defaults to about 2/3 (≤36 GB) or 3/4 of unified memory.
    expect(resolveProfile(HARDWARE_PRESETS, "mac16", null)).toMatchObject({ gb: 10, kind: "mac" });
    expect(resolveProfile(HARDWARE_PRESETS, "mac36", null)?.gb).toBe(24);
    expect(resolveProfile(HARDWARE_PRESETS, "mac128", null)?.gb).toBe(96);
    expect(HARDWARE_PRESETS.every((preset) => preset.group && preset.detail)).toBe(true);
  });
});
