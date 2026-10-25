import type { Metadata } from "next";
import { BenchmarksRoute } from "@/components/atlas/BenchmarksRoute";
import { CatalogSnapshot } from "@/components/atlas/CatalogProvider";
import { benchmarkSnapshot } from "@/lib/atlas/benchmarks";
import { getCatalogEntries } from "@/lib/atlas/serverCatalog";

export const metadata: Metadata = {
  title: "Benchmarks",
  description: "Creator-reported benchmark results for open-weight models, with sources for every number.",
  alternates: { canonical: "/benchmarks" },
};

export default async function BenchmarksPage() {
  const entries = await getCatalogEntries();
  if (!entries) return <BenchmarksRoute />;
  return (
    <CatalogSnapshot entries={benchmarkSnapshot(entries)}>
      <BenchmarksRoute />
    </CatalogSnapshot>
  );
}
