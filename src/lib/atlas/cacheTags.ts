/**
 * Next.js cache tags on server-rendered catalog reads. Convex queues them when public
 * catalog data changes and posts them to /api/revalidate, so cached pages and data are
 * rewritten only after a real change.
 */
export const CATALOG_TAG = "catalog";
/** The published list: home, models, benchmarks and the sitemap. */
export const CATALOG_LIST_TAG = "catalog:list";
/** Recent material changes: home and the site feed. */
export const CATALOG_CHANGES_TAG = "catalog:changes";

const MODEL_TAG_PREFIX = "catalog:model:";
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,199}$/;

/** One model's page, feed and social images. */
export function catalogModelTag(slug: string): string {
  return `${MODEL_TAG_PREFIX}${slug}`;
}

export function isCatalogModelTag(tag: string): boolean {
  return tag.startsWith(MODEL_TAG_PREFIX) && SLUG_PATTERN.test(tag.slice(MODEL_TAG_PREFIX.length));
}

export function isCatalogTag(tag: string): boolean {
  return tag === CATALOG_TAG || tag === CATALOG_LIST_TAG || tag === CATALOG_CHANGES_TAG || isCatalogModelTag(tag);
}
