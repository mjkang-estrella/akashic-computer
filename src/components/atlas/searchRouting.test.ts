import { describe, expect, it } from "vitest";
import { catalogSubscriptions } from "./CatalogProvider";
import { searchResultHref } from "./SearchView";

describe("catalog subscriptions", () => {
  it("keeps full lists on discovery and comparison routes", () => {
    for (const path of ["/", "/models", "/benchmarks", "/search", "/compare", "/compare/scenario"]) {
      expect(catalogSubscriptions(path).list).toBe(true);
      expect(catalogSubscriptions(path).health).toBe(path === "/");
      expect(catalogSubscriptions(path).changes).toBe(path === "/" || path.startsWith("/compare"));
    }
  });
  it("skips lists and home feeds on detail and docs routes", () => {
    for (const path of ["/models/example", "/docs", "/docs/lexicon", "/workspace"]) {
      expect(catalogSubscriptions(path)).toEqual({ list: false, changes: false, health: false });
    }
  });
});

it("links model results and preserves encoded artifact variants", () => {
  expect(searchResultHref("example-7b")).toBe("/models/example-7b");
  expect(searchResultHref("example-7b", "Instruct / Chat")).toBe("/models/example-7b?variant=Instruct%20%2F%20Chat");
});
