import type { Metadata } from "next";
import { CatalogSnapshot } from "@/components/atlas/CatalogProvider";
import { ModelsRoute } from "@/components/atlas/ModelsRoute";
import { catalogListItem } from "@/lib/atlas/published";
import { getCatalogEntries } from "@/lib/atlas/serverCatalog";

export const metadata: Metadata = {
  title: "Models",
  description: "Open-weight model releases by family and parameter size, with quantized artifacts, providers and memory estimates.",
  alternates: { canonical: "/models" },
};

export default async function ModelsPage() {
  const entries = await getCatalogEntries();
  const route = <ModelsRoute />;
  if (!entries) return route;
  return <CatalogSnapshot entries={entries.map((entry) => catalogListItem(entry))}>{route}</CatalogSnapshot>;
}
