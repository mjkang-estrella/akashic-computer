"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtlasUi } from "./AtlasShell";
import { useCatalogEntry } from "./CatalogProvider";
import { ModelCatalogSkeleton } from "./ModelCatalogView";
import { ModelDetailView } from "./ModelDetailView";

export function ModelDetailRoute({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entry = useCatalogEntry(slug);
  const { rig, checked, toggleChecked } = useAtlasUi();
  if (entry === undefined) return <ModelCatalogSkeleton detail />;
  if (entry === null) {
    return (
      <section className="border-y border-line py-16 text-center">
        <h2 className="font-display text-[24px] font-semibold">Model not found</h2>
        <p className="mt-2 text-[13px] text-muted">The catalog has no published model with this slug.</p>
        <Link href="/models" className="mt-5 inline-flex min-h-10 items-center border border-line bg-panel px-4 text-[12.5px] font-semibold hover:border-ink">
          Browse models
        </Link>
      </section>
    );
  }
  return (
    <ModelDetailView
      entry={entry}
      rig={rig}
      preferredVariant={searchParams.get("variant")}
      checked={checked}
      onBack={() => router.push("/models")}
      onCheck={toggleChecked}
      onLearn={(term) => router.push(term ? `/docs/lexicon#term-${encodeURIComponent(term)}` : "/docs")}
    />
  );
}
