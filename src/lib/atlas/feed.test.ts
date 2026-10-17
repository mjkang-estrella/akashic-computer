import { describe, expect, it } from "vitest";
import { materialChangesRss } from "./feed";
import type { MaterialChange } from "./types";

const change = (id: string, occurredAt: number, title: string): MaterialChange => ({
  id, modelSlug: "qwen-qwen3-6-27b", modelName: "Qwen3.6 27B", type: "artifact_published", occurredAt,
  dateLabel: "", title, summary: "unsloth/Qwen3.6-27B-GGUF is now linked as a GGUF artifact.",
  sourceLabel: "Hugging Face", sourceUrls: ["https://huggingface.co/unsloth/Qwen3.6-27B-GGUF"], reviewStatus: "automatic",
});

describe("material change feed", () => {
  it("renders newest-first RSS items with escaped text and stable GUIDs", () => {
    const xml = materialChangesRss({
      title: "Qwen3.6 27B · Akashic Computer",
      description: "Changes",
      path: "/models/qwen-qwen3-6-27b",
      feedPath: "/models/qwen-qwen3-6-27b/feed.xml",
      changes: [change("a", Date.UTC(2026, 9, 1), "GGUF artifact added"), change("b", Date.UTC(2026, 9, 2), "Q&A <recipe> added")],
    });
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    expect(xml.indexOf("<guid isPermaLink=\"false\">b</guid>")).toBeLessThan(xml.indexOf("<guid isPermaLink=\"false\">a</guid>"));
    expect(xml).toContain("<title>Qwen3.6 27B: Q&amp;A &lt;recipe&gt; added</title>");
    expect(xml).toContain("<link>https://akashic.computer/models/qwen-qwen3-6-27b</link>");
    expect(xml).toContain("<pubDate>Fri, 02 Oct 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain('<atom:link href="https://akashic.computer/models/qwen-qwen3-6-27b/feed.xml" rel="self"');
  });

  it("renders a valid empty channel", () => {
    const xml = materialChangesRss({ title: "t", description: "d", path: "/", feedPath: "/feed.xml", changes: [] });
    expect(xml).not.toContain("<item>");
    expect(xml).not.toContain("lastBuildDate");
  });
});
