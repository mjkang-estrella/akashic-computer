"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ModelEntry } from "@/lib/atlas/models";
import {
  hydratePublishedEntries,
  type PublishedCatalogEntry,
  type PublishedCatalogSummary,
} from "@/lib/atlas/published";
import type { Family, MaterialChange } from "@/lib/atlas/types";

interface CatalogContextValue {
  entries: ModelEntry[];
  families: Family[];
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
}

const loadingCatalog: CatalogContextValue = {
  entries: [],
  families: [],
  materialChanges: [],
  revision: "loading",
  syncedAt: null,
  health: null,
  loading: true,
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

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
    const hydrated = hydratePublishedEntries(result.entries as PublishedCatalogSummary[]);
    return {
      ...hydrated,
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
    };
  }, [recentChanges, result, sourceHealth]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

const configuredConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexUrl = absoluteHttpUrl(configuredConvexUrl);
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
export function CatalogProvider({ children }: { children: ReactNode }) {
  if (!convexClient) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[760px] items-center px-5 py-16">
        <section role="alert" className="w-full border-y border-line py-8">
          <h1 className="font-display text-[28px] font-semibold">Catalog unavailable</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Akashic requires a valid NEXT_PUBLIC_CONVEX_URL. No bundled catalog is used.
          </p>
        </section>
      </main>
    );
  }
  return (
    <ConvexProvider client={convexClient}>
      <RemoteCatalogProvider>{children}</RemoteCatalogProvider>
    </ConvexProvider>
  );
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside CatalogProvider");
  return value;
}

export function useCatalogEntry(slug: string): ModelEntry | null | undefined {
  const result = useQuery(api.catalog.getBySlug, { slug });
  if (result === undefined || result === null) return result;
  return hydratePublishedEntries([result as PublishedCatalogEntry]).entries[0] ?? null;
}
