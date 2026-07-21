import { useMemo } from "react";
import { ArrowUpRight, SearchX } from "lucide-react";
import type { ModelEntry } from "@/lib/atlas/models";
import { uploaderDisplay } from "@/lib/atlas/naming";
import type { Family } from "@/lib/atlas/types";

export interface SearchTarget {
  familyId: string;
  releaseId?: string;
  sizeLabel?: string;
  variant?: string;
  quantization?: string;
}

interface SearchItem {
  id: string;
  kind: "Family" | "Model" | "Artifact";
  title: string;
  meta: string;
  searchable: string;
  target: SearchTarget;
  repo?: string;
}

function searchItems(families: Family[], entries: ModelEntry[]): SearchItem[] {
  const familyItems: SearchItem[] = families.map((family) => ({
    id: `family-${family.id}`,
    kind: "Family",
    title: family.name,
    meta: `${family.vendor} · ${family.tags}`,
    searchable: `${family.name} ${family.vendor} ${family.tags}`.toLowerCase(),
    target: { familyId: family.id },
  }));
  const modelItems = entries.flatMap((entry) => {
      const model: SearchItem = {
        id: `model-${entry.slug}`,
        kind: "Model",
        title: entry.name,
        meta: `${entry.family.vendor} · ${entry.quantizations.join(", ")}`,
        searchable: `${entry.family.name} ${entry.family.vendor} ${entry.name} ${entry.size.variants.join(" ")} ${entry.release.license} ${entry.quantizations.join(" ")}`.toLowerCase(),
        target: {
          familyId: entry.family.id,
          releaseId: entry.release.id,
          sizeLabel: entry.size.label,
        },
      };
      const artifacts = entry.artifacts.map(
          (artifact): SearchItem => ({
            id: `artifact-${entry.slug}-${artifact.variant}-${artifact.repo}`,
            kind: "Artifact",
            title: artifact.repo,
            meta: `${artifact.format} · ${uploaderDisplay(artifact.repo)} · ${artifact.runtimes.join(", ")}`,
            searchable: `${entry.family.name} ${entry.release.name} ${entry.size.label} ${artifact.variant} ${artifact.repo} ${artifact.format} ${artifact.runtimes.join(" ")}`.toLowerCase(),
            target: {
              familyId: entry.family.id,
              releaseId: entry.release.id,
              sizeLabel: entry.size.label,
              variant: artifact.variant,
              quantization: artifact.format,
            },
            repo: artifact.repo,
          }),
      );
      return [model, ...artifacts];
    });
  return [...familyItems, ...modelItems];
}

function score(item: SearchItem, query: string) {
  const title = item.title.toLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  return 3;
}

export function SearchView({
  query,
  entries,
  families,
  onSelect,
  onClear,
}: {
  query: string;
  entries: ModelEntry[];
  families: Family[];
  onSelect: (target: SearchTarget) => void;
  onClear: () => void;
}) {
  const items = useMemo(() => searchItems(families, entries), [entries, families]);
  const normalized = query.trim().toLowerCase();
  const matches = items.filter((item) => item.searchable.includes(normalized)).sort(
    (a, b) => score(a, normalized) - score(b, normalized),
  );
  const groups = (["Family", "Model", "Artifact"] as const)
    .map((kind) => ({ kind, items: matches.filter((item) => item.kind === kind).slice(0, 12) }))
    .filter((group) => group.items.length > 0);

  return (
    <section id="search-results" className="pt-5" aria-label="Search results">
      <header className="border-b border-line pb-4">
        <h2 className="font-display text-[25px] font-semibold">Search</h2>
        <p className="mt-1 text-[13px] text-muted">
          Results for <b className="font-semibold text-ink">“{query.trim()}”</b>
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="py-16 text-center">
          <SearchX className="mx-auto text-faint" size={24} aria-hidden="true" />
          <h3 className="mt-3 font-display text-[19px] font-semibold">No matching model</h3>
          <p className="mx-auto mt-1 max-w-[52ch] text-[13px] text-muted">
            Search by family, release, parameter size, quantization, runtime, or repository.
          </p>
          <button
            onClick={onClear}
            className="mt-4 min-h-11 rounded-[7px] border border-line bg-panel px-3 text-[12.5px] font-semibold hover:border-ink sm:min-h-9"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid gap-7 py-5 lg:grid-cols-3">
          {groups.map((group) => (
            <section key={group.kind}>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                {group.kind === "Family" ? "Families" : `${group.kind}s`}
              </h3>
              <div className="border-y border-line">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-w-0 items-start gap-2 border-b border-linesoft py-2.5 last:border-b-0"
                  >
                    <button
                      onClick={() => onSelect(item.target)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`${item.kind === "Artifact" ? "break-all font-mono text-[13px]" : "font-display text-[15px]"} font-semibold`}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                        {item.meta}
                      </span>
                    </button>
                    {item.repo ? (
                      <a
                        href={`https://huggingface.co/${item.repo}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${item.repo} on Hugging Face`}
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-[7px] text-faint hover:bg-panel hover:text-ink"
                      >
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
