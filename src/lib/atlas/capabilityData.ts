// Imported by the server page only: ship the selected peers, never the full snapshot.
import snapshot from "./snapshots/artificial-analysis.json";
import { OFFICIAL_BENCHMARKS } from "./benchmarks";
import type { PublishedCatalogEntry } from "./published";
import type { CapabilityComparison, CapabilityComparisons, CapabilityGroup, CapabilityMetric, CapabilityModel } from "./capabilityTypes";

type SnapshotModel = (typeof snapshot.models)[number];
const GROUP_LABELS: Record<CapabilityGroup, string> = {
  flash: "Flash peers", flagship: "Flagship peers", compact: "Compact peers", "mid-size": "Mid-size peers",
};
const METRICS: CapabilityMetric[] = [
  { id: "intelligenceIndex", name: "AA Intelligence", unit: "points", protocol: `Artificial Analysis Intelligence Index v${snapshot.intelligenceIndexVersion}` },
  { id: "terminalBench40", name: "Terminal-Bench 4.0", unit: "%", protocol: "Artificial Analysis Terminal-Bench 4.0" },
  { id: "hleDiamond", name: "HLE-Diamond", unit: "%", protocol: "Artificial Analysis HLE-Diamond" },
];
const PREFERRED: Partial<Record<CapabilityGroup, string[]>> = {
  flash: ["glm-5-3-flash", "qwen3-8-flash-next", "deepseek-v4-1-flash-1017"],
  flagship: ["kimi-k3-1-pro", "mistral-large-4", "glm-5-3"],
};
const ANCHORS: Record<CapabilityGroup, string[]> = {
  flash: ["gemini-3-8-flash", "gpt-6-luna"],
  flagship: ["claude-opus-5-5", "gpt-6-astra"],
  compact: ["gemini-3-8-flash", "gpt-6-luna"],
  "mid-size": ["claude-haiku-5-5", "gpt-6-luna"],
};

/** Exact checkpoint identity only. Never strip quantization, date, or fine-tune suffixes. */
export function weightsRepo(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "huggingface.co") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || ["collections", "datasets", "spaces"].includes(parts[0])) return null;
    return parts.join("/").toLowerCase();
  } catch { return null; }
}

/** Role takes precedence over total MoE size; size is only the fallback for other releases. */
export function capabilityGroup(name: string, params: number | null): CapabilityGroup {
  if (/\b(flash|haiku|luna)\b/i.test(name)) return "flash";
  if (/\b(pro|large|opus|astra|max)\b/i.test(name)) return "flagship";
  if (params !== null && params <= 40) return "compact";
  if (params !== null && params <= 150) return "mid-size";
  return "flagship";
}

function groupOf(model: SnapshotModel): CapabilityGroup {
  // The effort suffix "Max" is not a model's market tier.
  return capabilityGroup(model.release?.name ?? model.name.replace(/\s*\(.*$/, ""), model.parameters);
}
function preferredConfigurations(models: SnapshotModel[]): SnapshotModel[] {
  const byRepo = new Map<string, SnapshotModel>();
  for (const model of [...models].sort((a, b) =>
    (b.effort?.level ?? 0) - (a.effort?.level ?? 0) ||
    Number(b.isReasoning) - Number(a.isReasoning) || a.slug.localeCompare(b.slug))) {
    const repo = weightsRepo(model.modelWeightsSourceUrl);
    if (repo && !byRepo.has(repo)) byRepo.set(repo, model);
  }
  return [...byRepo.values()];
}
function aaRow(model: SnapshotModel, current = false): CapabilityModel {
  return {
    id: model.id, name: model.release?.name ?? model.name,
    repo: weightsRepo(model.modelWeightsSourceUrl), sourceUrl: `https://artificialanalysis.ai/models/${model.slug}`,
    configuration: model.name, current, closed: !model.isOpenWeights,
    scores: Object.fromEntries(METRICS.map(metric => {
      const value = model[metric.id as "intelligenceIndex" | "terminalBench40" | "hleDiamond"];
      return [metric.id, typeof value === "number" && Number.isFinite(value) ? value * (metric.unit === "%" ? 100 : 1) : null];
    })),
  };
}

function creatorComparison(entry: PublishedCatalogEntry, repos: Set<string>, group: CapabilityGroup): CapabilityComparison | null {
  const available = OFFICIAL_BENCHMARKS.filter(b => b.results.some(r => repos.has(r.repo.toLowerCase())));
  if (!available.length) return null;
  const preferred = ["mmlu-pro", "gpqa-diamond", "livecodebench-v6"];
  const selected = [...available].sort((a, b) => {
    const priority = (id: string) => preferred.includes(id) ? preferred.indexOf(id) : 99;
    return priority(a.id) - priority(b.id);
  }).slice(0, 3);
  for (const id of preferred) {
    if (selected.length >= 3) break;
    const benchmark = OFFICIAL_BENCHMARKS.find(b => b.id === id);
    if (benchmark && !selected.some(b => b.id === id)) selected.push(benchmark);
  }
  const aaByRepo = new Map(preferredConfigurations(snapshot.models).map(m => [weightsRepo(m.modelWeightsSourceUrl), m]));
  const currentRepo = selected[0].results.find(r => repos.has(r.repo.toLowerCase()))!.repo;
  const peers = [...new Set(selected.flatMap(b => b.results.map(r => r.repo)))].filter(repo => {
    const aa = aaByRepo.get(repo.toLowerCase());
    return !repos.has(repo.toLowerCase()) && aa && groupOf(aa) === group;
  }).sort().slice(0, 4);
  const models = [currentRepo, ...peers].map((repo, index): CapabilityModel => {
    const aa = aaByRepo.get(repo.toLowerCase());
    const evidence = selected.flatMap(b => b.results).find(r => r.repo === repo)!;
    const name = index === 0 ? entry.name : aa?.release?.name ?? repo.split("/")[1];
    return {
      id: repo, repo, name,
      configuration: `${name} · ${evidence.note ?? "Creator-reported configuration; see source"}`, current: index === 0, closed: false,
      sourceUrl: evidence.sourceUrl,
      scores: Object.fromEntries(selected.map(b => [b.id, b.results.find(r => r.repo === repo)?.score ?? null])),
      evidence: Object.fromEntries(selected.flatMap(b => {
        const result = b.results.find(r => r.repo === repo);
        return result ? [[b.id, { url: result.sourceUrl, label: result.sourceLabel, ...(result.note ? { note: result.note } : {}) }]] : [];
      })),
    };
  });
  return { group: GROUP_LABELS[group], source: "Creator reports", retrievedAt: null,
    metrics: selected.map(b => ({ id: b.id, name: b.name, unit: "%", protocol: b.protocol })), models };
}

export function getCapabilityComparisons(entry: PublishedCatalogEntry): CapabilityComparisons {
  if (!["language", "vision-documents"].includes(entry.category)) return {};
  const configurations = preferredConfigurations(snapshot.models);
  return Object.fromEntries(entry.size.variants.map(variant => {
    const repos = new Set(entry.artifacts.filter(a => a.variant === variant).map(a => a.repo.toLowerCase()));
    const current = configurations.find(m => repos.has(weightsRepo(m.modelWeightsSourceUrl) ?? ""));
    const group = current ? groupOf(current) : capabilityGroup(entry.release.name, entry.size.paramsB);
    const hasAaScores = current && Object.values(aaRow(current).scores).some(value => value !== null);
    const creator = !hasAaScores ? creatorComparison(entry, repos, group) : null;
    if (creator) return [variant, creator];
    const priority = PREFERRED[group] ?? [];
    const peers = configurations.filter(m => m.isOpenWeights && groupOf(m) === group && !repos.has(weightsRepo(m.modelWeightsSourceUrl) ?? ""))
      .sort((a, b) => {
        const rank = (m: SnapshotModel) => priority.includes(m.slug) ? priority.indexOf(m.slug) : 99;
        return rank(a) - rank(b) || (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || a.slug.localeCompare(b.slug);
      }).slice(0, 2);
    const anchors = ANCHORS[group].flatMap(slug => snapshot.models.filter(m => m.slug === slug && !m.isOpenWeights));
    const currentRow: CapabilityModel = current ? aaRow(current, true) : {
      id: entry.slug, name: entry.name, repo: null, sourceUrl: "", configuration: "No exact checkpoint evaluation", current: true, closed: false,
      scores: Object.fromEntries(METRICS.map(m => [m.id, null])),
    };
    return [variant, { group: GROUP_LABELS[group], source: "Artificial Analysis", retrievedAt: snapshot.retrievedAt,
      metrics: METRICS, models: [currentRow, ...peers.map(m => aaRow(m)), ...anchors.map(m => aaRow(m))] } satisfies CapabilityComparison];
  }));
}
