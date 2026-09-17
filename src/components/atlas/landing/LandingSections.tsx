import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, BookOpen02Icon } from "@hugeicons/core-free-icons";
import { ComparisonStory } from "./ComparisonStory";

const LEARNING_QUESTIONS = [
  { question: "Why does a model need so much memory?", href: "/docs/paths/inference-memory" },
  { question: "What changes when a model is quantized?", href: "/docs/paths/quantization" },
  { question: "What makes a GPU fast for AI?", href: "/docs/paths/gpu-fundamentals" },
];

export function LandingSections() {
  return (
    <div className="mt-16 sm:mt-24">
      <ComparisonStory />
      <section aria-labelledby="learning-paths-title" className="grid items-center gap-10 border-t border-line py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div className="lg:col-start-2 lg:row-start-1">
          <h2 id="learning-paths-title" className="max-w-[17ch] text-balance font-display text-[36px] font-medium leading-[1.12] tracking-[-0.025em] sm:text-[44px]">Understand what you’re running.</h2>
          <p className="mt-5 max-w-[38ch] text-[16px] leading-relaxed text-muted">Start with the basics, then follow guided paths into memory, quantization, and GPU performance.</p>
          <Link href="/docs" className="group mt-5 inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold underline-offset-4 hover:underline">
            Find a learning path
            <HugeiconsIcon icon={ArrowRight01Icon} size={17} strokeWidth={1.8} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <HugeiconsIcon icon={BookOpen02Icon} size={36} strokeWidth={1.2} aria-hidden="true" className="mb-6 text-muted" />
          <ul className="divide-y divide-line border-y border-line">
            {LEARNING_QUESTIONS.map(({ question, href }) => (
              <li key={href}>
                <Link href={href} className="group flex min-h-24 items-center justify-between gap-5 py-5">
                  <span className="max-w-[29ch] font-display text-[20px] font-medium leading-snug group-hover:underline group-hover:underline-offset-4">{question}</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={1.8} aria-hidden="true" className="flex-none text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section aria-labelledby="explore-catalog-title" className="mt-4 flex flex-wrap items-center justify-between gap-8 rounded-[12px] bg-ink px-7 py-10 text-paper sm:mt-8 sm:px-12 sm:py-14">
        <h2 id="explore-catalog-title" className="max-w-[18ch] text-balance font-display text-[34px] font-medium leading-tight tracking-[-0.025em] sm:text-[42px]">Find your next model.</h2>
        <Link href="/models" className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-[7px] bg-paper px-6 text-[14px] font-semibold text-ink transition-colors hover:bg-panel focus-visible:outline-paper">
          Open the catalog
          <HugeiconsIcon icon={ArrowRight01Icon} size={17} strokeWidth={1.8} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </section>
    </div>
  );
}
