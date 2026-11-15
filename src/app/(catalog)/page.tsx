import { CatalogSnapshot } from "@/components/atlas/CatalogProvider";
import { HomeRoute } from "@/components/atlas/HomeRoute";
import { intelligenceIndex } from "@/lib/atlas/capabilityData";
import { homeSnapshot } from "@/lib/atlas/home";
import { getCatalogEntries, getRecentChanges } from "@/lib/atlas/serverCatalog";

export default async function HomePage() {
  const [entries, recentChanges] = await Promise.all([getCatalogEntries(), getRecentChanges(10)]);
  // Unreachable catalog: render loading states and let the browser subscription fill them.
  if (!entries) return <HomeRoute />;
  // Scores are matched here, on the server, so the snapshot file never ships to the browser.
  const index = intelligenceIndex(entries);
  const snapshot = homeSnapshot(entries, recentChanges ?? [], index.scores);
  const shown = new Set(snapshot.entries.map((entry) => entry.slug));
  const intelligence = {
    ...index,
    scores: Object.fromEntries(Object.entries(index.scores).filter(([slug]) => shown.has(slug))),
  };
  return (
    <CatalogSnapshot entries={snapshot.entries} recentChanges={recentChanges}>
      <HomeRoute snapshotStats={snapshot.stats} intelligence={intelligence} />
    </CatalogSnapshot>
  );
}
