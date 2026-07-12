import type { Family, Release, SizeNode } from "./types";

/** "80B-A13B" -> "80B", "Scout 109B-A17B" -> "Scout 109B", "27B" -> "27B" */
export function sizeDisplay(label: string): string {
  return label.replace(/-A\d+B$/, "");
}

/** "80B-A13B" -> "13B active", "27B" -> null */
export function activeParamsLabel(label: string): string | null {
  const m = label.match(/-A(\d+)B$/);
  return m ? `${m[1]}B active` : null;
}

/** Human model identity: "Qwen 3.6 27B", "DeepSeek R2-Lite 16B", "Llama 4.1 Scout 109B" */
export function modelDisplayName(
  family: Family,
  release: Release,
  size: SizeNode,
): string {
  const base = release.name.startsWith(family.name)
    ? release.name
    : family.id === "mistral"
      ? release.name
      : `${family.name} ${release.name}`;
  return `${base} ${sizeDisplay(size.label)}`;
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
  microsoft: "Microsoft",
};

/** Uploader org parsed from the repo prefix, shown as a property chip. */
export function uploaderDisplay(repo: string): string {
  const org = repo.split("/")[0];
  return UPLOADER_NAMES[org.toLowerCase()] ?? org;
}
