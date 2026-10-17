import { materialChangesRss, rssResponse } from "@/lib/atlas/feed";
import { getCatalogEntry } from "@/lib/atlas/serverCatalog";

export const revalidate = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getCatalogEntry(slug);
  if (entry === null) return new Response("Model not found", { status: 404 });
  if (!entry) return new Response("Catalog unavailable", { status: 503 });
  return rssResponse(materialChangesRss({
    title: `${entry.name} · Akashic Computer`,
    description: `Material changes for ${entry.name}: new weights, artifacts, runtime support and official recipes.`,
    path: `/models/${slug}`,
    feedPath: `/models/${slug}/feed.xml`,
    changes: entry.materialChanges,
  }));
}
