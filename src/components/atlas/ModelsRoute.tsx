"use client";

import { useRouter } from "next/navigation";
import { useCatalog } from "./CatalogProvider";
import { ModelCatalogSkeleton, ModelCatalogView } from "./ModelCatalogView";

export function ModelsRoute() {
  const router = useRouter();
  const { entries, families, loading } = useCatalog();
  if (loading) return <ModelCatalogSkeleton />;
  return (
    <ModelCatalogView
      entries={entries}
      families={families}
      onOpen={(entry) => router.push(`/models/${entry.slug}`)}
    />
  );
}
