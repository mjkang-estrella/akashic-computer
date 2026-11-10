"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BenchmarkView } from "./BenchmarkView";
import { useCatalog } from "./CatalogProvider";

export function BenchmarksRoute() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { entries } = useCatalog();
  return (
    <>
    <label className="mt-5 flex min-h-11 items-center gap-2 rounded-[7px] border border-line bg-panel px-3 py-1.5 sm:min-h-9">
      <span className="text-[13px] text-muted">Filter benchmarks or models</span>
      <input type="search" aria-label="Filter benchmarks or models" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
    </label>
    <BenchmarkView
      entries={entries}
      query={query}
      onOpen={(entry) => router.push(`/models/${entry.slug}`)}
    />
    </>
  );
}
