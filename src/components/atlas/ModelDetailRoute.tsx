"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtlasUi } from "./AtlasShell";
import { useCatalogEntry } from "./CatalogProvider";
import { ModelCatalogSkeleton } from "./ModelCatalogView";
import { ArtifactBuildPicker } from "../comparison/ArtifactBuildPicker";
import { comparisonEnabled } from "@/lib/atlas/comparisonFlags";
import type { PublishedCatalogEntry } from "@/lib/atlas/published";
import { ModelDetailView } from "./ModelDetailView";
import { ModelNotFound } from "./ModelNotFound";

/**
 * Reading search params in its own boundary keeps the rest of the page in the static,
 * server-rendered HTML; only this reader renders on the client.
 */
function PreferredVariant({ onVariant }: { onVariant: (variant: string | null) => void }) {
  const variant = useSearchParams().get("variant");
  useEffect(() => onVariant(variant), [onVariant, variant]);
  return null;
}

export function ModelDetailRoute({
  slug,
  initialEntry,
}: {
  slug: string;
  initialEntry?: PublishedCatalogEntry | null;
}) {
  const router = useRouter();
  const entry = useCatalogEntry(slug, initialEntry);
  const [preferredVariant, setPreferredVariant] = useState<string | null>(null);
  const { rig, context, setContext, checked, toggleChecked } = useAtlasUi();
  if (entry === undefined) return <ModelCatalogSkeleton detail />;
  if (entry === null) return <ModelNotFound />;
  return (
    <>
    <Suspense fallback={null}>
      <PreferredVariant onVariant={setPreferredVariant} />
    </Suspense>
    <ModelDetailView
      entry={entry}
      rig={rig}
      context={context}
      onContext={setContext}
      preferredVariant={preferredVariant}
      checked={checked}
      onBack={() => router.push("/models")}
      onCheck={toggleChecked}
      onLearn={(term) => router.push(term ? `/docs/lexicon#term-${encodeURIComponent(term)}` : "/docs")}
    />
    {comparisonEnabled ? <section aria-label="Exact quantized files" className="my-6"><h2 className="font-display text-2xl">Compare exact quantizations</h2><p className="my-3 text-sm text-muted">Choose revision-pinned files. Download sizes do not include runtime memory.</p>{[...new Set(entry.artifacts.map((a) => a.repo))].map((repo) => <ArtifactBuildPicker key={repo} repo={repo} modelSlug={entry.slug} modelName={entry.name} />)}</section> : null}
    </>
  );
}
