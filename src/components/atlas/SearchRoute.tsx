"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCatalog } from "./CatalogProvider";
import { SearchView } from "./SearchView";

export function SearchRoute() {
  const query = useSearchParams().get("q") ?? "";
  const router = useRouter();
  const { entries, families, loading } = useCatalog();
  return <SearchView query={query} entries={entries} families={families} loading={loading} onClear={() => router.replace("/")} />;
}
