import { Suspense } from "react";
import { ComparisonRoute } from "@/components/comparison/DeploymentComparison";
export default function Page() {
  return <Suspense fallback={<p>Loading comparison…</p>}><ComparisonRoute /></Suspense>;
}
