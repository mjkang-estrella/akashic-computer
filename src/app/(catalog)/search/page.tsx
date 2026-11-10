import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchRoute } from "@/components/atlas/SearchRoute";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

export default function SearchPage() {
  return <Suspense fallback={<p role="status" className="py-5 text-muted">Loading search…</p>}><SearchRoute /></Suspense>;
}
