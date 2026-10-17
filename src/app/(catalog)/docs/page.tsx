import type { Metadata } from "next";
import { DocsRoute } from "@/components/atlas/DocsRoute";

export const metadata: Metadata = {
  title: "Docs",
  description: "Technical guides to model architecture, weight formats, quantization, memory and inference software for running open-weight models locally.",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  return <DocsRoute />;
}
