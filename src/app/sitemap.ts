import type { MetadataRoute } from "next";
import { DOC_ARTICLES } from "@/lib/atlas/docsArticles";
import { getCatalogEntries } from "@/lib/atlas/serverCatalog";

const SITE = "https://akashic.computer";

// Matches CATALOG_REVALIDATE_SECONDS, a safety net behind on-demand tag revalidation.
// Segment config must be a literal.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getCatalogEntries();
  const models = (entries ?? []).map((entry) => ({
    url: `${SITE}/models/${entry.slug}`,
    lastModified: new Date(entry.timestamp),
  }));
  const latest = models.reduce<Date | undefined>(
    (newest, model) => (!newest || model.lastModified > newest ? model.lastModified : newest),
    undefined,
  );
  return [
    { url: SITE, ...(latest ? { lastModified: latest } : {}) },
    { url: `${SITE}/models`, ...(latest ? { lastModified: latest } : {}) },
    { url: `${SITE}/benchmarks` },
    { url: `${SITE}/docs` },
    { url: `${SITE}/docs/lexicon` },
    ...DOC_ARTICLES.map((article) => ({ url: `${SITE}/docs/${article.slug}`, lastModified: new Date(article.updated) })),
    ...models,
  ];
}
