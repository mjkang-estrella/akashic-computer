"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FAMILIES } from "@/lib/atlas/catalog";
import { MODEL_ENTRIES, type ModelEntry } from "@/lib/atlas/models";
import {
  compareModelsForEntries,
  hydratePublishedEntries,
  type PublishedCatalogEntry,
} from "@/lib/atlas/published";
import type { CompareModel, Family } from "@/lib/atlas/types";

interface CatalogContextValue {
  entries: ModelEntry[];
  families: Family[];
  compareModels: CompareModel[];
  revision: string;
  syncedAt: number | null;
  loading: boolean;
  source: "convex" | "snapshot";
}

const snapshot: CatalogContextValue = {
  entries: MODEL_ENTRIES,
  families: FAMILIES,
  compareModels: compareModelsForEntries(MODEL_ENTRIES),
  revision: "migration-snapshot",
  syncedAt: null,
  loading: false,
  source: "snapshot",
};

const CatalogContext = createContext<CatalogContextValue>(snapshot);

function RemoteCatalogProvider({ children }: { children: ReactNode }) {
  const result = useQuery(api.catalog.listPublished);
  const value = useMemo<CatalogContextValue>(() => {
    if (!result) return { ...snapshot, loading: true };
    const hydrated = hydratePublishedEntries(result.entries as PublishedCatalogEntry[]);
    return {
      ...hydrated,
      compareModels: compareModelsForEntries(hydrated.entries),
      revision: result.revision,
      syncedAt: result.syncedAt,
      loading: false,
      source: "convex",
    };
  }, [result]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function CatalogProvider({ children }: { children: ReactNode }) {
  if (!convexClient) {
    return <CatalogContext.Provider value={snapshot}>{children}</CatalogContext.Provider>;
  }
  return (
    <ConvexProvider client={convexClient}>
      <RemoteCatalogProvider>{children}</RemoteCatalogProvider>
    </ConvexProvider>
  );
}

export function useCatalog() {
  return useContext(CatalogContext);
}
