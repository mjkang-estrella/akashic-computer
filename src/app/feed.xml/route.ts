import { materialChangesRss, rssResponse } from "@/lib/atlas/feed";
import { getRecentChanges } from "@/lib/atlas/serverCatalog";

export const revalidate = 300;

export async function GET() {
  const changes = await getRecentChanges(24);
  if (!changes) return new Response("Catalog unavailable", { status: 503 });
  return rssResponse(materialChangesRss({
    title: "Akashic Computer · Material changes",
    description: "New weights, artifacts, runtime support and official recipes across open-weight models. Documentation-only commits are excluded.",
    path: "/",
    feedPath: "/feed.xml",
    changes,
  }));
}
