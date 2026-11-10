import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeView } from "./HomeView";
import { LearnView } from "./LearnView";
import { resolveModelVariant } from "./ModelDetailView";
import { ModelNotFound } from "./ModelNotFound";
import { homeCatalogStats } from "@/lib/atlas/home";

function expectPageHeading(markup: string) {
  expect(markup.match(/<h1[ >]/g)).toHaveLength(1);
}

describe("catalog navigation semantics", () => {
  it("renders home navigation and server-provided summaries as links", () => {
    const markup = renderToStaticMarkup(createElement(HomeView, {
      entries: [], stats: homeCatalogStats([]), materialChanges: [],
      syncedAt: null, loading: false, health: null, revision: "test", rig: null,
      featuredDocs: [{ slug: "quantization", title: "Quantization", summary: "Small summary", readMinutes: 5 }],
    }));
    expectPageHeading(markup);
    for (const href of ["/models", "/benchmarks", "/docs", "/docs/quantization"]) {
      expect(markup).toContain(`href="${href}"`);
    }
    expect(markup).toContain("Small summary");
    expect(markup).toMatch(/<button[^>]*>Choose your hardware<\/button>/);
  });

  it.each([null, "quantization", "lexicon"])("gives docs route %s one h1", (slug) => {
    const markup = renderToStaticMarkup(createElement(LearnView, { slug }));
    expectPageHeading(markup);
    expect(markup).toContain(slug ? 'href="/docs"' : 'href="/docs/lexicon"');
  });

  it("gives the missing model page a heading and catalog link", () => {
    const markup = renderToStaticMarkup(createElement(ModelNotFound));
    expectPageHeading(markup);
    expect(markup).toContain('href="/models"');
  });
});

describe("live model variant selection", () => {
  it("keeps a selection that still exists after refresh", () => {
    expect(resolveModelVariant(["Base", "Instruct"], "Instruct")).toBe("Instruct");
  });

  it("falls back when refresh removes the selected variant", () => {
    expect(resolveModelVariant(["Base", "Thinking"], "Instruct")).toBe("Base");
  });
});
