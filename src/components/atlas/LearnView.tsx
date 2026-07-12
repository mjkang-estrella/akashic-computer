import { ArrowUpRight } from "lucide-react";
import { LEARN_MATERIALS, LEARN_TERMS } from "@/lib/atlas/learn";

const CATEGORIES = [
  "Model structure",
  "Artifacts and precision",
  "Runtime and hardware",
  "Evidence and trust",
] as const;

export function LearnView() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pt-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0 self-start lg:sticky lg:top-4" aria-label="Learn contents">
        <h2 className="font-display text-[19px] font-semibold">Learn</h2>
        <p className="mt-1 max-w-[34ch] text-[13px] leading-relaxed text-muted">
          Plain-language definitions for reading model families, artifacts, and evidence.
        </p>
        <nav className="mt-4 flex w-full max-w-full gap-1.5 overflow-x-auto pb-1 lg:block" aria-label="Lexicon sections">
          {CATEGORIES.map((category) => (
            <a
              key={category}
              href={`#learn-${category.toLowerCase().replaceAll(" ", "-")}`}
              className="block min-w-max rounded-[7px] px-2.5 py-2 text-[12.5px] font-semibold text-muted hover:bg-panel hover:text-ink"
            >
              {category}
            </a>
          ))}
          <a
            href="#learn-materials"
            className="block min-w-max rounded-[7px] px-2.5 py-2 text-[12.5px] font-semibold text-muted hover:bg-panel hover:text-ink"
          >
            Further reading
          </a>
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-line pb-4">
          <h2 className="font-display text-[25px] font-semibold">Open-weight model lexicon</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-muted">
            Terms describe properties, not recommendations. Runtime support and memory estimates remain specific to each artifact.
          </p>
        </header>

        {CATEGORIES.map((category) => (
          <section
            key={category}
            id={`learn-${category.toLowerCase().replaceAll(" ", "-")}`}
            className="scroll-mt-4 border-b border-line py-5"
          >
            <h3 className="mb-2 font-display text-[19px] font-semibold">{category}</h3>
            <dl>
              {LEARN_TERMS.filter((term) => term.category === category).map((term) => (
                <div
                  key={term.id}
                  id={`term-${term.id}`}
                  className="scroll-mt-4 grid gap-1 border-t border-linesoft py-3 first:border-t-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5"
                >
                  <dt className="font-mono text-[12.5px] font-semibold">{term.term}</dt>
                  <dd>
                    <p className="text-[13px] font-medium">{term.short}</p>
                    <p className="mt-0.5 max-w-[72ch] text-[12.5px] leading-relaxed text-muted">
                      {term.definition}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section id="learn-materials" className="scroll-mt-4 py-5">
          <h3 className="font-display text-[19px] font-semibold">Further reading</h3>
          <p className="mt-1 max-w-[70ch] text-[12.5px] text-muted">
            Primary documentation for checking details beyond this atlas.
          </p>
          <div className="mt-3 border-y border-line">
            {LEARN_MATERIALS.map((material) => (
              <a
                key={material.href}
                href={material.href}
                target="_blank"
                rel="noreferrer"
                className="group grid gap-1 border-b border-linesoft px-1 py-3 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)_20px] sm:items-start sm:gap-5"
              >
                <span>
                  <span className="block font-semibold group-hover:underline">{material.title}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-meta">{material.source}</span>
                </span>
                <span className="text-[12.5px] leading-relaxed text-muted">{material.description}</span>
                <ArrowUpRight className="hidden text-faint sm:block" size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
