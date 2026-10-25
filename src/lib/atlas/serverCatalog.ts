import { cache } from "react";
import { CATALOG_CHANGES_TAG, CATALOG_LIST_TAG, CATALOG_TAG, catalogModelTag } from "./cacheTags";
import type { PublishedCatalogEntry, PublishedCatalogSummary } from "./published";
import type { MaterialChange } from "./types";

/**
 * Server-rendered pages read the same public Convex queries as the browser, through
 * Next's data cache so crawlers and first paints do not each query the database. The
 * browser subscription replaces this data with live results after hydration.
 *
 * Convex revalidates these tags when public data changes (see convex/siteRevalidation.ts);
 * this interval is only a safety net. Route segment `revalidate` exports repeat it as a literal.
 */
export const CATALOG_REVALIDATE_SECONDS = 86_400;

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
async function publicQuery<T>(path: string, args: Record<string, unknown>, tags: string[]): Promise<T | undefined> {
  const url = convexUrl();
  if (!url) return undefined;
  try {
    const response = await fetch(`${url}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
      cache: "force-cache",
      next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAG, ...tags] },
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { status?: string; value?: T };
    return body.status === "success" ? (body.value as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Published list entries only. The snapshot's `syncedAt` and `revision` change on every
 * sync, so they are kept out of rendered output; the live subscription supplies them.
 */
export const getCatalogEntries = cache(async () => {
  const snapshot = await publicQuery<{ entries: PublishedCatalogSummary[] }>(
    "catalog:listPublished",
    {},
    [CATALOG_LIST_TAG],
  );
  return snapshot?.entries;
});

/** Null is a confirmed absence; undefined means the catalog could not be reached. */
export const getCatalogEntry = cache((slug: string) =>
  publicQuery<PublishedCatalogEntry | null>("catalog:getBySlug", { slug }, [catalogModelTag(slug)]),
);

export const getRecentChanges = cache((limit: number) =>
  publicQuery<MaterialChange[]>("intelligence:listRecentChanges", { limit }, [CATALOG_CHANGES_TAG]),
);
