import { describe, expect, it, vi } from "vitest";
import { publishableEntry } from "@/lib/atlas/published";
import { QWEN_ENTRY } from "../../../../../../test/catalogFixture";

const getCatalogEntry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/atlas/serverCatalog", () => ({ getCatalogEntry }));

import { GET } from "./route";

const feed = (slug: string) =>
  GET(new Request(`https://akashic.computer/models/${slug}/feed.xml`), { params: Promise.resolve({ slug }) });

describe("GET /models/[slug]/feed.xml", () => {
  it("serves an empty feed for payloads stored without material changes", async () => {
    // Older catalog payloads omit empty lists entirely.
    const older: Record<string, unknown> = { ...publishableEntry(QWEN_ENTRY) };
    for (const key of ["materialChanges", "deploymentRecipes", "runReports"]) delete older[key];
    getCatalogEntry.mockResolvedValueOnce(older);
    const response = await feed(QWEN_ENTRY.slug);
    expect(response.status).toBe(200);
    const xml = await response.text();
    expect(xml).toContain(`<title>${QWEN_ENTRY.name} · Akashic Computer</title>`);
    expect(xml).not.toContain("<item>");
  });

  it("distinguishes a missing model from an unreachable catalog", async () => {
    getCatalogEntry.mockResolvedValueOnce(null);
    expect((await feed("missing")).status).toBe(404);
    getCatalogEntry.mockResolvedValueOnce(undefined);
    expect((await feed("missing")).status).toBe(503);
  });
});
