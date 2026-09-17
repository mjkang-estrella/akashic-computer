"use client";

import Link from "next/link";
import { docArticleBySlug } from "@/lib/atlas/docsArticles";
import { studyPath, studyResource, type StudyPath } from "@/lib/atlas/study";
import { StudyResourceCard } from "./StudyResourceCard";
import { useStudyProgress } from "./useStudyProgress";
import { useCatalog } from "./CatalogProvider";
import { glmComparisonHref } from "@/lib/atlas/comparison";

export function StudyPathView({ path }: { path: StudyPath }) {
  const { entries } = useCatalog();
  const { readIds, toggleRead, ready } = useStudyProgress();
  const complete = path.steps.filter((step) => readIds.has(step.resourceId)).length;
  const toolHref = path.slug === "quantization" ? glmComparisonHref(entries) ?? path.exercise.toolHref : path.exercise.toolHref;
  return (
    <article className="pb-12 pt-6">
      <Link href="/docs" className="inline-flex min-h-11 items-center text-[12px] font-semibold text-muted">← Study / Docs</Link>
      <header className="mt-4 border-b border-line pb-7">
        <p className="font-mono text-[11px] text-muted">{path.topic} · {path.level}</p>
        <h1 className="mt-3 max-w-[25ch] font-display text-[36px] font-semibold leading-tight sm:text-[46px]">{path.title}</h1>
        <p className="mt-4 max-w-[70ch] text-[14px] leading-relaxed text-muted">{path.outcome}</p>
        <p role="status" className="mt-5 font-mono text-[11px] text-muted">{complete} of {path.steps.length} resources read · progress kept in this browser</p>
      </header>
      <div className="mt-6 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="self-start border-t border-line py-4 lg:sticky lg:top-5" aria-label="Path preparation">
          {path.prerequisites.length ? <><h2 className="text-[12px] font-semibold">Read first</h2><div className="mt-2 space-y-1">{path.prerequisites.map((slug) => <Link key={slug} href={`/docs/paths/${slug}`} className="block min-h-11 py-2 text-[12px] leading-relaxed underline underline-offset-4">{studyPath(slug)?.title} →</Link>)}</div></> : null}
          <h2 className={`${path.prerequisites.length ? "mt-4 border-t border-line pt-4" : ""} text-[12px] font-semibold`}>Companion guides</h2>
          <div className="mt-2 space-y-1">{path.guides.map((slug) => <Link key={slug} href={`/docs/${slug}`} className="block min-h-11 py-2 text-[12px] leading-relaxed text-muted underline underline-offset-4 hover:text-ink">{docArticleBySlug(slug)?.title}</Link>)}</div>
          <a href="#investigation" className="mt-4 inline-flex min-h-11 items-center text-[12px] font-semibold underline underline-offset-4">Jump to investigation ↓</a>
        </aside>
        <div className="min-w-0">
          <section aria-labelledby="reading-order-title">
            <h2 id="reading-order-title" className="font-display text-[25px] font-semibold">Read with a question</h2>
            <ol className="mt-5 space-y-5">{path.steps.map((step, index) => {
              const resource = studyResource(step.resourceId);
              return resource ? <li key={step.resourceId}><p className="mb-2 font-mono text-[11px] text-faint">{String(index + 1).padStart(2, "0")} / {path.steps.length}</p><StudyResourceCard ready={ready} resource={resource} read={readIds.has(resource.id)} onToggleRead={() => toggleRead(resource.id)} focus={step.focus} /></li> : null;
            })}</ol>
          </section>
          <section id="investigation" aria-labelledby="investigation-title" className="mt-8 scroll-mt-5 rounded-[8px] border border-ink bg-paper p-5 sm:p-6">
            <h2 id="investigation-title" className="font-display text-[26px] font-semibold">{path.exercise.title}</h2>
            <p className="mt-4 text-[14px] leading-relaxed">{path.exercise.prompt}</p>
            <h3 className="mt-5 text-[12px] font-semibold">What to record</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-muted">{path.exercise.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
            {toolHref ? <Link href={toolHref} className="mt-5 inline-flex min-h-11 items-center rounded-[7px] bg-ink px-4 text-[12px] font-semibold text-paper">{path.exercise.toolLabel} →</Link> : null}
            <p className="mt-4 text-[11px] leading-relaxed text-muted">You can investigate the assumptions without running a GPU experiment. Keep unmeasured outcomes open until you have evidence.</p>
          </section>
        </div>
      </div>
    </article>
  );
}
