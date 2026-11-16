import type { ArtifactBuild } from "./artifactBuilds";
import { ggufFiles, type GgufFile } from "./ggufFiles";

export interface ManifestPage {
  page: ArtifactBuild[];
  isDone: boolean;
  continueCursor: string;
}
export interface ManifestRequest {
  repo: string;
  revision?: string;
  paginationOpts: { numItems: number; cursor: string | null };
}
export const manifestRequestKey = (request: ManifestRequest) => JSON.stringify(request);
export const firstManifestRequest = (repo: string): ManifestRequest => ({ repo, paginationOpts: { numItems: 50, cursor: null } });

/** Keep following each live head's pinned revision; never expose a partial manifest. */
export function ggufManifestState(repos: string[], results: Record<string, ManifestPage | Error | undefined>) {
  const requests: ManifestRequest[] = [];
  const files: Record<string, GgufFile[]> = {};
  for (const repo of new Set(repos)) {
    let request = firstManifestRequest(repo);
    const builds: ArtifactBuild[] = [];
    const visited = new Set<string>();
    while (!visited.has(manifestRequestKey(request))) {
      const key = manifestRequestKey(request);
      visited.add(key);
      requests.push(request);
      const result = results[key];
      if (!result || result instanceof Error) break;
      builds.push(...result.page);
      if (result.isDone) {
        const found = ggufFiles(builds);
        if (found.length) files[repo] = found;
        break;
      }
      // The first non-empty page fixes the revision for all subsequent requests.
      const revision = request.revision ?? result.page[0]?.revision;
      if (!revision || !result.continueCursor) break;
      request = { repo, revision, paginationOpts: { numItems: 50, cursor: result.continueCursor } };
    }
  }
  return { requests, files };
}
