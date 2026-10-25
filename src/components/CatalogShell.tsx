"use client";
import type { ReactNode } from "react";
import { ComparisonProvider } from "./comparison/ComparisonProvider";
import { AtlasShell } from "./atlas/AtlasShell";
import { CatalogProvider } from "./atlas/CatalogProvider";

export function CatalogShell({ children }: { children: ReactNode }) {
  return (
    <CatalogProvider>
      <ComparisonProvider><AtlasShell>{children}</AtlasShell></ComparisonProvider>
    </CatalogProvider>
  );
}
