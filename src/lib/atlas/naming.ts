import type { Family, Release, SizeNode } from "./types";

/** "80B-A13B" -> "80B", "Scout 109B-A17B" -> "Scout 109B", "27B" -> "27B" */
export function sizeDisplay(label: string): string {
  return label.replace(/-A\d+(?:\.\d+)?B$/, "");
}

/** "80B-A13B" -> "13B active", "27B" -> null */
export function activeParamsLabel(label: string, activeParamsB?: number): string | null {
  if (activeParamsB !== undefined) return `${formatParameterBillions(activeParamsB)} active`;
  const m = label.match(/-A(\d+(?:\.\d+)?)B$/);
  return m ? `${m[1]}B active` : null;
}

export function formatParameterBillions(paramsB: number): string {
  if (paramsB >= 1000) return `${Number((paramsB / 1000).toFixed(2))}T`;
  if (paramsB >= 100) return `${Math.round(paramsB)}B`;
  if (paramsB >= 10) return `${Number(paramsB.toFixed(1))}B`;
  return `${Number(paramsB.toFixed(2))}B`;
}

export function parameterTotalLabel(size: SizeNode): string {
  return formatParameterBillions(size.paramsB);
}

export function parameterDetailLabel(size: SizeNode): string | null {
  const active = activeParamsLabel(size.label, size.activeParamsB);
  if (active) return `MoE · ${active}`;
  return size.isMoe ? "MoE" : null;
}

export function parameterCountLabel(size: SizeNode): string {
  const total = parameterTotalLabel(size);
  const detail = parameterDetailLabel(size);
  return detail ? `${total} (${detail})` : total;
}

/** Human release identity without parameter size: "Qwen 3.6", "DeepSeek R2-Lite". */
export function modelReleaseName(family: Family, release: Release): string {
  return release.name.startsWith(family.name)
    ? release.name
    : family.id === "mistral"
      ? release.name
      : `${family.name} ${release.name}`;
}

/** Human model identity: "Qwen 3.6 27B", "DeepSeek R2-Lite 16B", "Llama 4.1 Scout 109B" */
export function modelDisplayName(
  family: Family,
  release: Release,
  size: SizeNode,
): string {
  return `${modelReleaseName(family, release)} ${sizeDisplay(size.label)}`;
}

const UPLOADER_NAMES: Record<string, string> = {
  nvidia: "NVIDIA",
  unsloth: "Unsloth",
  "mlx-community": "MLX Community",
  qwen: "Qwen",
  google: "Google",
  "meta-llama": "Meta",
  mistralai: "Mistral",
  "deepseek-ai": "DeepSeek",
  openai: "OpenAI",
  internlm: "InternLM",
  microsoft: "Microsoft",
  "zai-org": "Z.ai",
  minimaxai: "MiniMax",
  xiaomimimo: "Xiaomi",
  moonshotai: "Moonshot AI",
  thinkingmachines: "Thinking Machines Lab",
  poolside: "Poolside",
  upstage: "Upstage",
  "nota-ai": "Nota AI",
  llm360: "LLM360",
  "xai-org": "xAI",
  tencent: "Tencent",
  robbyant: "Ant Group",
  skywork: "Skywork",
  "efficient-large-model": "NVIDIA / MIT HAN Lab",
};

/** Uploader org parsed from the repo prefix, shown as a property chip. */
export function uploaderDisplay(repo: string): string {
  const org = repo.split("/")[0];
  return UPLOADER_NAMES[org.toLowerCase()] ?? org;
}
