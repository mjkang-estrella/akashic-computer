"use client";

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ModelEntry } from "@/lib/atlas/models";
import {
  hydrateCatalogListItems,
  hydratePublishedEntries,
  type CatalogListItem,
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
  /** True while a page's server-rendered entries stand in for the live subscription. */
  snapshot: boolean;
}

const loadingCatalog: CatalogContextValue = {
  entries: [],
  families: [],
  materialChanges: [],
  revision: "loading",
  syncedAt: null,
  health: null,
  loading: true,
  snapshot: false,
};

const CatalogContext = createContext<CatalogContextValue | null>(null);
const SnapshotContext = createContext<CatalogContextValue | null>(null);

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
  const [loadedAt, setLoadedAt] = useState(() => Math.floor(Date.now() / 60_000) * 60_000);
  useEffect(() => {
    const update = () => setLoadedAt(Math.floor(Date.now() / 60_000) * 60_000);
    const timer = setInterval(update, 1_000);
    window.addEventListener("focus", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
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
      snapshot: false,
    };
  }, [recentChanges, result, sourceHealth]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

const configuredConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexUrl = absoluteHttpUrl(configuredConvexUrl);

export function CatalogProvider({ children }: { children: ReactNode }) {
  if (!convexUrl) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[760px] items-center px-5 py-16">
        <section role="alert" className="w-full border-y border-line py-8">
          <h1 className="font-display text-[28px] font-semibold">Catalog unavailable</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Akashic Computer requires a valid NEXT_PUBLIC_CONVEX_URL. No bundled catalog is used.
          </p>
        </section>
      </main>
    );
  }
  return <RemoteCatalogProvider>{children}</RemoteCatalogProvider>;
}

/**
 * Server-rendered entries for one page, shown until the live subscription answers. Pages
 * pass only what they render (see CatalogListItem); the shared layout carries none, so a
 * model page's HTML holds its own entry rather than the whole catalog. The revision and
 * sync time stay unresolved because they change on every sync and would make each cached
 * page differ from the last.
 */
export function CatalogSnapshot({
  children,
  entries,
  recentChanges,
}: {
  children: ReactNode;
  entries: CatalogListItem[];
  recentChanges?: MaterialChange[];
}) {
  const value = useMemo<CatalogContextValue>(() => ({
    ...hydrateCatalogListItems(entries),
    materialChanges: recentChanges ?? [],
    revision: loadingCatalog.revision,
    syncedAt: null,
    health: null,
    loading: false,
    snapshot: true,
  }), [entries, recentChanges]);
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

export function useCatalog() {
  const live = useContext(CatalogContext);
  const snapshot = useContext(SnapshotContext);
  if (!live) throw new Error("useCatalog must be used inside CatalogProvider");
  return useMemo(
    () => (live.loading && snapshot ? { ...snapshot, health: live.health } : live),
    [live, snapshot],
  );
}

export function useCatalogEntry(
  slug: string,
  initial?: PublishedCatalogEntry | null,
): ModelEntry | null | undefined {
  // A live null (removed model) must replace the server snapshot, so only undefined falls back.
  const live = useQuery(api.catalog.getBySlug, { slug });
  const result = live === undefined ? initial : live;
  if (result === undefined || result === null) return result;
  return hydratePublishedEntries([result as PublishedCatalogEntry]).entries[0] ?? null;
}
