"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { homeCatalogStats, type HomeCatalogStats } from "@/lib/atlas/home";
import { HomeView } from "./HomeView";
import { useAtlasUi } from "./AtlasShell";
import { useCatalog } from "./CatalogProvider";

export function HomeRoute({ snapshotStats }: { snapshotStats?: HomeCatalogStats }) {
  const router = useRouter();
  const { rig } = useAtlasUi();
  const { entries, materialChanges, syncedAt, health, loading, revision, snapshot } = useCatalog();
  // The server snapshot holds only the entries the page shows, so its counts travel with it.
  const stats = useMemo(
    () => (snapshot && snapshotStats ? snapshotStats : homeCatalogStats(entries)),
    [entries, snapshot, snapshotStats],
  );

  return (
    <HomeView
      entries={entries}
      stats={stats}
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
