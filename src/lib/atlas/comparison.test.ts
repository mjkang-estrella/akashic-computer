import { describe, expect, it } from "vitest";
import { modelEntry } from "../../../test/catalogFixture";
import { comparisonHref, equalWeightBudgetBpw, glmComparisonHref, packedWeightGb, positiveNumber, scenarioBpw, scenarioFromParams } from "./comparison";

describe("quantization planning", () => {
  it("separates the larger GLM model's weight cost from Flash's higher target precision", () => {
    expect(packedWeightGb(753, 2.75)).toBeCloseTo(258.84375);
    expect(packedWeightGb(321, 3)).toBeCloseTo(120.375);
    expect(equalWeightBudgetBpw(321, 258.84375)).toBeCloseTo(6.45093);
  });
  it("uses total expert weights rather than active parameters for MoE storage", () => {
    const total = 321, active = 42;
    expect(packedWeightGb(total, 3)).toBeGreaterThan(packedWeightGb(active, 3)! * 7);
    expect(packedWeightGb(70, 3)! / packedWeightGb(70, 2.75)!).toBeCloseTo(3 / 2.75);
  });
  it("rejects invalid or absent assumptions instead of producing a zero estimate", () => {
    for (const input of ["", " ", "0", "-1", "NaN", "Infinity", "abc"]) expect(positiveNumber(input)).toBeNull();
    expect(scenarioBpw("16.01")).toBeNull();
    expect(scenarioBpw("2.75")).toBe(2.75);
    expect(packedWeightGb(0, 3)).toBeNull();
    expect(packedWeightGb(321, 0)).toBeNull();
    expect(packedWeightGb(Infinity, 3)).toBeNull();
    expect(equalWeightBudgetBpw(0, 120)).toBeNull();
    expect(equalWeightBudgetBpw(321, Infinity)).toBeNull();
  });
  it("round-trips different assumptions for the same model and preserves explicit missing bpw", () => {
    const left = { modelSlug: "one-model", variant: "Instruct + tools", bpw: "2.75" };
    const right = { ...left, bpw: "" };
    const params = new URL(comparisonHref(left, right, "192"), "https://example.com").searchParams;
    expect(scenarioFromParams(params, "left")).toEqual(left);
    expect(scenarioFromParams(params, "right")).toEqual(right);
    expect(params.get("budget")).toBe("192");
  });
  it("constructs examples from current catalog identities rather than fixed parameter counts", () => {
    const regular = modelEntry({ slug: "regular-current", repo: "zai-org/GLM-5.3", familyId: "glm", releaseId: "glm-5-3" });
    const flash = modelEntry({ slug: "flash-current", repo: "zai-org/GLM-5.3-Flash", familyId: "glm", releaseId: "glm-5-3-flash" });
    expect(glmComparisonHref([regular])).toBeNull();
    const params = new URL(glmComparisonHref([regular, flash])!, "https://example.com").searchParams;
    expect(params.get("left")).toBe(regular.slug);
    expect(params.get("right")).toBe(flash.slug);
    expect(params.get("leftBpw")).toBe("2.75");
    expect(params.get("rightBpw")).toBe("3");
  });
});
