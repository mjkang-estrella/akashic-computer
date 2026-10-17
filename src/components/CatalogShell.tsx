"use client";
import type { ReactNode } from "react";
import { ComparisonProvider } from "./comparison/ComparisonProvider";
import { AtlasShell } from "./atlas/AtlasShell";
import { CatalogProvider, type InitialCatalog } from "./atlas/CatalogProvider";

export function CatalogShell({ children, initial }: { children: ReactNode; initial?: InitialCatalog }) {
  return (
    <CatalogProvider initial={initial}>
      <ComparisonProvider><AtlasShell>{children}</AtlasShell></ComparisonProvider>
    </CatalogProvider>
  );
}
