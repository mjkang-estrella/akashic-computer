import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModelDetailRoute } from "@/components/atlas/ModelDetailRoute";
import { modelDescription } from "@/lib/atlas/models";
import { hydratePublishedEntries } from "@/lib/atlas/published";
import { getCatalogEntry } from "@/lib/atlas/serverCatalog";

type Props = { params: Promise<{ slug: string }> };

// Render each model on its first visit, then serve it as ISR with the catalog's 5-minute revalidation.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const published = await getCatalogEntry(slug);
  if (!published) return { title: published === null ? "Model not found" : "Model" };
  const entry = hydratePublishedEntries([published]).entries[0];
  const formats = [...new Set(entry.artifacts.map((artifact) => artifact.format))].filter((format) => format !== "Unknown");
  const description = `${modelDescription(entry)}${formats.length ? ` Artifacts: ${formats.join(", ")}.` : ""}`;
  return {
    title: entry.name,
    description,
    alternates: {
      canonical: `/models/${slug}`,
      types: {
        "application/rss+xml": [{ url: `/models/${slug}/feed.xml`, title: `${entry.name} material changes` }],
      },
    },
    openGraph: { title: entry.name, description, type: "article", url: `/models/${slug}` },
    twitter: { card: "summary_large_image", title: entry.name, description },
  };
}

export default async function ModelPage({ params }: Props) {
  const { slug } = await params;
  const published = await getCatalogEntry(slug);
  // Undefined means the catalog was unreachable; the browser subscription decides then.
  if (published === null) notFound();
  return <ModelDetailRoute slug={slug} initialEntry={published} />;
}
