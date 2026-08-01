import { describe, expect, it } from "vitest";
import {
  parameterCountLabel,
  parameterDetailLabel,
  parameterTotalLabel,
} from "./naming";

describe("parameter labels", () => {
  it("removes implementation-level precision from large parameter totals", () => {
    expect(parameterTotalLabel({ label: "250B", paramsB: 250.287810304, variants: [] })).toBe("250B");
    expect(parameterTotalLabel({ label: "10.7B", paramsB: 10.7, variants: [] })).toBe("10.7B");
    expect(parameterTotalLabel({ label: "1.06T", paramsB: 1060, variants: [] })).toBe("1.06T");
  });

  it("shows MoE and active parameters separately from the total", () => {
    const size = {
      label: "250B",
      paramsB: 250.287810304,
      activeParamsB: 15,
      isMoe: true,
      variants: [],
    };
    expect(parameterDetailLabel(size)).toBe("MoE · 15B active");
    expect(parameterCountLabel(size)).toBe("250B (MoE · 15B active)");
  });
});
