import { Suspense } from "react";
import type { Metadata } from "next";
import { ComparisonRoute } from "@/components/atlas/ComparisonRoute";

export const metadata: Metadata = {
  title: "Compare model and quantization tradeoffs · Akashic",
  description: "Compare larger models at lower bits per weight with smaller models at higher precision. Plan EXL3 weight budgets and share your comparison.",
};

export default function ComparePage() {
  return <Suspense fallback={<p className="py-12 text-muted">Loading comparison…</p>}><ComparisonRoute /></Suspense>;
}
