import { materialChangesRss, rssResponse } from "@/lib/atlas/feed";
import { hydratePublishedEntries } from "@/lib/atlas/published";
import { getCatalogEntry } from "@/lib/atlas/serverCatalog";

// Matches CATALOG_REVALIDATE_SECONDS, a safety net behind on-demand tag revalidation.
// Segment config must be a literal.
export const revalidate = 86400;

// Generate each feed on its first request and cache it, as model pages are.
export async function generateStaticParams() {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const published = await getCatalogEntry(slug);
  if (published === null) return new Response("Model not found", { status: 404 });
  if (!published) return new Response("Catalog unavailable", { status: 503 });
  // Older payloads omit empty lists such as materialChanges; hydration restores them.
  const entry = hydratePublishedEntries([published]).entries[0];
  return rssResponse(materialChangesRss({
    title: `${entry.name} · Akashic Computer`,
    description: `Material changes for ${entry.name}: new weights, artifacts, runtime support and official recipes.`,
    path: `/models/${slug}`,
    feedPath: `/models/${slug}/feed.xml`,
    changes: entry.materialChanges,
  }));
}
