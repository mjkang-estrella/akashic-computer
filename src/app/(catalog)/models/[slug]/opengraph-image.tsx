import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SOCIAL_IMAGE_SIZE } from "@/components/brand/AkashicSocialImage";
import { ModelSocialImage } from "@/components/brand/ModelSocialImage";
import { hydratePublishedEntries } from "@/lib/atlas/published";
import { parameterTotalLabel } from "@/lib/atlas/naming";
import { getCatalogEntry } from "@/lib/atlas/serverCatalog";

export const alt = "Open-weight model on Akashic Computer";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [published, stixTwoBold] = await Promise.all([
    getCatalogEntry(slug),
    readFile(join(process.cwd(), "src/app/assets/STIX2Text-Bold.otf")),
  ]);
  const entry = published ? hydratePublishedEntries([published]).entries[0] : null;
  const formats = entry
    ? [...new Set(entry.artifacts.map((artifact) => artifact.format))].filter((format) => format !== "Unknown")
    : [];
  const facts = entry
    ? [
        entry.family.vendor,
        `${parameterTotalLabel(entry.size)} parameters`,
        ...(entry.context !== "N/A" ? [`${entry.context} context`] : []),
        `${entry.artifacts.length} ${entry.artifacts.length === 1 ? "artifact" : "artifacts"}`,
      ]
    : ["Open-weight model atlas"];
  return new ImageResponse(
    <ModelSocialImage name={entry?.name ?? "Akashic Computer"} facts={facts} formats={formats} />,
    {
      ...size,
      fonts: [{ name: "STIX Two Text", data: stixTwoBold, style: "normal", weight: 700 }],
    },
  );
}
