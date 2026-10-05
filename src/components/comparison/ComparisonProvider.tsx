"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useConvexAuth, useQueries } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { comparisonEnabled } from "@/lib/atlas/comparisonFlags";
import type { ArtifactBuild } from "@/lib/atlas/artifactBuilds";
import { defaultDeployment, type DeploymentConfiguration } from "@/lib/atlas/deployments";
export interface Selection { build: ArtifactBuild; configuration: DeploymentConfiguration }
const Context = createContext<{
  selections: Selection[]; replace: (items: Selection[]) => void;
  add: (build: ArtifactBuild, modelSlug: string, label: string) => void;
} | null>(null);
export function ComparisonProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const queries = useMemo(() => {
    const requests: Parameters<typeof useQueries>[0] = {};
    if (comparisonEnabled && isAuthenticated) requests.identity = { query: api.workspace.identity, args: {} };
    return requests;
  }, [isAuthenticated]);
  const result = useQueries(queries);
  const identity = result.identity;
  const principal = !comparisonEnabled ? "disabled" : !isAuthenticated ? "anonymous"
    : identity && !(identity instanceof Error) ? identity.id : "checking";
  // A different account must never inherit another account's in-memory decision.
  return <ComparisonState key={principal}>{children}</ComparisonState>;
}
function ComparisonState({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const replace = useCallback((items: Selection[]) => setSelections(items.slice(0, 4)), []);
  const add = useCallback((build: ArtifactBuild, slug: string, label: string) => setSelections((items) => {
    if (items.length >= 4 || items.some((item) => item.build.key === build.key)) return items;
    return [...items, { build, configuration: defaultDeployment(build.key, slug, build.repo, label + " · " + build.quantization) }];
  }), []);
  return <Context.Provider value={{ selections, replace, add }}>{children}</Context.Provider>;
}
export function useDeploymentComparison() {
  const context = useContext(Context);
  if (!context) throw new Error("Comparison provider is missing.");
  return context;
}
