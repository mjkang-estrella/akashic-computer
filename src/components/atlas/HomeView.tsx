import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { DOC_ARTICLES } from "@/lib/atlas/docsArticles";
import { ProductPreview } from "./landing/ProductPreview";

const INTRO_GUIDES = [
  "model-checkpoint-artifact-runtime",
  "quantization",
  "memory-and-context",
];

export function HomeView() {
  const guides = INTRO_GUIDES.flatMap((slug) => {
    const article = DOC_ARTICLES.find((candidate) => candidate.slug === slug);
    return article ? [{ slug, title: article.title, readMinutes: article.readMinutes }] : [];
  });

  return (
    <div className="mx-auto max-w-[1080px] pb-12 sm:pb-20">
      <section aria-labelledby="home-title" className="mx-auto max-w-[800px] pt-14 pb-10 text-center sm:pt-20 sm:pb-14 lg:pt-24">
        <h1 id="home-title" className="text-balance font-display text-[clamp(2.75rem,6.3vw,5rem)] font-medium leading-[1.04] tracking-[-0.035em]">
          Find your way through<br className="hidden sm:block" /> <span className="whitespace-nowrap">open-weight AI.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[47ch] text-[16px] leading-relaxed text-muted sm:text-[18px]">
          Find models you can download, compare your options, and learn how to run them.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/models" className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-[7px] bg-ink px-6 text-[14px] font-semibold text-paper transition-colors hover:bg-ink/85">
            Explore models
            <HugeiconsIcon icon={ArrowRight01Icon} size={17} strokeWidth={1.8} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
          <Link href="/docs" className="inline-flex min-h-12 items-center justify-center rounded-[7px] border border-line px-6 text-[14px] font-semibold transition-colors hover:border-ink">
            Start learning
          </Link>
        </div>
      </section>
      <ProductPreview guides={guides} />
    </div>
  );
}
