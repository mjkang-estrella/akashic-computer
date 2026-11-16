"use client";

import { useMemo } from "react";
import { useQueries } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ArtifactBuild } from "@/lib/atlas/artifactBuilds";
import { ggufFiles, type GgufFile } from "@/lib/atlas/ggufFiles";
import { hasConvex } from "../AppProviders";

type FilesByRepo = Record<string, GgufFile[]>;

/** Pinned file manifests for GGUF repositories, keyed by repo; a repo is absent until it loads. */
function useLiveGgufFiles(repos: string[]): FilesByRepo {
  const key = repos.join("\n");
  const queries = useMemo(
    () => Object.fromEntries(
      (key ? key.split("\n") : []).map((repo) => [
        repo,
        { query: api.artifactBuilds.list, args: { repo, paginationOpts: { numItems: 50, cursor: null } } },
      ]),
    ),
    [key],
  );
  const results = useQueries(queries);
  return useMemo(() => {
    const files: FilesByRepo = {};
    for (const [repo, result] of Object.entries(results)) {
      if (!result || result instanceof Error) continue;
      const found = ggufFiles((result as { page: ArtifactBuild[] }).page);
      if (found.length > 0) files[repo] = found;
    }
    return files;
  }, [results]);
}

const noFiles: FilesByRepo = {};

// Without a Convex client there is no provider to query; rows keep their repository estimate.
export const useGgufFiles: (repos: string[]) => FilesByRepo = hasConvex ? useLiveGgufFiles : () => noFiles;
