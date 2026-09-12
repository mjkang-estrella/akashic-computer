import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AkashicSocialImage,
  SOCIAL_IMAGE_SIZE,
} from "@/components/brand/AkashicSocialImage";

export const alt = "Akashic — Open-weight models, made legible. Explore family, release, size, variant, and artifact.";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default async function TwitterImage() {
  const stixTwoBold = await readFile(
    join(process.cwd(), "src/app/assets/STIX2Text-Bold.otf"),
  );

  return new ImageResponse(<AkashicSocialImage />, {
    ...size,
    fonts: [
      {
        name: "STIX Two Text",
        data: stixTwoBold,
        style: "normal",
        weight: 700,
      },
    ],
  });
}
