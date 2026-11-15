import { describe, expect, it } from "vitest";
import { FAMILY_LOGOS, familyBrand } from "./brands";

describe("family brands", () => {
  it("uses Artificial Analysis creator colors and leaves unknown families unmapped", () => {
    expect(familyBrand("qwen")).toEqual({ company: "Alibaba", color: "#ff7018" });
    expect(familyBrand("kimi")).toEqual({ company: "Moonshot AI", color: "#047afe" });
    expect(familyBrand("not-a-family")).toBeNull();
  });

  it("gives every family with a logo a company color", () => {
    for (const familyId of Object.keys(FAMILY_LOGOS)) {
      expect(familyBrand(familyId), familyId).not.toBeNull();
    }
  });
});
