import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogGroupRow } from "@/components/atlas/CatalogGroupRow";
import { ModelCatalogView } from "@/components/atlas/ModelCatalogView";
import { catalogWindow } from "@/components/atlas/modelCatalogFilters";
import { catalogListItem, hydrateCatalogListItems, publishableEntry } from "./published";
import { catalogVariants, checkpointVariants, groupCatalogEntries, isSigmaRepo } from "./catalogGroups";
import { compareModelEntriesByRecency, type ModelEntry } from "./models";

function sigma(suffix: string, paramsB = 8, timestamp = 1): ModelEntry {
  const repo = `nvidia/Nemotron-Labs-Sigma${suffix}`;
  const releaseId = `nemotron-labs-sigma${suffix.toLowerCase().replace(/-instruct$/, "").replace(new RegExp(`-${paramsB}b$`), "")}`;
  return {
    id: suffix, slug: `nemotron-${releaseId}-${paramsB}b`,
    family: { id: "nemotron", name: "Nemotron", vendor: "NVIDIA", tags: "", releases: [] },
    release: { id: releaseId, name: releaseId.replaceAll("-", " "), date: "2026-11-12", ctx: "4K", license: "test", sizes: [] },
    size: { label: `${paramsB}B`, paramsB, variants: ["Code"] },
    name: `Nemotron Labs Sigma ${suffix}`, timestamp, dateLabel: `date-${timestamp}`, effectiveDate: "2026-11-12", updated: false,
    context: "4K", artifacts: [{ repo } as ModelEntry["artifacts"][number]], quantizations: ["BF16"], providers: ["NVIDIA"],
    category: "language", capabilities: ["general"], benchmarkRefs: [], deploymentRecipes: [], materialChanges: [], runReports: [],
  };
}

function mergedSigma() {
  const entry = sigma("-8B");
  entry.size.variants.push("Instruct");
  entry.artifacts.push({ ...entry.artifacts[0], repo: "nvidia/Nemotron-Labs-Sigma-8B-instruct" });
  return entry;
}

const members = () => [mergedSigma(), sigma("-3B", 3), ...[16, 2, 8, 4].map((nfe) => sigma(`-distill-8B-nfe${nfe}`, 8, nfe)), sigma("-distill-spec-8B")];

describe("Sigma catalog aggregation", () => {
  it("groups all official Sigma checkpoints and orders by size then numeric NFE, keeping originals", () => {
    const entries = members();
    const groups = groupCatalogEntries(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].sizes).toEqual(["3B", "8B"]);
    expect(groups[0].latest.timestamp).toBe(16);
    expect(groups[0].members.map((entry) => checkpointVariants(entry).join(" / "))).toEqual([
      "Base", "Base / Instruct", "Distilled · NFE 2", "Distilled · NFE 4", "Distilled · NFE 8", "Distilled · NFE 16", "Self-speculative",
    ]);
    expect(groups[0].members).toContain(entries[0]);
    expect(groupCatalogEntries([...entries].reverse())).toEqual(groups);
  });

  it("relabels Sigma's erroneous Code metadata and supports every checkpoint in merged entries", () => {
    const entry = mergedSigma();
    expect(checkpointVariants(entry)).toEqual(["Base", "Instruct"]);
    expect(entry.size.variants).toEqual(["Code", "Instruct"]);
    expect(catalogVariants(sigma("-distill-8B-nfe4"))).toEqual(["Distilled", "Distilled · NFE 4"]);
  });

  it("preserves grouping and variant choices across compact SSR and live payloads", () => {
    const entries = members();
    const snapshot = hydrateCatalogListItems(entries.map((entry) => catalogListItem(publishableEntry(entry), isSigmaRepo))).entries;
    expect(groupCatalogEntries(snapshot).map((group) => group.key)).toEqual(groupCatalogEntries(entries).map((group) => group.key));
    expect(snapshot.map(checkpointVariants)).toEqual(entries.map(checkpointVariants));
    const withoutRepos = { ...sigma("-distill-8B-nfe16"), artifacts: [] };
    expect(checkpointVariants(withoutRepos)).toEqual(["Distilled · NFE 16"]);
  });

  it("does not group unrelated releases, versions, namespaces or distilled families", () => {
    const plain = sigma("-8B");
    const others = [
      { ...plain, slug: "deepseek", family: { ...plain.family, id: "deepseek" } },
      { ...plain, slug: "sigma2", release: { ...plain.release, id: "nemotron-labs-sigma2" } },
      { ...plain, slug: "r1-distill", release: { ...plain.release, id: "deepseek-r1-distill" } },
      { ...plain, slug: "qwen-4b", family: { ...plain.family, id: "qwen" }, size: { ...plain.size, label: "4B", paramsB: 4 } },
      { ...plain, slug: "qwen-8b", family: { ...plain.family, id: "qwen" } },
    ];
    expect(groupCatalogEntries([plain, ...others])).toHaveLength(6);
    expect(isSigmaRepo("other/Nemotron-Labs-Sigma-8B")).toBe(false);
    expect(isSigmaRepo("nvidia/Nemotron-Labs-Sigma-8B-reward")).toBe(false);
    expect(isSigmaRepo("nvidia/Nemotron-Labs-Sigma-distill-spec-3B")).toBe(true);
    expect(isSigmaRepo("nvidia/Nemotron-Labs-Sigma-8B-instruct-BF16")).toBe(true);
  });

  it("preserves the existing recency comparator for unrelated entries with tied timestamps", () => {
    const entries = [4, 8, 14].map((paramsB) => {
      const entry = sigma("-8B", paramsB);
      return { ...entry, slug: `other-${paramsB}`, name: `Other ${paramsB}B`, release: { ...entry.release, id: "other", name: "Other" } };
    });
    expect(groupCatalogEntries(entries).map((group) => group.latest.slug)).toEqual([...entries].sort(compareModelEntriesByRecency).map((entry) => entry.slug));
  });

  it("filters individual entries before grouping to prevent cross-member matches", () => {
    const entries = [sigma("-3B", 3), sigma("-distill-8B-nfe4")];
    const filtered = entries.filter((entry) => entry.size.paramsB < 5 && catalogVariants(entry).includes("Distilled"));
    expect(groupCatalogEntries(filtered)).toEqual([]);
    expect(groupCatalogEntries(entries.filter((entry) => catalogVariants(entry).includes("Distilled")))[0].sizes).toEqual(["8B"]);
  });

  it("counts and paginates groups, using latest member recency and deterministic ties", () => {
    const entries = members();
    const other = { ...sigma("-8B", 8, 10), slug: "other", release: { ...entries[0].release, id: "other" } };
    const groups = groupCatalogEntries([other, ...entries]);
    expect(groups.map((group) => group.latest.timestamp)).toEqual([16, 10]);
    expect(catalogWindow(groups, 1)).toHaveLength(2);
  });

  it("renders one accessible disclosure with original checkpoint links and no summary links or transitions", () => {
    const group = groupCatalogEntries(members())[0];
    const html = renderToStaticMarkup(createElement(CatalogGroupRow, { group, index: 0 }));
    const summary = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)![1];
    expect(summary).toContain("Nemotron Labs Sigma");
    expect(summary).toContain("3B / 8B");
    expect(summary).not.toContain("<a");
    expect(summary).not.toContain("view-transition-name");
    expect(summary).toContain("8");
    expect(summary).toContain("checkpoints");
    expect(html).toContain('aria-label="Open Nemotron Labs Sigma · Distilled · NFE 4 · 8B"');
    for (const entry of group.members) expect(html).toContain(`href="/models/${entry.slug}"`);
    expect(html).toContain("Base · Instruct");
    expect(html).toContain("Self-speculative");
    expect(html).not.toContain(">Code<");
  });

  it("renders group-based catalog counts and keeps non-Sigma rows as links", () => {
    const entries = members();
    const other = { ...sigma("-8B"), slug: "other", release: { ...entries[0].release, id: "other" } };
    const html = renderToStaticMarkup(createElement(ModelCatalogView, { entries: [...entries, other], families: [other.family] }));
    expect(html).toContain("2 of 2 models");
    expect(html).toContain("Showing 2 of 2");
    expect(html).toContain('href="/models/other"');
    expect(html.match(/<details/g)).toHaveLength(1);
  });
});
