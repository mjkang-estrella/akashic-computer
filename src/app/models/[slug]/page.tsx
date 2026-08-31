import { Suspense } from "react";
import { ModelDetailRoute } from "@/components/atlas/ModelDetailRoute";
import { ModelCatalogSkeleton } from "@/components/atlas/ModelCatalogView";

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<ModelCatalogSkeleton detail />}>
      <ModelDetailRoute slug={slug} />
    </Suspense>
  );
}
