import { CatalogShell } from "@/components/CatalogShell";

// No catalog data here: anything awaited in this layout would be embedded in every page.
// Pages that render lists pass their own entries through CatalogSnapshot.
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <CatalogShell>{children}</CatalogShell>;
}
