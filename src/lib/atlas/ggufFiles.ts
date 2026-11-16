import type { ArtifactBuild } from "./artifactBuilds";

/** One runnable quantization inside a GGUF repository. */
export interface GgufFile {
  /** The file's quantization tag as runtimes address it, such as `UD-Q4_K_XL`. */
  quantization: string;
  /** Nominal bits per weight read from the tag; null when the tag does not say. */
  bits: number | null;
  /** Total bytes of the file set (all shards). */
  bytes: number;
}

/** Nominal bits from a GGUF tag: `Q4_K_M` → 4, `UD-IQ1_S` → 1, `BF16` → 16. */
export function ggufBits(quantization: string): number | null {
  const tag = quantization.toUpperCase();
  const float = tag.match(/(?:^|[^A-Z])B?F(16|32)(?:$|[^0-9])/);
  if (float) return Number(float[1]);
  const quant = tag.match(/(?:^|[^A-Z])I?Q(\d)(?:$|[^0-9])/);
  return quant ? Number(quant[1]) : null;
}

/**
 * Complete GGUF file sets from a repository's build manifest, largest first. A tag listed
 * twice keeps its larger file set so the estimate never understates what downloads.
 */
export function ggufFiles(builds: ArtifactBuild[]): GgufFile[] {
  const byTag = new Map<string, GgufFile>();
  for (const build of builds) {
    if (build.container !== "gguf" || !build.complete || !build.bytes || build.bytes <= 0) continue;
    const quantization = build.quantization.trim();
    if (!quantization) continue;
    const existing = byTag.get(quantization);
    if (!existing || build.bytes > existing.bytes) {
      byTag.set(quantization, { quantization, bits: ggufBits(quantization), bytes: build.bytes });
    }
  }
  return [...byTag.values()].sort((left, right) => right.bytes - left.bytes || left.quantization.localeCompare(right.quantization));
}
