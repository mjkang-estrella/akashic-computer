"use client";

import { useMemo, useState } from "react";
import { useQueries } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { type GgufFile } from "@/lib/atlas/ggufFiles";
import { firstManifestRequest, ggufManifestState, manifestRequestKey, type ManifestPage, type ManifestRequest } from "@/lib/atlas/ggufManifest";
import { hasConvex } from "../AppProviders";

type FilesByRepo = Record<string, GgufFile[]>;

/** A repo is absent until every page of its current pinned manifest has loaded. */
function useLiveGgufFiles(repos: string[]): FilesByRepo {
  const [pages, setPages] = useState<ManifestRequest[]>([]);
  const key = JSON.stringify(repos);
  const queries = useMemo(() => {
    const activeRepos = new Set<string>(JSON.parse(key));
    const requests = [...activeRepos].map(firstManifestRequest).concat(pages.filter((page) => activeRepos.has(page.repo)));
    return Object.fromEntries(requests.map((args) => [manifestRequestKey(args), { query: api.artifactBuilds.list, args: { ...args } }]));
  }, [key, pages]);
  const results = useQueries(queries);
  const state = ggufManifestState(repos, results as Record<string, ManifestPage | Error | undefined>);
  const requestedPages = JSON.stringify(state.requests.filter((request) => request.paginationOpts.cursor !== null));
  // Reconcile subscriptions when a live page reveals the next cursor or a new revision.
  if (JSON.stringify(pages) !== requestedPages) setPages(JSON.parse(requestedPages));
  return state.files;
}

const noFiles: FilesByRepo = {};

// Without a Convex client there is no provider to query; rows keep their repository estimate.
export const useGgufFiles: (repos: string[]) => FilesByRepo = hasConvex ? useLiveGgufFiles : () => noFiles;
