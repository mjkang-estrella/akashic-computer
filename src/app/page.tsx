import { AtlasApp } from "@/components/atlas/AtlasApp";
import { CatalogProvider } from "@/components/atlas/CatalogProvider";

export default function Home() {
  return (
    <CatalogProvider>
      <AtlasApp />
    </CatalogProvider>
  );
}
