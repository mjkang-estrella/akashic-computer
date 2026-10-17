import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsRoute } from "@/components/atlas/DocsRoute";
import { DOC_ARTICLES, docArticleBySlug } from "@/lib/atlas/docsArticles";

type Props = { params: Promise<{ slug: string }> };

const LEXICON = {
  title: "Lexicon",
  description: "Definitions for model families, parameters, quantization formats, runtimes, memory and evidence terms.",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return [...DOC_ARTICLES.map((article) => ({ slug: article.slug })), { slug: "lexicon" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = slug === "lexicon" ? LEXICON : docArticleBySlug(slug);
  if (!article) return {};
  const description = "summary" in article ? article.summary : article.description;
  return {
    title: article.title,
    description,
    alternates: { canonical: `/docs/${slug}` },
    // A segment-level openGraph object replaces the root one, so restate the site image.
    openGraph: { title: article.title, description, type: "article", url: `/docs/${slug}`, images: "/opengraph-image" },
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  if (slug !== "lexicon" && !docArticleBySlug(slug)) notFound();
  return <DocsRoute slug={slug} />;
}
