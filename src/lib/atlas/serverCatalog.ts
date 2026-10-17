import { cache } from "react";
import type { PublishedCatalogEntry, PublishedCatalogSummary } from "./published";
import type { MaterialChange } from "./types";

/**
 * Server-rendered pages read the same public Convex queries as the browser, through
 * Next's data cache so crawlers and first paints do not each query the database. The
 * browser subscription replaces this snapshot with live data after hydration.
 */
export const CATALOG_REVALIDATE_SECONDS = 300;

export interface CatalogSnapshot {
  entries: PublishedCatalogSummary[];
  syncedAt: number | null;
  revision: string;
}

function convexUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** Undefined means the catalog is unavailable; callers fall back to client loading states. */
async function publicQuery<T>(path: string, args: Record<string, unknown>): Promise<T | undefined> {
  const url = convexUrl();
  if (!url) return undefined;
  try {
    const response = await fetch(`${url}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
      cache: "force-cache",
      next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] },
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { status?: string; value?: T };
    return body.status === "success" ? (body.value as T) : undefined;
  } catch {
    return undefined;
  }
}

export const getCatalogSnapshot = cache(() =>
  publicQuery<CatalogSnapshot>("catalog:listPublished", {}),
);

/** Null is a confirmed absence; undefined means the catalog could not be reached. */
export const getCatalogEntry = cache((slug: string) =>
  publicQuery<PublishedCatalogEntry | null>("catalog:getBySlug", { slug }),
);

export const getRecentChanges = cache((limit: number) =>
  publicQuery<MaterialChange[]>("intelligence:listRecentChanges", { limit }),
);
