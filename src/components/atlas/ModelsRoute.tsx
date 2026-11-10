"use client";

import { useCatalog } from "./CatalogProvider";
import { ModelCatalogSkeleton, ModelCatalogView } from "./ModelCatalogView";

export function ModelsRoute() {
  const { entries, families, loading } = useCatalog();
  if (loading) return <ModelCatalogSkeleton />;
  return (
    <ModelCatalogView
      entries={entries}
      families={families}
    />
  );
}
