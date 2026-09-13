import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudyPathView } from "@/components/atlas/StudyPathView";
import { studyPath } from "@/lib/atlas/study";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = studyPath(slug);
  if (!path) return { title: "Learning path not found · Akashic" };
  const title = `${path.title} · Akashic Study`;
  return { title, description: path.outcome, alternates: { canonical: `/docs/paths/${path.slug}` }, openGraph: { title, description: path.outcome, url: `/docs/paths/${path.slug}` } };
}

export default async function StudyPathPage({ params }: Props) {
  const { slug } = await params;
  const path = studyPath(slug);
  if (!path) notFound();
  return <StudyPathView path={path} />;
}
