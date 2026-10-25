import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { isCatalogTag } from "@/lib/atlas/cacheTags";

const MAX_TAGS = 200;

function authorized(request: Request): boolean {
  const secret = process.env.CATALOG_REVALIDATE_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return false;
  // Equal-length digests keep the comparison constant-time for any token length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(secret));
}

/** Convex posts catalog cache tags here after public catalog data changes. */
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let tags: unknown;
  try {
    ({ tags } = (await request.json()) as { tags?: unknown });
  } catch {
    return Response.json({ error: "Malformed JSON" }, { status: 400 });
  }
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    tags.length > MAX_TAGS ||
    !tags.every((tag) => typeof tag === "string" && isCatalogTag(tag))
  ) {
    return Response.json({ error: `Expected 1 to ${MAX_TAGS} catalog tags` }, { status: 400 });
  }
  const unique = [...new Set(tags as string[])];
  // Stale-while-revalidate: each cached page regenerates on its next visit, not all at once.
  for (const tag of unique) revalidateTag(tag, "max");
  return Response.json({ revalidated: unique.length });
}
