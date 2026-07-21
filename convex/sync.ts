import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  classifyHuggingFaceRepo,
  estimateVram,
  matchesSourceRules,
  normalizeHuggingFaceRepo,
  normalizeOwnerKey,
  type MonitoredSourceRule,
  type ParsedHuggingFaceRepo,
  type RepoClassification,
} from "../src/lib/atlas/huggingface";
import type { PublishedCatalogEntry, PublishedArtifact } from "../src/lib/atlas/published";
import { uploaderDisplay } from "../src/lib/atlas/naming";
import type { BenchKey } from "../src/lib/atlas/types";

const NULL_DELTAS: Record<BenchKey, null> = {
  mmlu: null,
  ifeval: null,
  gpqa: null,
  hle: null,
  aime: null,
  math500: null,
  lcb: null,
  swe: null,
};

type AnyRecord = Record<string, unknown>;

function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as AnyRecord)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, clean(entry)]),
    ) as T;
  }
  return value;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizedIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function timestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateLabel(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function contextMetadata(config: AnyRecord): { label: string; tokens: number | null } {
  const candidate = config.max_position_embeddings ?? config.max_sequence_length ?? config.seq_length;
  if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0) {
    return { label: "N/A", tokens: null };
  }
  const label = candidate >= 1_000_000
    ? `${Number((candidate / 1_000_000).toFixed(1))}M`
    : `${Math.round(candidate / 1_000)}K`;
  return { label, tokens: candidate };
}

function releaseNameFor(parsed: ParsedHuggingFaceRepo): string {
  let value = parsed.modelStem.replace(/[-_]+/g, " ").trim();
  if (parsed.sizeLabel) {
    const escaped = parsed.sizeLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`\\s*${escaped.replace("-", "[- ]?")}\\s*$`, "i"), "").trim();
  }
  return value || parsed.modelStem;
}

function trustForRole(role: string, hasBaseModel: boolean) {
  return role === "artifact_provider" || (role === "creator_provider" && hasBaseModel)
    ? "vendor" as const
    : "official" as const;
}

function artifactFor(
  parsed: ParsedHuggingFaceRepo,
  role: string,
  variant: string,
  fallbackParamsB?: number,
): PublishedArtifact {
  const estimate = parsed.paramsB
    ? null
    : fallbackParamsB
      ? estimateVram(fallbackParamsB, parsed.format)
      : null;
  return {
    variant,
    repo: parsed.repo.id,
    format: parsed.format,
    trust: trustForRole(role, parsed.repo.baseModels.length > 0),
    confidence: "verified",
    kinds: estimate?.kinds ?? parsed.kinds,
    runtimes: estimate?.runtimes ?? parsed.runtimes,
    minVramGb: estimate?.minVramGb ?? parsed.minVramGb ?? 0,
    recVramGb: estimate?.recVramGb ?? parsed.recVramGb ?? 0,
    deltas: NULL_DELTAS,
    measured: false,
    qualityRank: 99,
    gated: parsed.repo.gated,
    vramEstimated: true,
    lastUpdatedAt: timestamp(parsed.repo.lastModified),
  };
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (
    !base ||
    !patch ||
    typeof base !== "object" ||
    typeof patch !== "object" ||
    Array.isArray(base) ||
    Array.isArray(patch)
  ) {
    return patch;
  }
  const output: AnyRecord = { ...(base as AnyRecord) };
  for (const [key, value] of Object.entries(patch as AnyRecord)) {
    output[key] = key in output ? deepMerge(output[key], value) : value;
  }
  return output;
}

function sourceRule(source: AnyRecord): MonitoredSourceRule {
  return {
    owner: String(source.owner),
    role: source.role as MonitoredSourceRule["role"],
    familyIds: Array.isArray(source.familyIds) ? source.familyIds.map(String) : [],
    includePatterns: Array.isArray(source.includePatterns) ? source.includePatterns.map(String) : undefined,
    excludePatterns: Array.isArray(source.excludePatterns) ? source.excludePatterns.map(String) : undefined,
  };
}

function hfHeaders(): HeadersInit {
  const token = process.env.HF_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, "User-Agent": "akashic-catalog-sync/1.0" } : { "User-Agent": "akashic-catalog-sync/1.0" };
}

async function fetchRepo(repoName: string): Promise<{ status: number; data?: unknown }> {
  const encoded = repoName.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `https://huggingface.co/api/models/${encoded}?full=true&config=true&cardData=true`,
    { headers: hfHeaders() },
  );
  if (!response.ok) return { status: response.status };
  return { status: response.status, data: await response.json() };
}

async function listRepos(owner: string): Promise<unknown[]> {
  let url: string | null = `https://huggingface.co/api/models?author=${encodeURIComponent(owner)}&sort=lastModified&direction=-1&limit=100`;
  const results: unknown[] = [];
  let pages = 0;
  while (url && pages < 100) {
    const response: Response = await fetch(url, { headers: hfHeaders() });
    if (!response.ok) throw new Error(`Hugging Face list failed for ${owner}: ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Hugging Face list returned a non-array for ${owner}`);
    results.push(...page);
    const link: string | null = response.headers.get("link");
    const next: string | null = link?.match(/<([^>]+)>;\s*rel="next"/i)?.[1] ?? null;
    url = next;
    pages += 1;
  }
  if (url) throw new Error(`Hugging Face pagination exceeded 100 pages for ${owner}`);
  return results;
}

export const sourceByOwner = internalQuery({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    const byKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.owner)))
      .first();
    return byKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
  },
});

export const enabledSources = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("monitoredSources")
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect(),
});

export const eventById = internalQuery({
  args: { eventId: v.id("webhookEvents") },
  handler: async (ctx, args) => await ctx.db.get(args.eventId),
});

export const syncRunById = internalQuery({
  args: { runId: v.id("syncRuns") },
  handler: async (ctx, args) => await ctx.db.get(args.runId),
});

export const sourceRepoByName = internalQuery({
  args: { repoName: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", args.repoName))
      .unique(),
});

export const sourceRepoById = internalQuery({
  args: { repoId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_id", (q) => q.eq("repoId", args.repoId))
      .first(),
});

export const startWebhookRun = internalMutation({
  args: { owner: v.string(), now: v.number() },
  handler: async (ctx, args) =>
    await ctx.db.insert("syncRuns", {
      kind: "webhook",
      sourceOwner: args.owner,
      status: "running",
      startedAt: args.now,
      discovered: 1,
      changed: 0,
      published: 0,
      skipped: 0,
      failed: 0,
      retries: 0,
    }),
});

async function applyOverride(ctx: MutationCtx, slug: string, payload: PublishedCatalogEntry) {
  const override = await ctx.db
    .query("catalogOverrides")
    .withIndex("by_entity", (q) => q.eq("entityType", "catalog_entry").eq("entityKey", slug))
    .unique();
  return override ? (deepMerge(payload, override.patch) as PublishedCatalogEntry) : payload;
}

function targetForParsed(
  documents: Array<{ payload: unknown; sourceRepos: string[]; familyId: string }>,
  parsed: ParsedHuggingFaceRepo,
  rule: MonitoredSourceRule,
  knownRepoNames: string[] = [],
) {
  const exact = documents.find((document) =>
    [parsed.repo.id, ...knownRepoNames].some((repoName) => document.sourceRepos.includes(repoName)),
  );
  if (exact) return exact;
  for (const baseModel of parsed.repo.baseModels) {
    const linked = documents.find((document) => document.sourceRepos.includes(baseModel));
    if (linked) return linked;
  }
  if (rule.role === "artifact_provider") return null;
  const stem = normalizedIdentity(parsed.modelStem);
  return (
    documents.find((document) => {
      if (!rule.familyIds.includes(document.familyId)) return false;
      const payload = document.payload as PublishedCatalogEntry;
      const identity = normalizedIdentity(`${payload.release.name}${payload.size.label}`);
      return stem === identity || stem.includes(identity) || identity.includes(stem);
    }) ?? null
  );
}

function familyForParsed(
  documents: Array<{ payload: unknown; familyId: string }>,
  parsed: ParsedHuggingFaceRepo,
  rule: MonitoredSourceRule,
): PublishedCatalogEntry["family"] | null {
  const identities = new Map<string, PublishedCatalogEntry["family"]>();
  for (const document of documents) {
    if (!rule.familyIds.includes(document.familyId)) continue;
    const family = (document.payload as PublishedCatalogEntry).family;
    identities.set(family.id, family);
  }
  const stem = normalizedIdentity(parsed.modelStem);
  const matching = [...identities.values()].filter((family) => stem.includes(normalizedIdentity(family.name)));
  if (matching.length === 1) return matching[0];
  return identities.size === 1 ? [...identities.values()][0] : null;
}

function newPayload(
  family: PublishedCatalogEntry["family"],
  parsed: ParsedHuggingFaceRepo,
): PublishedCatalogEntry | null {
  if (!parsed.paramsB || !parsed.sizeLabel || !parsed.category) return null;
  const updatedAt = timestamp(parsed.repo.lastModified) ?? timestamp(parsed.repo.createdAt) ?? Date.now();
  const releaseName = releaseNameFor(parsed);
  const releaseId = slugPart(releaseName);
  const context = contextMetadata(parsed.repo.config);
  const artifact = artifactFor(parsed, "creator", parsed.variant);
  const benchmarkRefs = parsed.benchmarkRows.map((row) => ({ ...row }));
  return {
    id: `${family.id}:${releaseId}:${parsed.sizeLabel}`,
    slug: `${family.id}-${releaseId}-${slugPart(parsed.sizeLabel)}`,
    family,
    release: {
      id: releaseId,
      name: releaseName,
      date: dateLabel(timestamp(parsed.repo.createdAt) ?? updatedAt),
      ctx: context.label,
      license: parsed.repo.license ?? "Unknown",
      category: parsed.category,
      capabilities: parsed.capabilities,
      benchmarkRefs,
    },
    size: {
      label: parsed.sizeLabel,
      paramsB: parsed.paramsB,
      variants: [parsed.variant],
      context: context.label,
      updated: dateLabel(updatedAt),
      category: parsed.category,
      capabilities: parsed.capabilities,
      benchmarkRefs,
    },
    name: `${releaseName} ${parsed.sizeLabel.replace(/-A\d+(?:\.\d+)?B$/i, "")}`,
    effectiveDate: dateLabel(updatedAt),
    dateLabel: dateLabel(updatedAt),
    updated: true,
    timestamp: updatedAt,
    context: context.label,
    artifacts: [artifact],
    quantizations: [parsed.format],
    providers: [uploaderDisplay(parsed.repo.id)],
    category: parsed.category,
    capabilities: parsed.capabilities,
    benchmarkRefs,
  };
}

function mergeParsedIntoPayload(
  original: PublishedCatalogEntry,
  parsed: ParsedHuggingFaceRepo,
  role: string,
  previousRepoName?: string,
): PublishedCatalogEntry {
  const updatedAt = timestamp(parsed.repo.lastModified) ?? original.timestamp;
  const existing = original.artifacts.find(
    (artifact) => artifact.repo === parsed.repo.id || artifact.repo === previousRepoName,
  );
  const variant = existing?.variant ?? (original.size.variants.includes(parsed.variant) ? parsed.variant : original.size.variants[0] ?? parsed.variant);
  const nextArtifact = artifactFor(parsed, role, variant, original.size.paramsB);
  const artifacts = existing
    ? original.artifacts.map((artifact) =>
        artifact.repo === existing.repo
          ? { ...artifact, ...nextArtifact, qualityRank: artifact.qualityRank }
          : artifact,
      )
    : [...original.artifacts, nextArtifact];
  const benchmarkRefs = [...original.benchmarkRefs];
  for (const row of parsed.benchmarkRows) {
    if (!benchmarkRefs.some((existingRow) => existingRow.name === row.name && existingRow.sourceUrl === row.sourceUrl)) {
      benchmarkRefs.push(row);
    }
  }
  return {
    ...original,
    effectiveDate: dateLabel(Math.max(original.timestamp, updatedAt)),
    dateLabel: dateLabel(Math.max(original.timestamp, updatedAt)),
    updated: true,
    timestamp: Math.max(original.timestamp, updatedAt),
    artifacts,
    quantizations: [...new Set(artifacts.map((artifact) => artifact.format))],
    providers: [...new Set(artifacts.map((artifact) => uploaderDisplay(artifact.repo)))].sort(),
    benchmarkRefs,
  };
}

async function upsertNormalized(
  ctx: MutationCtx,
  payload: PublishedCatalogEntry,
  parsed: ParsedHuggingFaceRepo,
  role: string,
  now: number,
  previousRepoName?: string,
) {
  let family = await ctx.db
    .query("modelFamilies")
    .withIndex("by_slug", (q) => q.eq("slug", payload.family.id))
    .unique();
  if (!family) {
    const familyId = await ctx.db.insert("modelFamilies", clean({
      slug: payload.family.id,
      name: payload.family.name,
      vendor: payload.family.vendor,
      summary: payload.family.tags,
      modalities: [],
      tags: payload.family.tags.split(",").map((tag) => tag.trim()),
      category: payload.family.category,
      capabilities: payload.family.capabilities,
      sourceOwner: parsed.repo.author,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
    family = await ctx.db.get(familyId);
  }
  if (!family) throw new Error("Failed to materialize family");
  let release = await ctx.db
    .query("modelReleases")
    .withIndex("by_family", (q) => q.eq("familyId", family!._id))
    .filter((q) => q.eq(q.field("slug"), payload.release.id))
    .unique();
  if (!release) {
    const releaseId = await ctx.db.insert("modelReleases", clean({
      familyId: family._id,
      slug: payload.release.id,
      name: payload.release.name,
      releasedAt: timestamp(payload.release.date),
      lastUpdatedAt: payload.timestamp,
      contextTokens: contextMetadata(parsed.repo.config).tokens ?? undefined,
      contextLabel: payload.release.ctx,
      license: payload.release.license,
      category: payload.release.category,
      capabilities: payload.release.capabilities,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
    release = await ctx.db.get(releaseId);
  } else {
    await ctx.db.patch(release._id, clean({ lastUpdatedAt: payload.timestamp, sourceSha: parsed.repo.sha, lastSyncedAt: now }));
  }
  if (!release) throw new Error("Failed to materialize release");
  let size = await ctx.db
    .query("modelSizes")
    .withIndex("by_release", (q) => q.eq("releaseId", release!._id))
    .filter((q) => q.eq(q.field("label"), payload.size.label))
    .unique();
  if (!size) {
    const sizeId = await ctx.db.insert("modelSizes", clean({
      releaseId: release._id,
      slug: payload.slug,
      label: payload.size.label,
      parameterCountB: payload.size.paramsB,
      activeParameterCountB: parsed.activeParamsB ?? undefined,
      contextTokens: contextMetadata(parsed.repo.config).tokens ?? undefined,
      contextLabel: payload.context,
      lastUpdatedAt: payload.timestamp,
      category: payload.size.category,
      capabilities: payload.size.capabilities,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
    size = await ctx.db.get(sizeId);
  } else {
    await ctx.db.patch(size._id, clean({ lastUpdatedAt: payload.timestamp, sourceSha: parsed.repo.sha, lastSyncedAt: now }));
  }
  if (!size) throw new Error("Failed to materialize size");
  const variantName = payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.variant ?? parsed.variant;
  let variant = await ctx.db
    .query("modelVariants")
    .withIndex("by_size", (q) => q.eq("sizeId", size!._id))
    .filter((q) => q.eq(q.field("slug"), slugPart(variantName)))
    .unique();
  if (!variant) {
    const kindText = variantName.toLowerCase();
    const variantKind = kindText.includes("base") ? "base" as const
      : kindText.includes("reason") ? "reasoning" as const
        : kindText.includes("code") ? "coder" as const
          : kindText.includes("embedding") ? "embedding" as const
            : kindText.includes("rerank") ? "reranker" as const
              : "instruct" as const;
    const variantId = await ctx.db.insert("modelVariants", clean({
      sizeId: size._id,
      slug: slugPart(variantName),
      name: variantName,
      category: payload.category,
      capabilities: payload.capabilities,
      variantKind,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    }));
    variant = await ctx.db.get(variantId);
  }
  if (!variant) throw new Error("Failed to materialize variant");
  const existingArtifact = await ctx.db
    .query("artifacts")
    .withIndex("by_repo", (q) => q.eq("huggingFaceRepo", parsed.repo.id))
    .filter((q) => q.eq(q.field("variantId"), variant!._id))
    .unique() ?? (previousRepoName && previousRepoName !== parsed.repo.id
      ? await ctx.db
          .query("artifacts")
          .withIndex("by_repo", (q) => q.eq("huggingFaceRepo", previousRepoName))
          .filter((q) => q.eq(q.field("variantId"), variant!._id))
          .unique()
      : null);
  const artifactValue = clean({
    variantId: variant._id,
    huggingFaceRepo: parsed.repo.id,
    aliases: previousRepoName && previousRepoName !== parsed.repo.id ? [previousRepoName] : [],
    format: parsed.format,
    quantization: parsed.format,
    uploaderKind: trustForRole(role, parsed.repo.baseModels.length > 0),
    runtimeSupport: payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.runtimes ?? parsed.runtimes,
    hardwareKinds: payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.kinds ?? parsed.kinds,
    minVramGb: payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.minVramGb,
    recommendedVramGb: payload.artifacts.find((artifact) => artifact.repo === parsed.repo.id)?.recVramGb,
    vramEstimated: true,
    gated: parsed.repo.gated,
    available: true,
    provenanceUrl: `https://huggingface.co/${parsed.repo.id}/tree/${parsed.repo.sha}`,
    confidence: "verified" as const,
    lastUpdatedAt: timestamp(parsed.repo.lastModified),
    sourceRepo: parsed.repo.id,
    sourceSha: parsed.repo.sha,
    lastSyncedAt: now,
  });
  if (existingArtifact) await ctx.db.patch(existingArtifact._id, artifactValue);
  else await ctx.db.insert("artifacts", artifactValue);

  for (const row of parsed.benchmarkRows) {
    const existing = await ctx.db
      .query("modelBenchmarks")
      .withIndex("by_variant", (q) => q.eq("variantId", variant!._id))
      .filter((q) => q.eq(q.field("benchmarkName"), row.name))
      .first();
    const value = {
      variantId: variant._id,
      benchmarkName: row.name,
      result: row.result,
      sourceLabel: row.sourceLabel,
      sourceUrl: row.sourceUrl,
      sourceRepo: parsed.repo.id,
      sourceSha: parsed.repo.sha,
      lastSyncedAt: now,
    };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("modelBenchmarks", value);
  }
}

export const applyRepoResult = internalMutation({
  args: {
    classification: v.any(),
    sourceOwner: v.string(),
    repoKey: v.optional(v.string()),
    runId: v.id("syncRuns"),
    eventId: v.optional(v.id("webhookEvents")),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const sourceByKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.sourceOwner)))
      .first();
    const source = sourceByKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.sourceOwner))
      .first();
    if (!source) throw new Error(`Unmonitored source ${args.sourceOwner}`);
    const classification = args.classification as RepoClassification;
    const repo = classification.status === "publishable" ? classification.parsed.repo : classification.repo;
    const priorById = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_id", (q) => q.eq("repoId", args.repoKey ?? repo.id))
      .first();
    const priorByName = priorById ?? (await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", repo.id))
      .first());
    const aliases = priorByName && priorByName.repoName !== repo.id
      ? [...new Set([...priorByName.aliases, priorByName.repoName])]
      : priorByName?.aliases ?? [];
    const sourceValue = clean({
      repoId: args.repoKey ?? priorByName?.repoId ?? repo.id,
      repoName: repo.id,
      owner: repo.author,
      aliases,
      headSha: repo.sha,
      createdAt: timestamp(repo.createdAt),
      lastModifiedAt: timestamp(repo.lastModified),
      private: repo.private,
      gated: repo.gated,
      disabled: repo.disabled,
      pipelineTag: repo.pipelineTag ?? undefined,
      tags: repo.tags,
      license: repo.license ?? undefined,
      files: repo.files,
      baseModels: repo.baseModels,
      cardData: repo.cardData,
      config: repo.config,
      status: classification.status === "publishable" ? "published" as const : "skipped" as const,
      skipReason: classification.status === "skipped" ? classification.reason : undefined,
      missingCount: 0,
      lastSeenAt: args.now,
      lastIngestedAt: args.now,
    });
    const sourceRepoId = priorByName
      ? (await ctx.db.patch(priorByName._id, sourceValue), priorByName._id)
      : await ctx.db.insert("sourceRepositories", sourceValue);

    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Sync run was deleted");
    if (classification.status === "skipped") {
      if (run.kind !== "audit") {
        await ctx.db.patch(args.runId, {
          skipped: run.skipped + 1,
          changed: run.changed + 1,
        });
      }
      if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now });
      return { status: "skipped" as const, reason: classification.reason };
    }

    const parsed = classification.parsed;
    const rule = sourceRule(source);
    const documents = (await Promise.all(
      rule.familyIds.map((familyId) =>
        ctx.db
          .query("catalogEntries")
          .withIndex("by_family", (q) => q.eq("familyId", familyId))
          .collect(),
      ),
    )).flat();
    const previousRepoName = priorByName?.repoName !== parsed.repo.id ? priorByName?.repoName : undefined;
    const target = targetForParsed(documents, parsed, rule, previousRepoName ? [previousRepoName] : []);
    let payload: PublishedCatalogEntry | null = target
      ? mergeParsedIntoPayload(target.payload as PublishedCatalogEntry, parsed, source.role, previousRepoName)
      : null;
    if (!payload && source.role !== "artifact_provider") {
      const family = familyForParsed(documents, parsed, rule);
      if (family) payload = newPayload(family, parsed);
    }
    if (!payload) {
      await ctx.db.patch(sourceRepoId, {
        status: "skipped",
        skipReason: "structured metadata could not resolve a catalog family or base model",
      });
      if (run.kind !== "audit") {
        await ctx.db.patch(args.runId, { skipped: run.skipped + 1, changed: run.changed + 1 });
      }
      if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now });
      return { status: "skipped" as const, reason: "unresolved catalog identity" };
    }

    payload = await applyOverride(ctx, payload.slug, payload);
    const existingEntry = await ctx.db
      .query("catalogEntries")
      .withIndex("by_slug", (q) => q.eq("slug", payload!.slug))
      .unique();
    const sourceRepos = payload.artifacts.map((artifact) => artifact.repo);
    const catalogValue = {
      slug: payload.slug,
      familyId: payload.family.id,
      releaseId: payload.release.id,
      sizeLabel: payload.size.label,
      sourceRepos,
      updatedAt: payload.timestamp,
      payload: clean(payload),
      publishedAt: args.now,
      sourceRevision: parsed.repo.sha,
    };
    if (existingEntry) await ctx.db.patch(existingEntry._id, catalogValue);
    else await ctx.db.insert("catalogEntries", catalogValue);
    await upsertNormalized(ctx, payload, parsed, source.role, args.now, previousRepoName);

    if (run.kind !== "audit") {
      const state = await ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", "public"))
        .unique();
      const stateValue = {
        key: "public",
        revision: `${parsed.repo.sha}:${args.now}`,
        syncedAt: args.now,
        lastWebhookAt: args.eventId ? args.now : state?.lastWebhookAt,
        lastSuccessfulAuditAt: state?.lastSuccessfulAuditAt,
      };
      if (state) await ctx.db.patch(state._id, clean(stateValue));
      else await ctx.db.insert("catalogState", clean(stateValue));
      await ctx.db.patch(args.runId, {
        changed: run.changed + 1,
        published: run.published + 1,
      });
    }
    if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now });
    return { status: "published" as const, slug: payload.slug };
  },
});

export const finishWebhookRun = internalMutation({
  args: { runId: v.id("syncRuns"), now: v.number(), success: v.boolean(), message: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    await ctx.db.patch(args.runId, clean({
      status: args.success ? "success" as const : "failed" as const,
      completedAt: args.now,
      failed: args.success ? run.failed : run.failed + 1,
      message: args.message,
    }));
  },
});

export const completeUnchangedWebhook = internalMutation({
  args: { eventId: v.id("webhookEvents"), runId: v.id("syncRuns"), now: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now });
    await ctx.db.patch(args.runId, {
      status: "success",
      completedAt: args.now,
      message: "Repository SHA already processed",
    });
  },
});

export const scheduleWebhookRetry = internalMutation({
  args: {
    eventId: v.id("webhookEvents"),
    runId: v.id("syncRuns"),
    attempt: v.number(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run) await ctx.db.patch(args.runId, { retries: run.retries + 1, message: args.error });
    await ctx.scheduler.runAfter(
      30_000 * 2 ** args.attempt,
      internal.sync.processWebhook,
      { eventId: args.eventId, attempt: args.attempt + 1, runId: args.runId },
    );
  },
});

export const failWebhook = internalMutation({
  args: { eventId: v.id("webhookEvents"), runId: v.id("syncRuns"), error: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { status: "failed", error: args.error, processedAt: args.now });
    const run = await ctx.db.get(args.runId);
    if (run) {
      await ctx.db.patch(args.runId, {
        status: "failed",
        completedAt: args.now,
        failed: run.failed + 1,
        message: args.error,
      });
    }
  },
});

export const removeRepository = internalMutation({
  args: {
    repoName: v.string(),
    explicit: v.boolean(),
    now: v.number(),
    eventId: v.optional(v.id("webhookEvents")),
    runId: v.optional(v.id("syncRuns")),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_repo_name", (q) => q.eq("repoName", args.repoName))
      .unique();
    if (!source) return { removed: false };
    const missingCount = args.explicit ? 3 : source.missingCount + 1;
    await ctx.db.patch(source._id, {
      missingCount,
      status: missingCount >= 3 ? "missing" : source.status,
      lastIngestedAt: args.now,
    });
    if (missingCount >= 3) {
      const artifacts = await ctx.db
        .query("artifacts")
        .withIndex("by_repo", (q) => q.eq("huggingFaceRepo", args.repoName))
        .collect();
      for (const artifact of artifacts) await ctx.db.patch(artifact._id, { available: false, lastSyncedAt: args.now });
      const entries = await ctx.db.query("catalogEntries").collect();
      for (const entry of entries.filter((candidate) => candidate.sourceRepos.includes(args.repoName))) {
        const payload = entry.payload as PublishedCatalogEntry;
        const remaining = payload.artifacts.filter((artifact) => artifact.repo !== args.repoName);
        if (remaining.length === 0) {
          await ctx.db.delete(entry._id);
        } else {
          const nextPayload = {
            ...payload,
            artifacts: remaining,
            quantizations: [...new Set(remaining.map((artifact) => artifact.format))],
            providers: [...new Set(remaining.map((artifact) => uploaderDisplay(artifact.repo)))].sort(),
          };
          await ctx.db.patch(entry._id, {
            payload: nextPayload,
            sourceRepos: remaining.map((artifact) => artifact.repo),
            publishedAt: args.now,
            sourceRevision: `removed:${args.repoName}:${args.now}`,
          });
        }
      }
    }
    if (args.eventId) await ctx.db.patch(args.eventId, { status: "processed", processedAt: args.now });
    if (args.runId) {
      const run = await ctx.db.get(args.runId);
      if (run) await ctx.db.patch(args.runId, { changed: run.changed + 1 });
    }
    return { removed: missingCount >= 3 };
  },
});

export const processWebhook = internalAction({
  args: {
    eventId: v.id("webhookEvents"),
    attempt: v.number(),
    runId: v.optional(v.id("syncRuns")),
  },
  handler: async (ctx, args): Promise<void> => {
    const event = await ctx.runQuery(internal.sync.eventById, { eventId: args.eventId });
    if (!event || event.status !== "pending") return;
    const runId = args.runId ?? (await ctx.runMutation(internal.sync.startWebhookRun, { owner: event.owner, now: Date.now() }));
    try {
      if (event.action === "delete") {
        const result = await fetchRepo(event.repoName);
        if (result.status === 404) {
          await ctx.runMutation(internal.sync.removeRepository, {
            repoName: event.repoName,
            explicit: true,
            now: Date.now(),
            eventId: args.eventId,
            runId,
          });
          await ctx.runMutation(internal.sync.finishWebhookRun, { runId, now: Date.now(), success: true });
          return;
        }
        if (!result.data) throw new Error(`Delete confirmation failed with HTTP ${result.status}`);
      }
      const response = await fetchRepo(event.repoName);
      if (!response.data) throw new Error(`Hugging Face repo fetch failed: ${response.status}`);
      const normalized = normalizeHuggingFaceRepo(response.data);
      const prior = await ctx.runQuery(internal.sync.sourceRepoById, { repoId: event.repoId });
      if (prior?.headSha && prior.headSha === normalized.sha && prior.repoName === normalized.id) {
        await ctx.runMutation(internal.sync.completeUnchangedWebhook, {
          eventId: args.eventId,
          runId,
          now: Date.now(),
        });
        return;
      }
      const source = await ctx.runQuery(internal.sync.sourceByOwner, { owner: event.owner });
      if (!source?.enabled) throw new Error(`Source ${event.owner} is no longer monitored`);
      const classification = classifyHuggingFaceRepo(response.data, sourceRule(source));
      await ctx.runMutation(internal.sync.applyRepoResult, {
        classification,
        sourceOwner: event.owner,
        repoKey: event.repoId,
        runId,
        eventId: args.eventId,
        now: Date.now(),
      });
      await ctx.runMutation(internal.sync.finishWebhookRun, { runId, now: Date.now(), success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (args.attempt < 2) {
        await ctx.runMutation(internal.sync.scheduleWebhookRetry, {
          eventId: args.eventId,
          runId,
          attempt: args.attempt,
          error: message,
        });
      } else {
        await ctx.runMutation(internal.sync.failWebhook, {
          eventId: args.eventId,
          runId,
          error: message,
          now: Date.now(),
        });
      }
    }
  },
});

export const startDailyAudit = internalMutation({
  args: { paceMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const runningAudit = await ctx.db
      .query("syncRuns")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .filter((q) => q.eq(q.field("kind"), "audit"))
      .first();
    if (runningAudit) return { scheduled: false, runId: runningAudit._id };
    const sources = (await ctx.db
      .query("monitoredSources")
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect()).sort((left, right) => left.owner.localeCompare(right.owner));
    const now = Date.now();
    const paceMs = Math.max(5_000, Math.min(args.paceMs ?? 30_000, 60_000));
    const runId = await ctx.db.insert("syncRuns", {
      kind: "audit",
      status: "running",
      startedAt: now,
      discovered: 0,
      changed: 0,
      published: 0,
      skipped: 0,
      failed: 0,
      retries: 0,
      expectedSources: sources.length,
      completedSources: 0,
      sourceOwners: sources.map((source) => source.owner),
      sourcePaceMs: paceMs,
    });
    const firstSource = sources[0];
    if (firstSource) {
      await ctx.scheduler.runAfter(0, internal.sync.auditSource, {
        runId,
        owner: firstSource.owner,
        attempt: 0,
      });
    } else {
      await ctx.db.patch(runId, { status: "success", completedAt: now });
    }
    return { scheduled: true, runId };
  },
});

export const cancelRunningAudit = internalMutation({
  args: { reason: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const runningAudit = await ctx.db
      .query("syncRuns")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .filter((q) => q.eq(q.field("kind"), "audit"))
      .first();
    if (!runningAudit) return { cancelled: false, runId: null };
    await ctx.db.patch(runningAudit._id, {
      status: "degraded",
      completedAt: args.now,
      message: args.reason,
    });
    return { cancelled: true, runId: runningAudit._id };
  },
});

export const recordAuditRetry = internalMutation({
  args: { runId: v.id("syncRuns"), message: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    await ctx.db.patch(args.runId, { retries: run.retries + 1, message: args.message });
  },
});

export const markAuditMissing = internalMutation({
  args: { owner: v.string(), seen: v.array(v.string()), runId: v.id("syncRuns"), now: v.number() },
  handler: async (ctx, args) => {
    const seen = new Set(args.seen);
    const repos = await ctx.db
      .query("sourceRepositories")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .collect();
    for (const repo of repos) {
      if (seen.has(repo.repoName)) {
        if (repo.missingCount !== 0) await ctx.db.patch(repo._id, { missingCount: 0, lastSeenAt: args.now });
      } else {
        await ctx.scheduler.runAfter(0, internal.sync.removeRepository, {
          repoName: repo.repoName,
          explicit: false,
          now: args.now,
          runId: args.runId,
        });
      }
    }
  },
});

export const finishAuditSource = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    owner: v.string(),
    success: v.boolean(),
    discovered: v.number(),
    changed: v.number(),
    published: v.number(),
    skipped: v.number(),
    message: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    const sourceByKey = await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner_key", (q) => q.eq("ownerKey", normalizeOwnerKey(args.owner)))
      .first();
    const source = sourceByKey ?? await ctx.db
      .query("monitoredSources")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
    if (!run || !source) return;
    await ctx.db.patch(source._id, {
      lastAuditAt: args.now,
      lastSuccessAt: args.success ? args.now : source.lastSuccessAt,
      lastError: args.success ? undefined : args.message,
    });
    const completedSources = (run.completedSources ?? 0) + 1;
    const failed = run.failed + (args.success ? 0 : 1);
    const changed = run.changed + args.changed;
    const published = run.published + args.published;
    const skipped = run.skipped + args.skipped;
    const complete = completedSources >= (run.expectedSources ?? 0);
    await ctx.db.patch(args.runId, clean({
      completedSources,
      discovered: run.discovered + args.discovered,
      changed,
      published,
      skipped,
      failed,
      status: complete ? (failed > 0 ? "degraded" as const : "success" as const) : "running" as const,
      completedAt: complete ? args.now : undefined,
      message: args.success ? run.message : `${args.owner}: ${args.message ?? "source audit failed"}`,
    }));
    if (complete) {
      const state = await ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", "public"))
        .unique();
      const stateValue = clean({
        key: "public",
        revision: changed > 0 ? `audit:${args.runId}:${args.now}` : state?.revision ?? `audit:${args.now}`,
        syncedAt: args.now,
        lastWebhookAt: state?.lastWebhookAt,
        lastSuccessfulAuditAt: failed === 0 ? args.now : state?.lastSuccessfulAuditAt,
      });
      if (state) await ctx.db.patch(state._id, stateValue);
      else await ctx.db.insert("catalogState", stateValue);
    }
    return {
      nextOwner: complete ? null : run.sourceOwners?.[completedSources] ?? null,
      paceMs: run.sourcePaceMs ?? 30_000,
    };
  },
});

export const auditSource = internalAction({
  args: { runId: v.id("syncRuns"), owner: v.string(), attempt: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const activeRun = await ctx.runQuery(internal.sync.syncRunById, { runId: args.runId });
    if (!activeRun || activeRun.status !== "running") return;
    try {
      const source = await ctx.runQuery(internal.sync.sourceByOwner, { owner: args.owner });
      if (!source?.enabled) throw new Error(`Source ${args.owner} is not enabled`);
      const rawRepos = await listRepos(args.owner);
      const rule = sourceRule(source);
      const candidates = rawRepos
        .map(normalizeHuggingFaceRepo)
        .filter((repo) => repo.id && matchesSourceRules(repo.id, rule));
      const seen = candidates.map((repo) => repo.id);
      let changed = 0;
      let published = 0;
      let skipped = 0;
      for (let offset = 0; offset < candidates.length; offset += 12) {
        const batch = candidates.slice(offset, offset + 12);
        const previous = await Promise.all(
          batch.map((repo) => ctx.runQuery(internal.sync.sourceRepoByName, { repoName: repo.id })),
        );
        const changedRepos = batch.filter((repo, index) => previous[index]?.headSha !== repo.sha);
        const hydrated: Array<{ repo: (typeof changedRepos)[number]; data: unknown }> = [];
        for (const repo of changedRepos) {
          const response = await fetchRepo(repo.id);
          if (!response.data) {
            throw new Error(`Hugging Face repo fetch failed for ${repo.id}: ${response.status}`);
          }
          hydrated.push({ repo, data: response.data });
        }
        for (const result of hydrated) {
          const classification = classifyHuggingFaceRepo(result.data, rule);
          const outcome = await ctx.runMutation(internal.sync.applyRepoResult, {
            classification,
            sourceOwner: args.owner,
            repoKey: result.repo.id,
            runId: args.runId,
            now: Date.now(),
          });
          if (outcome.status === "published") published += 1;
          else skipped += 1;
          changed += 1;
        }
      }
      await ctx.runMutation(internal.sync.markAuditMissing, {
        owner: args.owner,
        seen,
        runId: args.runId,
        now: Date.now(),
      });
      const completion = await ctx.runMutation(internal.sync.finishAuditSource, {
        runId: args.runId,
        owner: args.owner,
        success: true,
        discovered: candidates.length,
        changed,
        published,
        skipped,
        now: Date.now(),
      });
      if (completion?.nextOwner) {
        await ctx.scheduler.runAfter(completion.paceMs, internal.sync.auditSource, {
          runId: args.runId,
          owner: completion.nextOwner,
          attempt: 0,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const currentRun = await ctx.runQuery(internal.sync.syncRunById, { runId: args.runId });
      if (!currentRun || currentRun.status !== "running") return;
      if (args.attempt < 2) {
        await ctx.runMutation(internal.sync.recordAuditRetry, {
          runId: args.runId,
          message,
        });
        const retryBaseMs = message.includes("429") ? 5 * 60_000 : 60_000;
        await ctx.scheduler.runAfter(retryBaseMs * 2 ** args.attempt, internal.sync.auditSource, {
          ...args,
          attempt: args.attempt + 1,
        });
        return;
      }
      const completion = await ctx.runMutation(internal.sync.finishAuditSource, {
        runId: args.runId,
        owner: args.owner,
        success: false,
        discovered: 0,
        changed: 0,
        published: 0,
        skipped: 0,
        message,
        now: Date.now(),
      });
      if (completion?.nextOwner) {
        await ctx.scheduler.runAfter(completion.paceMs, internal.sync.auditSource, {
          runId: args.runId,
          owner: completion.nextOwner,
          attempt: 0,
        });
      }
    }
  },
});
