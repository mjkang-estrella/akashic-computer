import { buildsFromFiles } from "../src/lib/atlas/artifactBuilds";
import { architectureFromConfig } from "../src/lib/atlas/memory";
import {
  classifyHuggingFaceRepo,
  isWeightBlobFile,
  weightMetadataFromTree,
  type MonitoredSourceRule,
  type RepoClassification,
} from "../src/lib/atlas/huggingface";
import { hubRetryDelayMs } from "../src/lib/atlas/catalogHealth";

type UnknownRecord = Record<string, unknown>;

class HubRequestError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
    readonly serverDirected: boolean,
  ) {
    super(message);
    this.name = "HubRequestError";
  }
}

function headers(): HeadersInit {
  const token = process.env.HF_TOKEN;
  const common = { "User-Agent": "akashic-catalog-sync/1.0" };
  return token ? { ...common, Authorization: `Bearer ${token}` } : common;
}

function requestError(response: Response, context: string): HubRequestError {
  const retryAfter = response.headers.get("retry-after");
  const rateLimitReset = response.headers.get("x-ratelimit-reset");
  return new HubRequestError(
    `${context}: ${response.status} ${response.statusText}`,
    hubRetryDelayMs(
      retryAfter,
      rateLimitReset,
      Date.now(),
      response.status === 429 ? 5 * 60_000 : 60_000,
      0,
    ),
    Boolean(retryAfter || rateLimitReset),
  );
}

export function retryDelayForError(error: unknown, attempt: number, fallbackMs: number): number {
  if (error instanceof HubRequestError) {
    return error.serverDirected
      ? error.retryAfterMs
      : Math.min(30 * 60_000, error.retryAfterMs * 2 ** Math.max(0, attempt));
  }
  return Math.min(30 * 60_000, Math.max(30_000, fallbackMs * 2 ** attempt));
}

export async function fetchRepo(repoName: string): Promise<{ status: number; data?: unknown }> {
  const encoded = repoName.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `https://huggingface.co/api/models/${encoded}?full=true&config=true&cardData=true`,
    { headers: headers() },
  );
  if (!response.ok) {
    if (response.status === 404) return { status: response.status };
    throw requestError(response, `Hugging Face repo fetch failed for ${repoName}`);
  }
  const data = await response.json() as UnknownRecord;
  const revision = typeof data.sha === "string" && data.sha ? data.sha : "main";
  const configResponse = await fetch(
    `https://huggingface.co/${encoded}/raw/${encodeURIComponent(revision)}/config.json`,
    { headers: headers() },
  );
  if (configResponse.ok) data.config = await configResponse.json();
  else if (configResponse.status === 429 || configResponse.status >= 500) {
    throw requestError(configResponse, `Hugging Face config fetch failed for ${repoName}`);
  }
  return { status: response.status, data };
}

async function fetchWeightMetadata(repoName: string, revision: string) {
  const encodedRepo = repoName.split("/").map(encodeURIComponent).join("/");
  const encodedRevision = encodeURIComponent(revision);
  let url: string | null = `https://huggingface.co/api/models/${encodedRepo}/tree/${encodedRevision}?recursive=true&expand=true&limit=100`;
  const weightEntries: unknown[] = [];
  let pages = 0;
  while (url && pages < 100) {
    const response: Response = await fetch(url, { headers: headers() });
    if (!response.ok) throw requestError(response, `Hugging Face weight tree failed for ${repoName}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Hugging Face weight tree returned a non-array for ${repoName}`);
    for (const entry of page) {
      const path = entry && typeof entry === "object" && "path" in entry ? String(entry.path) : "";
      if (isWeightBlobFile(path)) weightEntries.push(entry);
    }
    const next = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/i)?.[1];
    url = next ? new URL(next, "https://huggingface.co").toString() : null;
    pages += 1;
  }
  if (url) throw new Error(`Hugging Face weight-tree pagination exceeded 100 pages for ${repoName}`);
  return weightMetadataFromTree(weightEntries);
}

export async function classifyWithWeightMetadata(
  raw: unknown,
  rule: MonitoredSourceRule,
): Promise<RepoClassification> {
  const initial = classifyHuggingFaceRepo(raw, rule);
  if (initial.status !== "publishable") return initial;
  const metadata = await fetchWeightMetadata(initial.parsed.repo.id, initial.parsed.repo.sha);
  if (!metadata) return initial;
  const result = classifyHuggingFaceRepo({
    ...(raw as UnknownRecord),
    _akashicWeightManifestHash: metadata.manifestHash,
    _akashicWeightsLastModified: metadata.lastModified,
    _akashicWeightCommitSha: metadata.commitSha ?? undefined,
    _akashicWeightBytes: metadata.totalBytes,
  }, rule);
  if (result.status === "publishable") {
    const parsed = result.parsed;
    let architecture = architectureFromConfig(parsed.repo.config, "https://huggingface.co/" + parsed.repo.id + "/blob/" + parsed.repo.sha + "/config.json");
    if (!architecture && parsed.repo.baseModels.length === 1) {
      const base = await fetchRepo(parsed.repo.baseModels[0]);
      const data = base.data as Record<string, unknown> | undefined;
      if (data?.config && typeof data.sha === "string") architecture = architectureFromConfig(
        data.config as Record<string, unknown>, "https://huggingface.co/" + parsed.repo.baseModels[0] + "/blob/" + data.sha + "/config.json",
      );
    }
    parsed.builds = buildsFromFiles(parsed.repo.id, parsed.repo.sha, metadata.files, parsed.repo.baseModels, {
      format: parsed.format, architecture,
      // A repository suffix alone cannot prove that an individual file includes MTP.
    });
  }
  return result;
}

export async function listRepos(owner: string): Promise<unknown[]> {
  let url: string | null = `https://huggingface.co/api/models?author=${encodeURIComponent(owner)}&sort=lastModified&direction=-1&limit=100`;
  const results: unknown[] = [];
  let pages = 0;
  while (url && pages < 100) {
    const response: Response = await fetch(url, { headers: headers() });
    if (!response.ok) throw requestError(response, `Hugging Face list failed for ${owner}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Hugging Face list returned a non-array for ${owner}`);
    results.push(...page);
    url = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/i)?.[1] ?? null;
    pages += 1;
  }
  if (url) throw new Error(`Hugging Face pagination exceeded 100 pages for ${owner}`);
  return results;
}
