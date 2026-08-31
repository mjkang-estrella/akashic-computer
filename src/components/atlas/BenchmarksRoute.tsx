"use client";

import { useRouter } from "next/navigation";
import { BenchmarkView } from "./BenchmarkView";
import { useCatalog } from "./CatalogProvider";

export function BenchmarksRoute() {
  const router = useRouter();
  const { entries } = useCatalog();
  return (
    <BenchmarkView
      entries={entries}
      query=""
      onOpen={(entry) => router.push(`/models/${entry.slug}`)}
    />
  );
}
