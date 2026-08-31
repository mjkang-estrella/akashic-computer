"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FAMILIES } from "@/lib/atlas/catalog";
import { MODEL_ENTRIES, type ModelEntry } from "@/lib/atlas/models";
import {
  compareModelsForEntries,
  hydratePublishedEntries,
  type PublishedCatalogEntry,
} from "@/lib/atlas/published";
import type { CompareModel, Family, MaterialChange } from "@/lib/atlas/types";

interface CatalogContextValue {
  entries: ModelEntry[];
  families: Family[];
  compareModels: CompareModel[];
  materialChanges: MaterialChange[];
  revision: string;
  syncedAt: number | null;
  health: {
    level: "healthy" | "degraded" | "stale";
    catalogStale: boolean;
    catalogDegraded: boolean;
    sourceTotal: number;
    freshSourceCount: number;
    staleSourceCount: number;
    failingSourceCount: number;
    retryingSourceCount: number;
    staleSources: string[];
    pendingWebhookCount: number;
    failedWebhookCount: number;
    webhookStale: boolean;
    lastCompletedAuditAt: number | null;
  } | null;
  loading: boolean;
  source: "convex" | "snapshot";
}

const snapshot: CatalogContextValue = {
  entries: MODEL_ENTRIES,
  families: FAMILIES,
  compareModels: compareModelsForEntries(MODEL_ENTRIES),
  materialChanges: [],
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
  materialChanges: [],
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
  const [loadedAt] = useState(() => Date.now());
  const result = useQuery(api.catalog.listPublished);
  const recentChanges = useQuery(api.intelligence.listRecentChanges, { limit: 10 });
  const sourceHealth = useQuery(api.catalog.healthSummary, { now: loadedAt });
  const value = useMemo<CatalogContextValue>(() => {
    if (!result) return loadingCatalog;
    const hydrated = hydratePublishedEntries(result.entries as PublishedCatalogEntry[]);
    return {
      ...hydrated,
      compareModels: compareModelsForEntries(hydrated.entries),
      materialChanges: recentChanges ?? hydrated.entries
        .flatMap((entry) => entry.materialChanges)
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .slice(0, 10),
      revision: result.revision,
      syncedAt: result.syncedAt,
      health: sourceHealth ? {
        level: sourceHealth.level,
        catalogStale: sourceHealth.level === "stale",
        catalogDegraded: sourceHealth.level === "degraded",
        sourceTotal: sourceHealth.sourceTotal,
        freshSourceCount: sourceHealth.freshSourceCount,
        staleSourceCount: sourceHealth.staleSourceCount,
        failingSourceCount: sourceHealth.failingSourceCount,
        retryingSourceCount: sourceHealth.retryingSourceCount,
        staleSources: sourceHealth.staleSources,
        pendingWebhookCount: sourceHealth.pendingWebhookCount,
        failedWebhookCount: sourceHealth.failedWebhookCount,
        webhookStale: sourceHealth.webhookStale,
        lastCompletedAuditAt: sourceHealth.lastCompletedAuditAt,
      } : null,
      loading: false,
      source: "convex",
    };
  }, [recentChanges, result, sourceHealth]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

const configuredConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexUrl = absoluteHttpUrl(configuredConvexUrl);
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
const invalidConvexUrl = Boolean(configuredConvexUrl && !convexUrl);

export function CatalogProvider({ children }: { children: ReactNode }) {
  if (!convexClient) {
    const value = invalidConvexUrl
      ? {
          ...snapshot,
          health: {
            level: "stale" as const,
            catalogStale: true,
            catalogDegraded: false,
            sourceTotal: 0,
            freshSourceCount: 0,
            staleSourceCount: 0,
            failingSourceCount: 0,
            retryingSourceCount: 0,
            staleSources: [],
            pendingWebhookCount: 0,
            failedWebhookCount: 0,
            webhookStale: false,
            lastCompletedAuditAt: null,
          },
        }
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
