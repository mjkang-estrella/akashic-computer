import { CatalogShell } from "@/components/CatalogShell";
import { getCatalogSnapshot, getRecentChanges } from "@/lib/atlas/serverCatalog";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const [snapshot, recentChanges] = await Promise.all([getCatalogSnapshot(), getRecentChanges(10)]);
  return (
    <CatalogShell initial={snapshot ? { ...snapshot, recentChanges } : undefined}>
      {children}
    </CatalogShell>
  );
}
