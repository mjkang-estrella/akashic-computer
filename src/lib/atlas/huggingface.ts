import type {
  HardwareKind,
  ModelCapabilityId,
  ModelCategoryId,
} from "./types";

export type MonitoredSourceRole = "creator" | "artifact_provider" | "creator_provider";

export interface MonitoredSourceRule {
  owner: string;
  role: MonitoredSourceRole;
  familyIds: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface HuggingFaceRepoInfo {
  id: string;
  author: string;
  sha: string;
  createdAt: string | null;
  lastModified: string | null;
  private: boolean;
  gated: boolean;
  disabled: boolean;
  pipelineTag: string | null;
  tags: string[];
  files: string[];
  license: string | null;
  baseModels: string[];
  safetensorsParameters: number | null;
  cardData: Record<string, unknown>;
  config: Record<string, unknown>;
}

export interface ParsedHuggingFaceRepo {
  repo: HuggingFaceRepoInfo;
  format: string;
  modelStem: string;
  sizeLabel: string | null;
  paramsB: number | null;
  activeParamsB: number | null;
  variant: string;
  category: ModelCategoryId | null;
  capabilities: ModelCapabilityId[];
  minVramGb: number | null;
  recVramGb: number | null;
  kinds: HardwareKind[];
  runtimes: string[];
  benchmarkRows: StructuredBenchmarkRow[];
}

export interface StructuredBenchmarkRow {
  name: string;
  result: string;
  sourceLabel: string;
  sourceUrl: string;
}

export type RepoClassification =
  | { status: "publishable"; parsed: ParsedHuggingFaceRepo }
  | { status: "skipped"; reason: string; repo: HuggingFaceRepoInfo };

const WEIGHT_FILE = /(?:\.safetensors(?:\.index\.json)?|\.gguf|pytorch_model.*\.bin)$/i;
const EXCLUDED_NAME = /(?:^|[-_.])(adapter|lora|qlora|checkpoint|demo|test|merge)(?:$|[-_.])/i;
const EXCLUDED_TAGS = new Set(["adapter", "lora", "peft", "diffusers:adapter"]);

const CATEGORY_BY_PIPELINE: Record<string, ModelCategoryId> = {
  "text-generation": "language",
  "text2text-generation": "language",
  "image-text-to-text": "vision-documents",
  "visual-question-answering": "vision-documents",
  "document-question-answering": "vision-documents",
  "text-to-image": "image-generation",
  "image-to-image": "image-generation",
  "text-to-video": "video-generation",
  "automatic-speech-recognition": "audio-speech",
  "text-to-speech": "audio-speech",
  "feature-extraction": "retrieval",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function compactMetadata(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 2_048).map((entry) => compactMetadata(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 512)
        .map(([key, entry]) => [key, compactMetadata(entry, depth + 1)]),
    );
  }
  if (typeof value === "string" && value.length > 200_000) return value.slice(0, 200_000);
  return value;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    const record = asRecord(item);
    const id = record.id ?? record.model ?? record.name;
    return typeof id === "string" ? [id] : [];
  });
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function numericTotal(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const record = asRecord(value);
  const direct = record.total;
  if (typeof direct === "number" && direct > 0) return direct;
  const values = Object.values(record).filter(
    (entry): entry is number => typeof entry === "number" && Number.isFinite(entry),
  );
  return values.length ? values.reduce((sum, entry) => sum + entry, 0) : null;
}

export function normalizeHuggingFaceRepo(raw: unknown): HuggingFaceRepoInfo {
  const value = asRecord(raw);
  const cardData = asRecord(compactMetadata(value.cardData ?? value.card_data));
  const config = asRecord(compactMetadata(value.config));
  const siblings = Array.isArray(value.siblings) ? value.siblings : [];
  const allFiles = siblings.flatMap((item) => {
    const filename = asRecord(item).rfilename;
    return typeof filename === "string" ? [filename] : [];
  });
  const files = allFiles.length <= 2_048
    ? allFiles
    : [...new Set([
        ...allFiles.slice(0, 1_024),
        ...allFiles.filter((file) => WEIGHT_FILE.test(file)).slice(0, 1_024),
      ])].slice(0, 2_048);
  const tags = asStringArray(value.tags).slice(0, 2_048);
  const baseModels = [
    ...asStringArray(value.baseModels),
    ...asStringArray(cardData.base_model),
    ...asStringArray(cardData.base_models),
  ];
  const license = firstString(
    cardData.license,
    tags.find((tag) => tag.startsWith("license:"))?.slice("license:".length),
  );
  const safetensors = asRecord(value.safetensors);

  const id = firstString(value.id, value.modelId) ?? "";

  return {
    id,
    author: firstString(value.author) ?? id.split("/")[0] ?? "",
    sha: firstString(value.sha) ?? "",
    createdAt: firstString(value.createdAt, value.created_at),
    lastModified: firstString(value.lastModified, value.last_modified),
    private: value.private === true,
    gated: value.gated === true || typeof value.gated === "string",
    disabled: value.disabled === true,
    pipelineTag: firstString(value.pipeline_tag, value.pipelineTag),
    tags,
    files,
    license,
    baseModels: [...new Set(baseModels)].slice(0, 256),
    safetensorsParameters: numericTotal(safetensors.parameters),
    cardData,
    config,
  };
}

function wildcardMatch(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

export function normalizeOwnerKey(owner: string): string {
  return owner.trim().toLowerCase();
}

export function matchesSourceRules(repoId: string, rule: MonitoredSourceRule): boolean {
  if (rule.includePatterns?.length && !rule.includePatterns.some((p) => wildcardMatch(repoId, p))) {
    return false;
  }
  return !rule.excludePatterns?.some((p) => wildcardMatch(repoId, p));
}

function detectedFormat(repo: HuggingFaceRepoInfo): string {
  const text = `${repo.id} ${repo.tags.join(" ")} ${JSON.stringify(repo.config)}`.toUpperCase();
  if (text.includes("NVFP4")) return "NVFP4";
  if (text.includes("MXFP8")) return "MXFP8";
  if (text.includes("FP8")) return "FP8";
  if (text.includes("AWQ")) return "AWQ";
  if (text.includes("GPTQ") && text.includes("INT8")) return "GPTQ INT8";
  if (text.includes("GPTQ")) return "GPTQ INT4";
  if (text.includes("INT4")) return "INT4";
  if (text.includes("INT8")) return "INT8";
  if (repo.files.some((file) => file.toLowerCase().endsWith(".gguf"))) return "GGUF";
  if (text.includes("BF16") || repo.files.some((file) => file.endsWith(".safetensors"))) {
    return "BF16";
  }
  return "Unknown";
}

function formatProfile(format: string): {
  factor: number;
  kinds: HardwareKind[];
  runtimes: string[];
} {
  if (format === "GGUF") {
    return {
      factor: 0.66,
      kinds: ["mac", "cpu", "cuda"],
      runtimes: ["llama.cpp", "Ollama", "LM Studio"],
    };
  }
  if (format === "NVFP4") {
    return {
      factor: 0.62,
      kinds: ["cuda", "dgx"],
      runtimes: ["TensorRT-LLM", "vLLM"],
    };
  }
  if (format.includes("INT4") || format === "AWQ") {
    return {
      factor: 0.62,
      kinds: ["cuda", "dgx"],
      runtimes: ["vLLM", "SGLang"],
    };
  }
  if (format.includes("FP8")) {
    return {
      factor: 1.1,
      kinds: ["cuda", "dgx"],
      runtimes: ["vLLM", "SGLang", "TensorRT-LLM"],
    };
  }
  return {
    factor: 2.2,
    kinds: ["cuda", "dgx"],
    runtimes: ["vLLM", "SGLang", "Transformers"],
  };
}

export function estimateVram(
  paramsB: number,
  format: string,
): { minVramGb: number; recVramGb: number; kinds: HardwareKind[]; runtimes: string[] } {
  const profile = formatProfile(format);
  const minVramGb = Math.max(2, Math.round(paramsB * profile.factor));
  return {
    minVramGb,
    recVramGb: Math.max(3, Math.round(minVramGb * 1.15)),
    kinds: profile.kinds,
    runtimes: profile.runtimes,
  };
}

function parameterMetadata(repo: HuggingFaceRepoInfo): {
  sizeLabel: string | null;
  paramsB: number | null;
  activeParamsB: number | null;
} {
  const name = repo.id.split("/").at(-1) ?? repo.id;
  const matches = [...name.matchAll(/(\d+(?:\.\d+)?)\s*([BT])(?:[-_]?A(\d+(?:\.\d+)?)B)?/gi)];
  const match = matches.at(-1);
  const fromName = match
    ? Number(match[1]) * (match[2].toUpperCase() === "T" ? 1000 : 1)
    : null;
  const paramsB = repo.safetensorsParameters
    ? repo.safetensorsParameters / 1_000_000_000
    : fromName;
  const activeParamsB = match?.[3] ? Number(match[3]) : null;
  const sizeLabel = match
    ? `${match[1]}${match[2].toUpperCase()}${match[3] ? `-A${match[3]}B` : ""}`
    : paramsB
      ? `${Number(paramsB.toFixed(paramsB >= 10 ? 0 : 1))}B`
      : null;
  return { sizeLabel, paramsB, activeParamsB };
}

function variantFor(repo: HuggingFaceRepoInfo): string {
  const text = `${repo.id} ${repo.tags.join(" ")}`.toLowerCase();
  if (text.includes("instruct")) return "Instruct";
  if (text.includes("reasoning") || text.includes("reasoner")) return "Reasoning";
  if (text.includes("coder") || text.includes("code")) return "Code";
  if (text.includes("reranker")) return "Reranker";
  if (text.includes("embedding")) return "Embedding";
  if (text.includes("base")) return "Base";
  return "Instruct";
}

function capabilitiesFor(repo: HuggingFaceRepoInfo, category: ModelCategoryId | null) {
  const text = `${repo.id} ${repo.tags.join(" ")} ${repo.pipelineTag ?? ""}`.toLowerCase();
  const capabilities = new Set<ModelCapabilityId>();
  if (category === "language" || category === "vision-documents") capabilities.add("general");
  if (/reason|thinking/.test(text)) capabilities.add("reasoning");
  if (/coder|code/.test(text)) capabilities.add("coding");
  if (/math/.test(text)) capabilities.add("mathematics");
  if (/science/.test(text)) capabilities.add("science");
  if (/tool|agent/.test(text)) capabilities.add("agentic");
  if (category === "vision-documents") capabilities.add("image-understanding");
  if (repo.pipelineTag === "automatic-speech-recognition") capabilities.add("speech-recognition");
  if (repo.pipelineTag === "text-to-speech") capabilities.add("text-to-speech");
  if (repo.pipelineTag === "text-to-image") capabilities.add("image-generation");
  if (repo.pipelineTag === "text-to-video") capabilities.add("video-generation");
  if (repo.pipelineTag === "feature-extraction") capabilities.add("embedding");
  return [...capabilities];
}

function modelStem(repo: HuggingFaceRepoInfo): string {
  return (repo.id.split("/").at(-1) ?? repo.id)
    .replace(/[-_.](?:NVFP4|MXFP8|FP8|BF16|GGUF|AWQ|GPTQ(?:[-_.]?INT[48])?|INT[48])$/i, "")
    .replace(/[-_.](?:Instruct|Chat|Base)$/i, "");
}

function structuredBenchmarks(repo: HuggingFaceRepoInfo): StructuredBenchmarkRow[] {
  const modelIndex = repo.cardData["model-index"] ?? repo.cardData.model_index;
  if (!Array.isArray(modelIndex)) return [];
  const sourceUrl = `https://huggingface.co/${repo.id}/blob/${repo.sha || "main"}/README.md`;
  const rows: StructuredBenchmarkRow[] = [];
  for (const model of modelIndex) {
    const results = asRecord(model).results;
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      const record = asRecord(result);
      const dataset = asRecord(record.dataset);
      const metrics = Array.isArray(record.metrics) ? record.metrics : [];
      for (const metric of metrics) {
        const metricRecord = asRecord(metric);
        const value = metricRecord.value;
        const name = firstString(metricRecord.name, metricRecord.type, dataset.name, dataset.type);
        if (!name || (typeof value !== "number" && typeof value !== "string")) continue;
        rows.push({
          name,
          result: String(value),
          sourceLabel: firstString(dataset.name, dataset.type) ?? "Hugging Face model-index",
          sourceUrl,
        });
      }
    }
  }
  return rows;
}

export function classifyHuggingFaceRepo(
  raw: unknown,
  rule: MonitoredSourceRule,
): RepoClassification {
  const repo = normalizeHuggingFaceRepo(raw);
  if (!repo.id || !repo.author || !repo.sha) {
    return { status: "skipped", reason: "missing repository identity or SHA", repo };
  }
  if (repo.author.toLowerCase() !== rule.owner.toLowerCase()) {
    return { status: "skipped", reason: "repository owner does not match monitored source", repo };
  }
  if (!matchesSourceRules(repo.id, rule)) {
    return { status: "skipped", reason: "repository excluded by source rules", repo };
  }
  if (repo.private || repo.disabled) {
    return { status: "skipped", reason: repo.private ? "private repository" : "disabled repository", repo };
  }
  if (EXCLUDED_NAME.test(repo.id) || repo.tags.some((tag) => EXCLUDED_TAGS.has(tag.toLowerCase()))) {
    return { status: "skipped", reason: "adapter, checkpoint, demo, or test repository", repo };
  }
  if (!repo.files.some((file) => WEIGHT_FILE.test(file))) {
    return { status: "skipped", reason: "no recognized full-model weight files", repo };
  }
  if (rule.role === "artifact_provider" && repo.baseModels.length === 0) {
    return { status: "skipped", reason: "provider artifact has no structured base-model link", repo };
  }
  if (!repo.license && repo.baseModels.length === 0) {
    return { status: "skipped", reason: "license metadata is missing", repo };
  }
  const format = detectedFormat(repo);
  if (format === "Unknown") {
    return { status: "skipped", reason: "artifact format is not recognized", repo };
  }
  const parameters = parameterMetadata(repo);
  if (!parameters.paramsB && repo.baseModels.length === 0) {
    return { status: "skipped", reason: "parameter count is not available", repo };
  }
  const category = repo.pipelineTag ? CATEGORY_BY_PIPELINE[repo.pipelineTag] ?? null : null;
  if (!category && repo.baseModels.length === 0) {
    return { status: "skipped", reason: "pipeline category is not recognized", repo };
  }
  const vram = parameters.paramsB ? estimateVram(parameters.paramsB, format) : null;
  return {
    status: "publishable",
    parsed: {
      repo,
      format,
      modelStem: modelStem(repo),
      ...parameters,
      variant: variantFor(repo),
      category,
      capabilities: capabilitiesFor(repo, category),
      minVramGb: vram?.minVramGb ?? null,
      recVramGb: vram?.recVramGb ?? null,
      kinds: vram?.kinds ?? [],
      runtimes: vram?.runtimes ?? [],
      benchmarkRows: structuredBenchmarks(repo),
    },
  };
}

export function webhookDedupeKey(payload: unknown): string | null {
  const value = asRecord(payload);
  const event = asRecord(value.event);
  const repo = asRecord(value.repo);
  const scope = firstString(event.scope);
  const action = firstString(event.action);
  const repoId = firstString(repo.id, repo.name);
  if (!scope || !action || !repoId) return null;
  const updatedRefs = Array.isArray(value.updatedRefs) ? value.updatedRefs : [];
  const mainRef = updatedRefs
    .map(asRecord)
    .find((ref) => ref.ref === "refs/heads/main");
  const sha = firstString(repo.headSha, mainRef?.newSha) ?? "no-sha";
  const configFingerprint = scope.startsWith("repo.config")
    ? `:${stableHash(stableJson(value.updatedConfig ?? {}))}`
    : "";
  return `${repoId}:${scope}:${action}:${sha}${configFingerprint}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function acceptedWebhookEvent(payload: unknown): {
  accepted: boolean;
  reason?: string;
  repoName?: string;
  repoId?: string;
  owner?: string;
  scope?: string;
  action?: string;
  headSha?: string;
} {
  const value = asRecord(payload);
  const event = asRecord(value.event);
  const repo = asRecord(value.repo);
  const scope = firstString(event.scope);
  const action = firstString(event.action);
  const repoName = firstString(repo.name);
  const repoId = firstString(repo.id, repoName);
  if (!scope || !action || !repoName || !repoId) {
    return { accepted: false, reason: "missing required webhook fields" };
  }
  if (repo.type !== "model") return { accepted: false, reason: "not a model repository" };
  if (!(scope === "repo" || scope === "repo.content" || scope.startsWith("repo.config"))) {
    return { accepted: false, reason: "event scope is not catalog-relevant" };
  }
  if (scope === "repo.content") {
    const updatedRefs = Array.isArray(value.updatedRefs) ? value.updatedRefs.map(asRecord) : [];
    if (!updatedRefs.some((ref) => ref.ref === "refs/heads/main")) {
      return { accepted: false, reason: "content event does not update main" };
    }
  }
  const owner = repoName.split("/")[0];
  return {
    accepted: true,
    repoName,
    repoId,
    owner,
    scope,
    action,
    headSha: firstString(repo.headSha) ?? undefined,
  };
}
