import { Suspense } from "react";
import { ModelsRoute } from "@/components/atlas/ModelsRoute";
import { ModelCatalogSkeleton } from "@/components/atlas/ModelCatalogView";

export default function ModelsPage() {
  return (
    <Suspense fallback={<ModelCatalogSkeleton />}>
      <ModelsRoute />
    </Suspense>
  );
}
