"use client";

import { useRouter } from "next/navigation";
import { LearnView } from "./LearnView";

export function DocsRoute({ slug = null }: { slug?: string | null }) {
  const router = useRouter();
  return (
    <LearnView
      slug={slug}
      onOpen={(nextSlug) => router.push(`/docs/${nextSlug}`)}
      onBack={() => router.push("/docs")}
    />
  );
}
