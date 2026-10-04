"use client";
import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ArtifactBuild } from "@/lib/atlas/artifactBuilds";
import { memoryBytesLabel } from "@/lib/atlas/memory";
import { useDeploymentComparison } from "./ComparisonProvider";
export function ArtifactBuildPicker({ repo, modelSlug, modelName, onAdd }: {
  repo: string; modelSlug: string; modelName: string;
  onAdd?: (build: ArtifactBuild, slug: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(api.artifactBuilds.list, open ? { repo } : "skip", { initialNumItems: 20 });
  const { selections, add } = useDeploymentComparison();
  return <details className="border-t border-line py-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Choose exact files · {repo}</summary>
    {status === "LoadingFirstPage" && open ? <p role="status">Loading pinned files…</p> : null}
    {open && status === "Exhausted" && !results.length ? <p className="text-sm text-muted">
      Exact file metadata is not available yet. The repository entry remains a planning estimate.
    </p> : null}
    <ul className="divide-y divide-linesoft">
      {results.map((build) => <li key={build.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs">{build.label}</p>
          <p className="mt-1 text-xs text-muted">{memoryBytesLabel(build.bytes)} · revision {build.revision.slice(0, 12)} · {build.complete ? "Complete file set" : "Incomplete shards"}</p>
          <a className="text-xs underline" href={build.sourceUrl} target="_blank" rel="noreferrer">Source manifest</a>
        </div>
        <button className="comparison-button" disabled={selections.length >= 4 || selections.some((s) => s.build.key === build.key)}
          onClick={() => (onAdd ?? add)(build, modelSlug, modelName)}>
          {selections.some((s) => s.build.key === build.key) ? "Selected" : "Compare file"}
        </button>
      </li>)}
    </ul>
    {status === "CanLoadMore" ? <button className="comparison-button" onClick={() => loadMore(20)}>More files</button> : null}
  </details>;
}
