import { describe, expect, it } from "vitest";
import { estimateWeightMemory } from "./docs";
import { DOC_ARTICLES, docArticleBySlug } from "./docsArticles";

describe("estimateWeightMemory", () => {
  it("estimates BF16 weight payload in GiB", () => {
    const estimate = estimateWeightMemory(7, 16);
    expect(estimate.weightGiB).toBeCloseTo(13.04, 2);
    expect(estimate.planningGiB).toBeCloseTo(14.99, 2);
  });

  it("includes NVFP4 block-scale overhead in the effective bit rate", () => {
    const estimate = estimateWeightMemory(70, 4.5);
    expect(estimate.weightGiB).toBeCloseTo(36.67, 2);
  });
});

describe("DOC_ARTICLES", () => {
  it("uses unique shareable slugs", () => {
    const slugs = DOC_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only links to existing related articles", () => {
    for (const article of DOC_ARTICLES) {
      for (const related of article.related) {
        expect(docArticleBySlug(related)).toBeDefined();
      }
    }
  });
});
