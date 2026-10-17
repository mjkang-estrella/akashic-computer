import type { MemoryArchitecture } from "./memory";

export interface ArtifactFile {
  path: string;
  bytes: number | null;
  sha256?: string;
  gitOid?: string;
}
export interface ArtifactBuild {
  modelSlug?: string;
  key: string;
  repo: string;
  revision: string;
  label: string;
  files: ArtifactFile[];
  bytes: number | null;
  complete: boolean;
  container: "gguf" | "safetensors" | "other";
  quantization: string;
  precisionBits?: number;
  effectiveBits?: number;
  mtp: "present" | "absent" | "unknown";
  baseModels: string[];
  architecture?: MemoryArchitecture;
  sourceUrl: string;
}

const record = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {};
export const isPinnedRevision = (x: string) => /^[a-f0-9]{40}$/i.test(x);
export const safeArtifactPath = (x: string) =>
  x.length > 0 && x.length <= 512 && !x.startsWith("/") &&
  !x.split("/").some((p) => !p || p === "." || p === "..") && !/[\x00-\x1f\\]/.test(x);

/** Repository revision + exact path/group is immutable; hashes retain their algorithm. */
export function artifactBuildKey(repo: string, revision: string, group: string) {
  return encodeURIComponent(repo.toLowerCase()) + "@" + revision + ":" + encodeURIComponent(group);
}

export function filesFromTree(entries: unknown[]): ArtifactFile[] {
  const files = new Map<string, ArtifactFile>();
  for (const value of entries) {
    const row = record(value);
    const path = String(row.path ?? row.rfilename ?? "");
    if ((row.type && row.type !== "file") || !safeArtifactPath(path)) continue;
    if (!/\.(gguf|safetensors)$/i.test(path) || /(?:^|\/)mmproj/i.test(path)) continue;
    const lfs = record(row.lfs);
    const digest = lfs.sha256 ?? lfs.oid;
    const size = row.size ?? lfs.size;
    files.set(path, {
      path, bytes: Number.isSafeInteger(size) && Number(size) > 0 ? Number(size) : null,
      ...(typeof digest === "string" && /^[a-f0-9]{64}$/i.test(digest) ? { sha256: digest.toLowerCase() } : {}),
      ...(typeof row.oid === "string" ? { gitOid: row.oid } : {}),
    });
  }
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export interface BuildOmission {
  label: string;
  reason: string;
}

export function buildsFromFiles(
  repo: string, revision: string, files: ArtifactFile[], baseModels: string[],
  options: {
    format?: string; architecture?: MemoryArchitecture; mtp?: ArtifactBuild["mtp"];
    onOmit?: (omission: BuildOmission) => void;
  } = {},
): ArtifactBuild[] {
  if (!isPinnedRevision(revision)) return [];
  // Two shardings of one name (e.g. -of-00002 and -of-00003) are distinct builds.
  const sharded = new Map<string, { base: string; files: ArtifactFile[]; expected: number; parts: Set<number> }>();
  for (const file of files) {
    const shard = file.path.match(/^(.*)-(\d{5})-of-(\d{5})(\.(?:gguf|safetensors))$/i);
    const base = shard ? shard[1] + shard[4] : file.path;
    const expected = shard ? Number(shard[3]) : 1;
    const key = shard ? `${base}\n${expected}` : base;
    const group = sharded.get(key) ?? { base, files: [], expected, parts: new Set<number>() };
    group.files.push(file);
    group.parts.add(shard ? Number(shard[2]) : 1);
    sharded.set(key, group);
  }
  // Labels stay stable; only a name shared by several shardings gains its shard count.
  const baseUses = new Map<string, number>();
  for (const group of sharded.values()) baseUses.set(group.base, (baseUses.get(group.base) ?? 0) + 1);
  const groups = new Map<string, { base: string; files: ArtifactFile[]; expected: number; parts: Set<number> }>();
  for (const [key, group] of sharded) {
    const ambiguous = (baseUses.get(group.base) ?? 0) > 1 && key !== group.base;
    const label = ambiguous
      ? group.base.replace(/(\.(?:gguf|safetensors))$/i, `-of-${String(group.expected).padStart(5, "0")}$1`)
      : group.base;
    groups.set(label, group);
  }
  // Bound individual documents and mutation payloads; never truncate a manifest.
  // An oversized build is omitted whole, leaving that file set at repository-estimate level.
  if (groups.size > 256) {
    options.onOmit?.({ label: "*", reason: "Repository exceeds 256 build groups" });
    return [];
  }
  return [...groups].flatMap(([groupPath, group]): ArtifactBuild[] => {
    if (group.files.length > 256) {
      options.onOmit?.({ label: groupPath, reason: "Build exceeds 256 shards" });
      return [];
    }
    const gguf = /\.gguf$/i.test(group.base);
    const quant = gguf
      ? group.base.match(/(?:^|[-_])((?:UD-)?(?:MXFP|NVFP|IQ|Q|BF|F)\d[\w-]*?)(?:\.gguf)$/i)?.[1]?.toUpperCase() ?? "Unknown"
      : options.format ?? "Unknown";
    const nominal = quant.match(/(?:MXFP|NVFP|IQ|Q|BF|F)(\d+)/)?.[1] ?? quant.match(/MLX\s+(\d+)/i)?.[1];
    const complete = group.files.length === group.expected && group.parts.size === group.expected &&
      [...group.parts].every((part) => part >= 1 && part <= group.expected);
    return [{
      key: artifactBuildKey(repo, revision, groupPath), repo, revision, label: groupPath,
      files: group.files, complete,
      bytes: complete && group.files.every((f) => f.bytes !== null) ? group.files.reduce((n, f) => n + f.bytes!, 0) : null,
      container: gguf ? "gguf" : "safetensors", quantization: quant,
      ...(nominal ? { precisionBits: Number(nominal) } : {}),
      mtp: options.mtp ?? "unknown", baseModels,
      ...(options.architecture ? { architecture: options.architecture } : {}),
      sourceUrl: "https://huggingface.co/" + repo + "/tree/" + revision,
    }];
  });
}

export function artifactDownloadUrl(build: ArtifactBuild, file: ArtifactFile) {
  return "https://huggingface.co/" + build.repo.split("/").map(encodeURIComponent).join("/") +
    "/resolve/" + encodeURIComponent(build.revision) + "/" + file.path.split("/").map(encodeURIComponent).join("/");
}
