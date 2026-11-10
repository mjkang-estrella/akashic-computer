"use client";

import { useMemo } from "react";
import { homeCatalogStats, type HomeCatalogStats } from "@/lib/atlas/home";
import { HomeView, type FeaturedDoc } from "./HomeView";
import { useAtlasUi } from "./AtlasShell";
import { useCatalog } from "./CatalogProvider";

export function HomeRoute({ snapshotStats, featuredDocs }: { snapshotStats?: HomeCatalogStats; featuredDocs: FeaturedDoc[] }) {
  const { rig } = useAtlasUi();
  const { entries, materialChanges, syncedAt, health, loading, revision, snapshot } = useCatalog();
  // The server snapshot holds only the entries the page shows, so its counts travel with it.
  const stats = useMemo(
    () => (snapshot && snapshotStats ? snapshotStats : homeCatalogStats(entries)),
    [entries, snapshot, snapshotStats],
  );

  return (
    <HomeView
      featuredDocs={featuredDocs}
      entries={entries}
      stats={stats}
      materialChanges={materialChanges}
      syncedAt={syncedAt}
      loading={loading}
      health={health}
      revision={revision}
      rig={rig}
    />
  );
}
