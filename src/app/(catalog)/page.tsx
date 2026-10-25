import { CatalogSnapshot } from "@/components/atlas/CatalogProvider";
import { HomeRoute } from "@/components/atlas/HomeRoute";
import { homeSnapshot } from "@/lib/atlas/home";
import { getCatalogEntries, getRecentChanges } from "@/lib/atlas/serverCatalog";

export default async function HomePage() {
  const [entries, recentChanges] = await Promise.all([getCatalogEntries(), getRecentChanges(10)]);
  // Unreachable catalog: render loading states and let the browser subscription fill them.
  if (!entries) return <HomeRoute />;
  const snapshot = homeSnapshot(entries, recentChanges ?? []);
  return (
    <CatalogSnapshot entries={snapshot.entries} recentChanges={recentChanges}>
      <HomeRoute snapshotStats={snapshot.stats} />
    </CatalogSnapshot>
  );
}
