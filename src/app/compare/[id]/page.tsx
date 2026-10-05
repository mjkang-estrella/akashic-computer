import { Suspense } from "react";
import { ComparisonRoute } from "@/components/comparison/DeploymentComparison";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<p>Loading saved comparison…</p>}><ComparisonRoute savedId={id} /></Suspense>;
}
