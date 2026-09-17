"use client";

import { useState } from "react";
import Link from "next/link";
import { DOC_ARTICLES } from "@/lib/atlas/docsArticles";
import { filterStudyResources, RESOURCE_KINDS, STUDY_INVESTIGATIONS, STUDY_LEVELS, STUDY_PATHS, STUDY_RESOURCES, STUDY_TOPICS, type ResourceFilters } from "@/lib/atlas/study";
import { StudyResourceCard } from "./StudyResourceCard";
import { useStudyProgress } from "./useStudyProgress";

const TABS = ["Learning paths", "Resource library", "Akashic guides"] as const;
const controlClass = "min-h-11 min-w-0 rounded-[7px] border border-line bg-panel px-3 text-[12px] outline-none focus:border-ink";

export function StudyHub() {
  const [tab, setTab] = useState<typeof TABS[number]>("Learning paths");
  const [filters, setFilters] = useState<ResourceFilters>({ query: "", topic: "", kind: "", level: "", unreadOnly: false });
  const { readIds, toggleRead, ready } = useStudyProgress();
  const resources = filterStudyResources(STUDY_RESOURCES, filters, readIds);
  return (
    <section className="pb-10 pt-8 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-7">
        <h1 className="max-w-[19ch] font-display text-[40px] font-semibold leading-[1.08] sm:text-[52px]">Learn how models run.</h1>
        <Link href="/docs/lexicon" className="inline-flex min-h-11 items-center text-[12px] font-semibold text-ink underline underline-offset-4">Model lexicon →</Link>
      </header>
      <section aria-labelledby="investigation-title" className="mt-7">
        <h2 id="investigation-title" className="font-display text-[22px] font-semibold">Start with a question</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {STUDY_INVESTIGATIONS.map((item) => <Link key={item.pathSlug} href={`/docs/paths/${item.pathSlug}#investigation`} className="group flex min-h-20 items-center justify-between gap-4 border-y border-line px-1 py-4 md:border-x-0">
            <h3 className="text-[13px] font-semibold leading-relaxed group-hover:underline">{item.question}</h3>
            <span aria-hidden="true" className="text-faint">↗</span>
          </Link>)}
        </div>
      </section>
      <nav aria-label="Study sections" className="mt-8 flex flex-wrap gap-x-5 border-b border-line">
        {TABS.map((item) => <button type="button" key={item} disabled={!ready} aria-pressed={tab === item} aria-controls="study-content" onClick={() => setTab(item)} className={`min-h-11 border-b-2 text-[12px] font-semibold ${tab === item ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>{item}</button>)}
      </nav>
      <div id="study-content" role="region" aria-label={tab} className="mt-6">
        {tab === "Learning paths" ? <>
          <h2 className="sr-only">Learning paths</h2>
          <div className="grid gap-x-8 md:grid-cols-2 lg:grid-cols-3">
            {STUDY_PATHS.map((path) => {
              const complete = path.steps.filter((step) => readIds.has(step.resourceId)).length;
              return <Link key={path.slug} href={`/docs/paths/${path.slug}`} className="group flex min-h-48 flex-col border-t border-line py-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{path.level}</p>
                <h3 className="mt-2 font-display text-[22px] font-semibold leading-snug group-hover:underline">{path.title}</h3>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">{path.outcome}</p>
                <p className="mt-auto pt-4 font-mono text-[10px] text-faint">{complete}/{path.steps.length} read <span aria-hidden="true">→</span></p>
              </Link>;
            })}
          </div>
        </> : null}
        {tab === "Resource library" ? <>
          <h2 className="sr-only">Resource library</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="search" aria-label="Search study resources" placeholder="EXL3, KV cache, Triton…" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} className={controlClass} />
            <select aria-label="Resource topic" value={filters.topic} onChange={(event) => setFilters({ ...filters, topic: event.target.value })} className={controlClass}><option value="">All topics</option>{STUDY_TOPICS.map((topic) => <option key={topic}>{topic}</option>)}</select>
            <select aria-label="Resource type" value={filters.kind} onChange={(event) => setFilters({ ...filters, kind: event.target.value })} className={controlClass}><option value="">All types</option>{RESOURCE_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
            <select aria-label="Resource level" value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value })} className={controlClass}><option value="">All levels</option>{STUDY_LEVELS.map((level) => <option key={level}>{level}</option>)}</select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-11 items-center gap-2 text-[12px]"><input type="checkbox" checked={filters.unreadOnly} onChange={(event) => setFilters({ ...filters, unreadOnly: event.target.checked })} />Unread only</label>
            <p role="status" className="font-mono text-[11px] text-muted">{resources.length} {resources.length === 1 ? "resource" : "resources"}</p>
            <button type="button" onClick={() => setFilters({ query: "", topic: "", kind: "", level: "", unreadOnly: false })} className="min-h-11 text-[12px] font-semibold underline underline-offset-4">Reset filters</button>
          </div>
          {resources.length ? <div className="mt-3 grid gap-4 md:grid-cols-2">{resources.map((resource) => <StudyResourceCard key={resource.id} ready={ready} resource={resource} read={readIds.has(resource.id)} onToggleRead={() => toggleRead(resource.id)} />)}</div> : <div className="mt-4 rounded-[8px] border border-line p-6"><h3 className="font-semibold">No resources match these filters</h3><p className="mt-2 text-[12px] text-muted">Try a broader topic or reset the filters.</p></div>}
        </> : null}
        {tab === "Akashic guides" ? <>
          <h2 className="sr-only">Akashic guides</h2>
          <div className="grid gap-x-8 md:grid-cols-2">{DOC_ARTICLES.map((article) => <Link key={article.slug} href={`/docs/${article.slug}`} className="group border-t border-line py-5"><p className="font-mono text-[10px] text-muted">{article.category} · {article.readMinutes} min</p><h3 className="mt-2 font-display text-[21px] font-semibold group-hover:underline">{article.title}</h3><p className="mt-2 text-[12px] leading-relaxed text-muted">{article.summary}</p></Link>)}</div>
        </> : null}
      </div>
      <details className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
        <summary className="min-h-11 cursor-pointer font-semibold text-ink">About this library</summary>
        <p>Reading progress stays in this browser. Sources were reviewed September 13, 2026 and link to original papers, official documentation, or implementation repositories.</p>
        <p className="mt-2">Inspired by <a href="https://github.com/wafer-ai/gpu-perf-engineering-resources" target="_blank" rel="noreferrer" className="underline underline-offset-4">Wafer’s GPU performance engineering collection ↗</a>.</p>
      </details>
    </section>
  );
}
