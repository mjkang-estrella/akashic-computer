import {
  classifyHuggingFaceRepo,
  isWeightBlobFile,
  weightMetadataFromTree,
  type MonitoredSourceRule,
  type RepoClassification,
} from "../src/lib/atlas/huggingface";
import { hubRetryDelayMs } from "../src/lib/atlas/catalogHealth";
import { AUDIT_PAGE_SIZE } from "./auditValues";

type UnknownRecord = Record<string, unknown>;

export function hubRepositoryId(data: unknown): string | undefined {
  return data &&
    typeof data === "object" &&
    "_id" in data &&
    typeof data._id === "string"
    ? data._id
    : undefined;
}

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
  const rateLimit = response.headers.get("ratelimit");
  return new HubRequestError(
    `${context}: ${response.status} ${response.statusText}`,
    hubRetryDelayMs(
      retryAfter,
      rateLimitReset,
      Date.now(),
      response.status === 429 ? 5 * 60_000 : 60_000,
      0,
      rateLimit,
    ),
    Boolean(
      retryAfter || rateLimitReset || rateLimit?.match(/;\s*r=0\s*;\s*t=\d+/i),
    ),
  );
}

async function hubFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(20_000),
  });
}

/** Pagination links must never redirect authenticated requests outside the Hub API. */
export function hubPaginationUrl(value: string): string {
  const url = new URL(value, "https://huggingface.co");
  if (
    url.origin !== "https://huggingface.co" ||
    !url.pathname.startsWith("/api/models") ||
    url.username ||
    url.password
  ) {
    throw new Error("Untrusted Hugging Face pagination URL");
  }
  return url.href;
}

export function retryDelayForError(
  error: unknown,
  attempt: number,
  fallbackMs: number,
): number {
  if (error instanceof HubRequestError) {
    return error.serverDirected
      ? error.retryAfterMs
      : Math.min(30 * 60_000, error.retryAfterMs * 2 ** Math.max(0, attempt));
  }
  return Math.min(30 * 60_000, Math.max(30_000, fallbackMs * 2 ** attempt));
}

export async function fetchRepo(
  repoName: string,
): Promise<{ status: number; data?: unknown; repoId?: string }> {
  const encoded = repoName.split("/").map(encodeURIComponent).join("/");
  const response = await hubFetch(
    `https://huggingface.co/api/models/${encoded}?full=true&config=true&cardData=true`,
  );
  if (!response.ok) {
    if (response.status === 404) return { status: response.status };
    throw requestError(
      response,
      `Hugging Face repo fetch failed for ${repoName}`,
    );
  }
  const data = (await response.json()) as UnknownRecord;
  const revision = typeof data.sha === "string" && data.sha ? data.sha : "main";
  const configResponse = await hubFetch(
    `https://huggingface.co/${encoded}/resolve/${encodeURIComponent(revision)}/config.json`,
  );
  if (configResponse.ok) {
    // Configuration is optional enrichment. Some publishers use malformed JSON;
    // keep structured Hub metadata instead of failing the entire organization.
    const content = await configResponse.text();
    try {
      const config: unknown = JSON.parse(content);
      if (config && typeof config === "object" && !Array.isArray(config))
        data.config = config;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  } else if (configResponse.status === 429 || configResponse.status >= 500) {
    throw requestError(
      configResponse,
      `Hugging Face config fetch failed for ${repoName}`,
    );
  }
  return {
    status: response.status,
    data,
    ...(hubRepositoryId(data) ? { repoId: hubRepositoryId(data) } : {}),
  };
}

async function fetchWeightMetadata(repoName: string, revision: string) {
  const encodedRepo = repoName.split("/").map(encodeURIComponent).join("/");
  const encodedRevision = encodeURIComponent(revision);
  let url: string | null =
    `https://huggingface.co/api/models/${encodedRepo}/tree/${encodedRevision}?recursive=true&expand=true&limit=100`;
  const weightEntries: unknown[] = [];
  let pages = 0;
  const deadline = Date.now() + 2 * 60_000;
  while (url && pages < 100) {
    if (Date.now() >= deadline)
      throw new Error(
        `Hugging Face weight-tree time bound exceeded for ${repoName}`,
      );
    const response: Response = await hubFetch(url);
    if (!response.ok)
      throw requestError(
        response,
        `Hugging Face weight tree failed for ${repoName}`,
      );
    const page = await response.json();
    if (!Array.isArray(page))
      throw new Error(
        `Hugging Face weight tree returned a non-array for ${repoName}`,
      );
    for (const entry of page) {
      const path =
        entry && typeof entry === "object" && "path" in entry
          ? String(entry.path)
          : "";
      if (isWeightBlobFile(path)) weightEntries.push(entry);
    }
    const next = response.headers
      .get("link")
      ?.match(/<([^>]+)>;\s*rel="next"/i)?.[1];
    url = next ? hubPaginationUrl(next) : null;
    pages += 1;
  }
  if (url)
    throw new Error(
      `Hugging Face weight-tree pagination exceeded 100 pages for ${repoName}`,
    );
  return weightMetadataFromTree(weightEntries);
}

export async function listReposPage(
  owner: string,
  cursor: string | null = null,
): Promise<{ repositories: unknown[]; nextCursor: string | null }> {
  const url = cursor
    ? hubPaginationUrl(cursor)
    : `https://huggingface.co/api/models?author=${encodeURIComponent(owner)}&sort=lastModified&direction=-1&limit=${AUDIT_PAGE_SIZE}`;
  const listingUrl = new URL(url);
  if (listingUrl.searchParams.get("author") !== owner)
    throw new Error("Hugging Face pagination changed source owner");
  // Default Hub listings omit SHA. Request only that extra field so unchanged
  // repositories can exit before fetching config and weight-tree metadata.
  listingUrl.searchParams.set("expand", "sha");
  const response = await hubFetch(listingUrl.href);
  if (!response.ok)
    throw requestError(response, `Hugging Face list failed for ${owner}`);
  const page: unknown = await response.json();
  if (!Array.isArray(page) || page.length > AUDIT_PAGE_SIZE)
    throw new Error(`Invalid Hugging Face repository page for ${owner}`);
  const next = response.headers
    .get("link")
    ?.match(/<([^>]+)>;\s*rel="next"/i)?.[1];
  return {
    repositories: page,
    nextCursor: next ? hubPaginationUrl(next) : null,
  };
}

export async function classifyWithWeightMetadata(
  raw: unknown,
  rule: MonitoredSourceRule,
): Promise<RepoClassification> {
  const initial = classifyHuggingFaceRepo(raw, rule);
  if (initial.status !== "publishable") return initial;
  const metadata = await fetchWeightMetadata(
    initial.parsed.repo.id,
    initial.parsed.repo.sha,
  );
  if (!metadata) return initial;
  return classifyHuggingFaceRepo(
    {
      ...(raw as UnknownRecord),
      _akashicWeightManifestHash: metadata.manifestHash,
      _akashicWeightsLastModified: metadata.lastModified,
      _akashicWeightCommitSha: metadata.commitSha ?? undefined,
      _akashicWeightBytes: metadata.totalBytes,
    },
    rule,
  );
}

export async function listRepos(owner: string): Promise<unknown[]> {
  let url: string | null = null;
  const results: unknown[] = [];
  let pages = 0;
  do {
    const page = await listReposPage(owner, url);
    results.push(...page.repositories);
    url = page.nextCursor;
    pages += 1;
  } while (url && pages < 100);
  if (url)
    throw new Error(`Hugging Face pagination exceeded 100 pages for ${owner}`);
  return results;
}
