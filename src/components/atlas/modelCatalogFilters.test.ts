import { describe, expect, it } from "vitest";
import { catalogFilterParams, catalogWindow, parseCatalogFilters } from "./modelCatalogFilters";

const options = {
  families: ["qwen"], variants: ["Instruct"], quantizations: ["Q4_K_M"], providers: ["community"],
};

describe("catalog filters", () => {
  it("starts unfiltered for the static server snapshot", () => {
    const filters = parseCatalogFilters("", options);
    expect(filters.familyId).toBe("all");
    expect(filters.capabilities.size).toBe(0);
    expect(catalogFilterParams("", filters).toString()).toBe("");
  });

  it("accepts available options and deduplicates valid capabilities", () => {
    const filters = parseCatalogFilters("?family=qwen&catalogVariant=Instruct&quant=Q4_K_M&provider=community&category=language&size=compact&capability=reasoning,unknown,reasoning", options);
    expect(filters).toMatchObject({ familyId: "qwen", variant: "Instruct", quant: "Q4_K_M", provider: "community", category: "language", sizeBand: "compact" });
    expect([...filters.capabilities]).toEqual(["reasoning"]);
  });

  it("ignores unknown and empty values and drops them on the next update", () => {
    const search = "family=missing&catalogVariant=missing&quant=&provider=missing&category=missing&size=missing&capability=missing&other=keep";
    const filters = parseCatalogFilters(search, options);
    expect(filters).toMatchObject({ familyId: "all", variant: "all", quant: "all", provider: "all", category: "all", sizeBand: "all" });
    const params = catalogFilterParams(search, filters);
    params.set("size", "compact");
    expect(params.toString()).toBe("other=keep&size=compact");
  });

  it("validates against the current catalog options", () => {
    expect(parseCatalogFilters("family=qwen", { ...options, families: [] }).familyId).toBe("all");
  });
});

describe("catalog window", () => {
  const entries = Array.from({ length: 250 }, (_, index) => index);
  it("shows 100 more rows per page and stops at the result count", () => {
    expect(catalogWindow(entries, 1)).toEqual(entries.slice(0, 100));
    expect(catalogWindow(entries, 2)).toEqual(entries.slice(0, 200));
    expect(catalogWindow(entries, 3)).toEqual(entries);
  });
  it("handles empty and shorter filtered results", () => {
    expect(catalogWindow([], 1)).toEqual([]);
    expect(catalogWindow(entries.slice(0, 4), 1)).toHaveLength(4);
    expect(catalogWindow(entries, 0)).toHaveLength(100);
  });
});
