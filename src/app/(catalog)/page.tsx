import { DOC_ARTICLES } from "@/lib/atlas/docsArticles";
import { CatalogSnapshot } from "@/components/atlas/CatalogProvider";
import { HomeRoute } from "@/components/atlas/HomeRoute";
import { homeSnapshot } from "@/lib/atlas/home";
import { getCatalogEntries, getRecentChanges } from "@/lib/atlas/serverCatalog";

const FEATURED_DOC_SLUGS = [
  "model-checkpoint-artifact-runtime",
  "quantization",
  "memory-and-context",
] as const;

export default async function HomePage() {
  const featuredDocs = FEATURED_DOC_SLUGS.flatMap((slug) => {
    const article = DOC_ARTICLES.find((candidate) => candidate.slug === slug);
    return article ? [{ slug: article.slug, title: article.title, summary: article.summary, readMinutes: article.readMinutes }] : [];
  });
  const [entries, recentChanges] = await Promise.all([getCatalogEntries(), getRecentChanges(10)]);
  // Unreachable catalog: render loading states and let the browser subscription fill them.
  if (!entries) return <HomeRoute featuredDocs={featuredDocs} />;
  const snapshot = homeSnapshot(entries, recentChanges ?? []);
  return (
    <CatalogSnapshot entries={snapshot.entries} recentChanges={recentChanges}>
      <HomeRoute featuredDocs={featuredDocs} snapshotStats={snapshot.stats} />
    </CatalogSnapshot>
  );
}
