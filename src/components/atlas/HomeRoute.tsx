"use client";

import { useMemo } from "react";
import type { IntelligenceIndex } from "@/lib/atlas/capabilityTypes";
import { homeCatalogStats, type HomeCatalogStats } from "@/lib/atlas/home";
import { HomeView } from "./HomeView";
import { useCatalog } from "./CatalogProvider";

export function HomeRoute({
  snapshotStats,
  intelligence,
}: {
  snapshotStats?: HomeCatalogStats;
  intelligence?: IntelligenceIndex;
}) {
  const { entries, materialChanges, syncedAt, health, loading, snapshot } = useCatalog();
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
      intelligence={intelligence ?? null}
    />
  );
}
