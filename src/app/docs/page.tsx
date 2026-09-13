import { DocsRoute } from "@/components/atlas/DocsRoute";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn how models run · Akashic Study / Docs",
  description: "Guided GPU and inference learning paths, primary research resources, and practical investigations into memory, quantization and model performance.",
};

export default function DocsPage() {
  return <DocsRoute />;
}
