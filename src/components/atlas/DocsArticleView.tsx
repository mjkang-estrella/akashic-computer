"use client";

import { ArrowLeft, ArrowUpRight } from "lucide-react";
import {
  type DocArticle,
  type DocInteractive,
  DOC_ARTICLES,
} from "@/lib/atlas/docsArticles";
import { LEARN_TERMS } from "@/lib/atlas/learn";
import {
  InferenceStackExplorer,
  FineTuningMethodExplorer,
  MoeExplorer,
  PostTrainingPipeline,
  RepositoryInspector,
  RuntimeMatrix,
  TechniqueExplorer,
  WeightMemoryEstimator,
} from "./DocsTools";

function InteractiveBlock({ type }: { type: DocInteractive }) {
  if (type === "stack") return <InferenceStackExplorer />;
  if (type === "moe") return <MoeExplorer />;
  if (type === "techniques") return <TechniqueExplorer />;
  if (type === "post-training") return <PostTrainingPipeline />;
  if (type === "fine-tuning") return <FineTuningMethodExplorer />;
  if (type === "repository") return <RepositoryInspector />;
  if (type === "runtimes") return <RuntimeMatrix />;
  return <WeightMemoryEstimator />;
}

function BackToDocs({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-11 items-center gap-2 text-[12.5px] font-semibold text-muted hover:text-ink"
    >
      <ArrowLeft size={15} aria-hidden="true" />
      All Docs
    </button>
  );
}

export function DocsArticleView({
  article,
  onOpen,
  onBack,
}: {
  article: DocArticle;
  onOpen: (slug: string) => void;
  onBack: () => void;
}) {
  const related = article.related
    .map((slug) => DOC_ARTICLES.find((candidate) => candidate.slug === slug))
    .filter((candidate): candidate is DocArticle => Boolean(candidate));

  return (
    <article className="pt-5">
      <BackToDocs onBack={onBack} />
      <header className="mt-4 max-w-[820px] border-b border-line pb-6">
        <p className="font-mono text-[11px] font-semibold text-faint">
          {article.category} · {article.readMinutes} min read · Updated {article.updated}
        </p>
        <h2
          id="docs-article-title"
          tabIndex={-1}
          className="mt-3 max-w-[22ch] text-balance font-display text-[36px] font-semibold leading-[1.15] outline-none"
        >
          {article.title}
        </h2>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-muted">
          {article.summary}
        </p>
      </header>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,820px)_200px] lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="border-y border-ink py-4">
            <p className="font-mono text-[11px] font-semibold text-faint">Key idea</p>
            <p className="mt-1 max-w-[68ch] text-[15px] font-medium leading-relaxed">
              {article.takeaway}
            </p>
          </div>

          <nav className="border-b border-line py-4 lg:hidden" aria-label="In this article">
            <p className="font-mono text-[11px] font-semibold text-faint">In this article</p>
            <div className="mt-2 grid border-t border-linesoft">
              {article.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#doc-${section.id}`}
                  className="inline-flex min-h-11 items-center border-b border-linesoft text-[12px] font-semibold text-muted hover:text-ink hover:underline"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </nav>

          {article.sections.map((section) => (
            <section
              key={section.id}
              id={`doc-${section.id}`}
              className="scroll-mt-5 border-b border-line py-7"
            >
              <h3 className="max-w-[30ch] text-balance font-display text-[23px] font-semibold">
                {section.title}
              </h3>
              <div className="mt-3 max-w-[72ch] space-y-4 text-[14.5px] leading-[1.75] text-muted">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.bullets ? (
                <ul className="mt-5 grid gap-2 border-y border-linesoft py-4 sm:grid-cols-2">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="grid grid-cols-[12px_minmax(0,1fr)] gap-2 text-[12.5px] leading-relaxed text-muted"
                    >
                      <span aria-hidden="true" className="font-mono text-faint">
                        ·
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.interactive ? (
                <div className="mt-6">
                  <InteractiveBlock type={section.interactive} />
                </div>
              ) : null}
            </section>
          ))}

          <section className="border-b border-line py-7">
            <h3 className="font-display text-[21px] font-semibold">Primary sources</h3>
            <div className="mt-3 border-y border-line">
              {article.sources.map((source) => (
                <a
                  key={source.href}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid min-h-11 gap-1 border-b border-linesoft py-3 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)_18px] sm:items-center sm:gap-5"
                >
                  <span className="text-[12.5px] font-semibold group-hover:underline">
                    {source.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                  <span className="font-mono text-[11px] text-meta">{source.publisher}</span>
                  <ArrowUpRight
                    size={15}
                    aria-hidden="true"
                    className="hidden text-faint sm:block"
                  />
                </a>
              ))}
            </div>
          </section>

          <section className="py-7">
            <h3 className="font-display text-[21px] font-semibold">Continue reading</h3>
            <div className="mt-3 border-y border-line">
              {related.map((candidate) => (
                <button
                  key={candidate.slug}
                  type="button"
                  onClick={() => onOpen(candidate.slug)}
                  className="group grid min-h-16 w-full gap-1 border-b border-linesoft py-3 text-left last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)_18px] sm:items-start sm:gap-5"
                >
                  <span className="text-[13px] font-semibold group-hover:underline">
                    {candidate.title}
                  </span>
                  <span className="text-[12px] leading-relaxed text-muted">
                    {candidate.summary}
                  </span>
                  <span aria-hidden="true" className="hidden text-faint sm:block">
                    →
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="sticky top-4 hidden lg:block" aria-label="In this article">
          <p className="font-mono text-[11px] font-semibold text-faint">In this article</p>
          <nav className="mt-2 border-t border-line">
            {article.sections.map((section) => (
              <a
                key={section.id}
                href={`#doc-${section.id}`}
                className="block border-b border-linesoft py-2.5 text-[12px] font-semibold leading-snug text-muted hover:text-ink"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </article>
  );
}

export function LexiconArticleView({ onBack }: { onBack: () => void }) {
  return (
    <article className="pt-5">
      <BackToDocs onBack={onBack} />
      <header className="mt-4 max-w-[820px] border-b border-line pb-6">
        <p className="font-mono text-[11px] font-semibold text-faint">Reference</p>
        <h2
          id="docs-article-title"
          tabIndex={-1}
          className="mt-3 font-display text-[36px] font-semibold leading-tight outline-none"
        >
          Technical lexicon
        </h2>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-muted">
          Definitions used across the catalog and technical guides. These terms also appear
          as hover explanations on model and artifact pages.
        </p>
      </header>

      <div className="max-w-[820px]">
        {[
          "Model structure",
          "Artifacts and precision",
          "Runtime and hardware",
          "Evidence and trust",
        ].map((category) => (
          <section key={category} className="border-b border-line py-7">
            <h3 className="font-display text-[23px] font-semibold">{category}</h3>
            <dl className="mt-3">
              {LEARN_TERMS.filter((term) => term.category === category).map((term) => (
                <div
                  key={term.id}
                  id={`term-${term.id}`}
                  className="scroll-mt-5 grid gap-1 border-t border-linesoft py-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-6"
                >
                  <dt className="font-mono text-[12.5px] font-semibold">{term.term}</dt>
                  <dd>
                    <p className="text-[13px] font-medium">{term.short}</p>
                    <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-muted">
                      {term.definition}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </article>
  );
}
