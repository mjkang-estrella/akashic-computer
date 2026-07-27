import { DOC_ARTICLES, docArticleBySlug } from "@/lib/atlas/docsArticles";
import { DocsArticleView, LexiconArticleView } from "./DocsArticleView";

const CATEGORIES = ["Foundations", "Architecture", "Weights", "Deployment"] as const;

export function LearnView({
  slug,
  onOpen,
  onBack,
}: {
  slug: string | null;
  onOpen: (slug: string) => void;
  onBack: () => void;
}) {
  if (slug === "lexicon") {
    return <LexiconArticleView onBack={onBack} />;
  }

  const article = docArticleBySlug(slug);
  if (article) {
    return <DocsArticleView article={article} onOpen={onOpen} onBack={onBack} />;
  }

  return (
    <section className="pt-5">
      <header className="max-w-[820px] border-b border-line pb-6">
        <h2
          id="docs-index-title"
          tabIndex={-1}
          className="max-w-[20ch] text-balance font-display text-[34px] font-semibold leading-tight outline-none"
        >
          Technical guides to local models
        </h2>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-muted">
          Full-length explanations of model architecture, weight formats, memory, and
          inference software. Read in sequence or open the concept blocking your current
          setup.
        </p>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside
          className="grid self-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:sticky lg:top-4 lg:block"
          aria-label="Docs overview"
        >
          <div>
            <p className="font-mono text-[11px] font-semibold text-faint">
              {DOC_ARTICLES.length} guides
            </p>
            <p className="mt-2 max-w-[48ch] text-[12.5px] leading-relaxed text-muted lg:max-w-[28ch]">
              Begin with the vocabulary guide, then move from architecture into weights and
              deployment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpen("lexicon")}
            className="min-h-11 justify-self-start rounded-[7px] border border-line bg-panel px-3 text-[12px] font-semibold hover:border-ink sm:justify-self-end lg:mt-4 lg:justify-self-start"
          >
            Open lexicon
          </button>
        </aside>

        <div className="min-w-0">
          {CATEGORIES.map((category) => {
            const articles = DOC_ARTICLES.filter(
              (candidate) => candidate.category === category,
            );
            if (articles.length === 0) return null;

            return (
              <section key={category} className="border-b border-line pb-7 pt-1 first:pt-0">
                <h3 className="font-display text-[20px] font-semibold">{category}</h3>
                <div className="mt-3 border-y border-line">
                  {articles.map((candidate) => (
                    <button
                      key={candidate.slug}
                      type="button"
                      onClick={() => onOpen(candidate.slug)}
                      className="group grid min-h-24 w-full gap-2 border-b border-linesoft px-1 py-4 text-left last:border-b-0 sm:grid-cols-[minmax(190px,0.8fr)_minmax(0,1.2fr)_80px_18px] sm:items-start sm:gap-5"
                    >
                      <span className="font-display text-[16px] font-semibold leading-snug group-hover:underline">
                        {candidate.title}
                      </span>
                      <span className="max-w-[54ch] text-[12.5px] leading-relaxed text-muted">
                        {candidate.summary}
                      </span>
                      <span className="font-mono text-[10.5px] text-faint sm:text-right">
                        {candidate.readMinutes} min
                      </span>
                      <span aria-hidden="true" className="hidden text-faint sm:block">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
