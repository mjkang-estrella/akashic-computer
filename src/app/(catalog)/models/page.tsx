import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { ModelsRoute } from "@/components/atlas/ModelsRoute";
import { ModelCatalogSkeleton } from "@/components/atlas/ModelCatalogView";

export const metadata: Metadata = {
  title: "Models",
  description: "Open-weight model releases by family and parameter size, with quantized artifacts, providers and memory estimates.",
  alternates: { canonical: "/models" },
};

export default async function ModelsPage() {
  // Filters live in the URL; rendering per request lets a shared filter link arrive filtered.
  await connection();
  return (
    <Suspense fallback={<ModelCatalogSkeleton />}>
      <ModelsRoute />
    </Suspense>
  );
}
