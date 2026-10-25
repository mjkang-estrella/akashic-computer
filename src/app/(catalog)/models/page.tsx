import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { CatalogSnapshot } from "@/components/atlas/CatalogProvider";
import { ModelsRoute } from "@/components/atlas/ModelsRoute";
import { ModelCatalogSkeleton } from "@/components/atlas/ModelCatalogView";
import { catalogListItem } from "@/lib/atlas/published";
import { getCatalogEntries } from "@/lib/atlas/serverCatalog";

export const metadata: Metadata = {
  title: "Models",
  description: "Open-weight model releases by family and parameter size, with quantized artifacts, providers and memory estimates.",
  alternates: { canonical: "/models" },
};

export default async function ModelsPage() {
  // Filters live in the URL; rendering per request lets a shared filter link arrive filtered.
  await connection();
  const entries = await getCatalogEntries();
  const route = (
    <Suspense fallback={<ModelCatalogSkeleton />}>
      <ModelsRoute />
    </Suspense>
  );
  if (!entries) return route;
  return <CatalogSnapshot entries={entries.map((entry) => catalogListItem(entry))}>{route}</CatalogSnapshot>;
}
