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
  health: {
    catalogStale: boolean;
  } | null;
  loading: boolean;
  source: "convex" | "snapshot";
}

const snapshot: CatalogContextValue = {
  entries: MODEL_ENTRIES,
  families: FAMILIES,
  compareModels: compareModelsForEntries(MODEL_ENTRIES),
  revision: "migration-snapshot",
  syncedAt: null,
  health: null,
  loading: false,
  source: "snapshot",
};

const loadingCatalog: CatalogContextValue = {
  entries: [],
  families: [],
  compareModels: [],
  revision: "loading",
  syncedAt: null,
  health: null,
  loading: true,
  source: "convex",
};

const CatalogContext = createContext<CatalogContextValue>(snapshot);

function absoluteHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function RemoteCatalogProvider({ children }: { children: ReactNode }) {
  const result = useQuery(api.catalog.listPublished);
  const value = useMemo<CatalogContextValue>(() => {
    if (!result) return loadingCatalog;
    const hydrated = hydratePublishedEntries(result.entries as PublishedCatalogEntry[]);
    return {
      ...hydrated,
      compareModels: compareModelsForEntries(hydrated.entries),
      revision: result.revision,
      syncedAt: result.syncedAt,
      health: {
        catalogStale: result.catalogStale,
      },
      loading: false,
      source: "convex",
    };
  }, [result]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

const configuredConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexUrl = absoluteHttpUrl(configuredConvexUrl);
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
const invalidConvexUrl = Boolean(configuredConvexUrl && !convexUrl);

export function CatalogProvider({ children }: { children: ReactNode }) {
  if (!convexClient) {
    const value = invalidConvexUrl
      ? { ...snapshot, health: { catalogStale: true } }
      : snapshot;
    return (
      <CatalogContext.Provider value={value}>
        {invalidConvexUrl && (
          <div role="alert" className="border-b border-line bg-panel2 px-4 py-2 text-center text-[12px] text-muted">
            Live catalog unavailable: the Convex deployment URL is invalid. Showing the bundled snapshot.
          </div>
        )}
        {children}
      </CatalogContext.Provider>
    );
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
