"use client";

import { LearnView } from "./LearnView";

export function DocsRoute({ slug = null }: { slug?: string | null }) {
  return <LearnView slug={slug} />;
}
