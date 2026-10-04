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

export function buildsFromFiles(
  repo: string, revision: string, files: ArtifactFile[], baseModels: string[],
  options: { format?: string; architecture?: MemoryArchitecture; mtp?: ArtifactBuild["mtp"] } = {},
): ArtifactBuild[] {
  if (!isPinnedRevision(revision)) return [];
  const groups = new Map<string, { files: ArtifactFile[]; expected: number; parts: Set<number> }>();
  for (const file of files) {
    const shard = file.path.match(/^(.*)-(\d{5})-of-(\d{5})(\.(?:gguf|safetensors))$/i);
    const key = shard ? shard[1] + shard[4] : file.path;
    const group = groups.get(key) ?? { files: [], expected: shard ? Number(shard[3]) : 1, parts: new Set<number>() };
    if (shard && group.expected !== Number(shard[3])) throw new Error("Conflicting shard counts");
    group.files.push(file);
    group.parts.add(shard ? Number(shard[2]) : 1);
    groups.set(key, group);
  }
  // Bound individual documents and mutation payloads; never silently truncate a manifest.
  if (groups.size > 256) throw new Error("Repository exceeds 256 build groups");
  return [...groups].map(([groupPath, group]) => {
    if (group.files.length > 256) throw new Error("Build exceeds 256 shards");
    const gguf = /\.gguf$/i.test(groupPath);
    const quant = gguf
      ? groupPath.match(/(?:^|[-_])((?:UD-)?(?:IQ|Q|BF|F)\d[\w-]*?)(?:\.gguf)$/i)?.[1]?.toUpperCase() ?? "Unknown"
      : options.format ?? "Unknown";
    const nominal = quant.match(/(?:IQ|Q|BF|F)(\d+)/)?.[1] ?? quant.match(/MLX\s+(\d+)/i)?.[1];
    const complete = group.files.length === group.expected && group.parts.size === group.expected &&
      [...group.parts].every((part) => part >= 1 && part <= group.expected);
    return {
      key: artifactBuildKey(repo, revision, groupPath), repo, revision, label: groupPath,
      files: group.files, complete,
      bytes: complete && group.files.every((f) => f.bytes !== null) ? group.files.reduce((n, f) => n + f.bytes!, 0) : null,
      container: gguf ? "gguf" : "safetensors", quantization: quant,
      ...(nominal ? { precisionBits: Number(nominal) } : {}),
      mtp: options.mtp ?? "unknown", baseModels,
      ...(options.architecture ? { architecture: options.architecture } : {}),
      sourceUrl: "https://huggingface.co/" + repo + "/tree/" + revision,
    };
  });
}

export function artifactDownloadUrl(build: ArtifactBuild, file: ArtifactFile) {
  return "https://huggingface.co/" + build.repo.split("/").map(encodeURIComponent).join("/") +
    "/resolve/" + encodeURIComponent(build.revision) + "/" + file.path.split("/").map(encodeURIComponent).join("/");
}
