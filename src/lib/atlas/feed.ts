import type { MaterialChange } from "./types";

export const SITE_URL = "https://akashic.computer";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RSS 2.0 feed of material changes: weights, artifacts, runtimes and official recipes. */
export function materialChangesRss({
  title,
  description,
  path,
  feedPath,
  changes,
}: {
  title: string;
  description: string;
  path: string;
  feedPath: string;
  changes: MaterialChange[];
}): string {
  const items = [...changes]
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .map((change) => {
      const link = `${SITE_URL}/models/${change.modelSlug}`;
      const source = change.sourceUrls[0];
      const body = `${change.summary}${source ? ` Source: ${change.sourceLabel} (${source}).` : ""}`;
      return [
        "    <item>",
        `      <title>${escapeXml(`${change.modelName}: ${change.title}`)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(change.id)}</guid>`,
        `      <pubDate>${new Date(change.occurredAt).toUTCString()}</pubDate>`,
        `      <category>${escapeXml(change.type)}</category>`,
        `      <description>${escapeXml(body)}</description>`,
        "    </item>",
      ].join("\n");
    });
  const updated = changes.reduce((latest, change) => Math.max(latest, change.occurredAt), 0);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(`${SITE_URL}${path}`)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    "    <language>en</language>",
    `    <atom:link href="${escapeXml(`${SITE_URL}${feedPath}`)}" rel="self" type="application/rss+xml"/>`,
    ...(updated ? [`    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
