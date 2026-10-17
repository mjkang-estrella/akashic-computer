import type { Metadata } from "next";
import { BenchmarksRoute } from "@/components/atlas/BenchmarksRoute";

export const metadata: Metadata = {
  title: "Benchmarks",
  description: "Creator-reported benchmark results for open-weight models, with sources for every number.",
  alternates: { canonical: "/benchmarks" },
};

export default function BenchmarksPage() {
  return <BenchmarksRoute />;
}
