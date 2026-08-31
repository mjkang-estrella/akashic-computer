"use client";

import { useRouter } from "next/navigation";
import { HomeView } from "@/components/atlas/HomeView";
import { useAtlasUi } from "@/components/atlas/AtlasShell";
import { useCatalog } from "@/components/atlas/CatalogProvider";

export default function HomePage() {
  const router = useRouter();
  const { rig } = useAtlasUi();
  const { entries, materialChanges, syncedAt, health, loading, revision } = useCatalog();

  return (
    <HomeView
      entries={entries}
      materialChanges={materialChanges}
      syncedAt={syncedAt}
      loading={loading}
      health={health}
      revision={revision}
      rig={rig}
      onOpenModel={(entry) => router.push(`/models/${entry.slug}`)}
      onViewModels={() => router.push("/models")}
      onViewBenchmarks={() => router.push("/benchmarks")}
      onOpenDoc={(slug) => router.push(`/docs/${slug}`)}
      onViewDocs={() => router.push("/docs")}
    />
  );
}
