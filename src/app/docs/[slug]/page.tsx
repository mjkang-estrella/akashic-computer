import { DocsRoute } from "@/components/atlas/DocsRoute";

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DocsRoute slug={slug} />;
}
