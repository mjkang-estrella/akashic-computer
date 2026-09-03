import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import {
  parseVllmRecipe,
  stableHash,
  githubRevisionFromAtom,
  type ParsedDeploymentRecipe,
  type VllmRecipeIndexItem,
} from "../src/lib/atlas/intelligence";
import { parseSglangRecipe } from "../src/lib/atlas/sglangRecipes";
import type { DeploymentRecipeProvider } from "../src/lib/atlas/types";
import type { PublishedCatalogEntry } from "../src/lib/atlas/published";
import { upsertMaterialChange } from "./intelligence";
import { scheduleCatalogSnapshotRefresh } from "./catalogSnapshot";
import { parsedDeploymentRecipeValue } from "./catalogValues";

const VLLM_REPOSITORY = "vllm-project/recipes";
const VLLM_API_ROOT = "https://recipes.vllm.ai";
const SGLANG_REPOSITORY = "sgl-project/sglang";
const MAX_RECIPES = 1_000;
const FETCH_CONCURRENCY = 8;
const WRITE_BATCH_SIZE = 24;

const providerValue = v.union(v.literal("vllm"), v.literal("sglang"));
const syncResultValue = v.object({
  status: v.union(v.literal("unchanged"), v.literal("synchronized")),
  sourceRevision: v.string(),
  recipes: v.number(),
  inserted: v.number(),
  updated: v.number(),
  removed: v.number(),
  matchedEntries: v.number(),
  changedEntries: v.number(),
});

interface RecipeSyncResult {
  status: "unchanged" | "synchronized";
  sourceRevision: string;
  recipes: number;
  inserted: number;
  updated: number;
  removed: number;
  matchedEntries: number;
  changedEntries: number;
}

type UnknownRecord = Record<string, unknown>;
type SyncState = {
  status: "running" | "success" | "failed";
  sourceRevision?: string;
  lastSuccessAt?: number;
} | null;

function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, clean(entry)]),
    ) as T;
  }
  return value;
}

function equal(left: unknown, right: unknown): boolean {
  return stableHash(left) === stableHash(right);
}

async function fetchJson(url: string, attempts = 3): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Akashic catalog synchronizer" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

async function fetchText(url: string, attempts = 3): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Akashic catalog synchronizer" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

async function mapConcurrent<T, R>(values: T[], mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]);
    }
  }));
  return results;
}

function recipeKey(provider: DeploymentRecipeProvider, upstreamId: string): string {
  return `${provider}:${upstreamId}`;
}

export const getSyncState = internalQuery({
  args: { provider: providerValue },
  returns: v.union(v.null(), v.object({
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    sourceRevision: v.optional(v.string()),
    lastSuccessAt: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("deploymentRecipeSyncState")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .unique();
    return state
      ? { status: state.status, sourceRevision: state.sourceRevision, lastSuccessAt: state.lastSuccessAt }
      : null;
  },
});

export const beginSync = internalMutation({
  args: { provider: providerValue, sourceRevision: v.string(), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("deploymentRecipeSyncState")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .unique();
    const value = {
      provider: args.provider,
      sourceRevision: args.sourceRevision,
      recipeIds: state?.recipeIds ?? [],
      status: "running" as const,
      startedAt: args.now,
      inserted: 0,
      updated: 0,
      removed: 0,
      matchedEntries: 0,
    };
    if (state) await ctx.db.patch(state._id, value);
    else await ctx.db.insert("deploymentRecipeSyncState", value);
    return null;
  },
});

export const upsertRecipeBatch = internalMutation({
  args: { recipes: v.array(parsedDeploymentRecipeValue), now: v.number() },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const recipe of args.recipes) {
      const existing = await ctx.db
        .query("deploymentRecipes")
        .withIndex("by_provider_and_upstream_id", (q) =>
          q.eq("provider", recipe.provider).eq("upstreamId", recipe.upstreamId))
        .unique();
      const value = clean({ ...recipe, available: true, lastSyncedAt: args.now });
      if (!existing) {
        await ctx.db.insert("deploymentRecipes", value);
        inserted += 1;
      } else if (existing.contentHash !== recipe.contentHash || !existing.available) {
        await ctx.db.patch(existing._id, value);
        updated += 1;
      }
    }
    return { inserted, updated };
  },
});

export const finalizeSync = internalMutation({
  args: {
    provider: providerValue,
    sourceRevision: v.string(),
    recipeIds: v.array(v.string()),
    inserted: v.number(),
    updated: v.number(),
    initialSync: v.boolean(),
    now: v.number(),
  },
  returns: v.object({ removed: v.number(), matchedEntries: v.number(), changedEntries: v.number() }),
  handler: async (ctx, args) => {
    const currentIds = new Set(args.recipeIds);
    const providerRecipes = await ctx.db
      .query("deploymentRecipes")
      .withIndex("by_provider_and_available", (q) => q.eq("provider", args.provider).eq("available", true))
      .take(MAX_RECIPES);
    let removed = 0;
    for (const recipe of providerRecipes) {
      if (currentIds.has(recipe.upstreamId)) continue;
      await ctx.db.patch(recipe._id, { available: false, lastSyncedAt: args.now });
      removed += 1;
    }

    const availableRecipes = (await Promise.all(
      (["vllm", "sglang"] as const).map((provider) =>
        ctx.db
          .query("deploymentRecipes")
          .withIndex("by_provider_and_available", (q) => q.eq("provider", provider).eq("available", true))
          .take(MAX_RECIPES)),
    )).flat();
    const recipesByRepo = new Map<string, typeof availableRecipes>();
    for (const recipe of availableRecipes) {
      for (const repo of recipe.artifactRepos) {
        const key = repo.toLowerCase();
        const matches = recipesByRepo.get(key) ?? [];
        matches.push(recipe);
        recipesByRepo.set(key, matches);
      }
    }

    const entries = await ctx.db.query("catalogEntries").withIndex("by_updated").take(2_000);
    let matchedEntries = 0;
    let changedEntries = 0;
    for (const entry of entries) {
      const payload = entry.payload as PublishedCatalogEntry;
      const repos = new Set([...entry.sourceRepos, ...payload.artifacts.map((artifact) => artifact.repo)]
        .map((repo) => repo.toLowerCase()));
      const matches = [...new Map(
        [...repos].flatMap((repo) => recipesByRepo.get(repo) ?? [])
          .map((recipe) => [recipeKey(recipe.provider, recipe.upstreamId), recipe]),
      ).values()]
        .sort((left, right) => left.runtime.localeCompare(right.runtime) || left.title.localeCompare(right.title))
        .map((recipe) => ({
          provider: recipe.provider,
          runtime: recipe.runtime,
          upstreamId: recipe.upstreamId,
          title: recipe.title,
          publisher: recipe.publisher,
          description: recipe.description,
          recipeUrl: recipe.recipeUrl,
          sourceUrl: recipe.sourceUrl,
          sourceSha: recipe.sourceSha,
          upstreamUpdatedAt: recipe.upstreamUpdatedAt,
          minimumRuntimeVersion: recipe.minimumRuntimeVersion,
          difficulty: recipe.difficulty,
          tasks: recipe.tasks,
          features: recipe.features,
          hardware: recipe.hardware,
          variants: recipe.variants,
          artifactRepos: recipe.artifactRepos,
        }));
      if (matches.some((recipe) => recipe.provider === args.provider)) matchedEntries += 1;
      const previous = payload.deploymentRecipes ?? [];
      if (equal(previous, matches)) continue;
      const nextPayload = { ...payload, deploymentRecipes: matches };
      await ctx.db.patch(entry._id, { payload: clean(nextPayload) as typeof entry.payload });
      changedEntries += 1;

      if (!args.initialSync) {
        for (const recipe of matches.filter((item) => item.provider === args.provider)) {
          const prior = previous.find((item) =>
            item.provider === recipe.provider && item.upstreamId === recipe.upstreamId);
          const type = prior ? "recipe_updated" as const : "recipe_published" as const;
          if (prior?.sourceSha === recipe.sourceSha) continue;
          await upsertMaterialChange(ctx, {
            dedupeKey: `${entry.slug}:${type}:${recipe.provider}:${recipe.recipeUrl}:${recipe.sourceSha}`,
            modelSlug: entry.slug,
            modelName: payload.name,
            type,
            occurredAt: recipe.upstreamUpdatedAt ?? args.now,
            title: prior ? `Official ${recipe.runtime} recipe updated` : `Official ${recipe.runtime} recipe available`,
            summary: `${recipe.title} is listed by the official ${recipe.runtime} recipe source.`,
            sourceLabel: `${recipe.runtime} recipes`,
            sourceUrls: [recipe.recipeUrl, recipe.sourceUrl],
          }, args.now);
        }
      }
    }

    const state = await ctx.db
      .query("deploymentRecipeSyncState")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .unique();
    if (!state) throw new Error(`${args.provider} recipe sync state disappeared`);
    await ctx.db.patch(state._id, {
      sourceRevision: args.sourceRevision,
      recipeIds: args.recipeIds,
      status: "success",
      completedAt: args.now,
      lastSuccessAt: args.now,
      lastError: undefined,
      inserted: args.inserted,
      updated: args.updated,
      removed,
      matchedEntries,
    });
    if (changedEntries > 0) {
      const catalogState = await ctx.db
        .query("catalogState")
        .withIndex("by_key", (q) => q.eq("key", "public"))
        .unique();
      if (catalogState) {
        await ctx.db.patch(catalogState._id, {
          revision: `deployment-recipes:${args.provider}:${args.sourceRevision}`,
          syncedAt: args.now,
        });
        await scheduleCatalogSnapshotRefresh(ctx, catalogState._id, catalogState.snapshotRefreshScheduledAt, args.now, 0);
      }
    }
    return { removed, matchedEntries, changedEntries };
  },
});

export const failSync = internalMutation({
  args: { provider: providerValue, sourceRevision: v.optional(v.string()), error: v.string(), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("deploymentRecipeSyncState")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .unique();
    if (state) {
      await ctx.db.patch(state._id, {
        sourceRevision: args.sourceRevision ?? state.sourceRevision,
        status: "failed",
        completedAt: args.now,
        lastError: args.error.slice(0, 1_000),
      });
    } else {
      await ctx.db.insert("deploymentRecipeSyncState", {
        provider: args.provider,
        sourceRevision: args.sourceRevision,
        recipeIds: [],
        status: "failed",
        completedAt: args.now,
        lastError: args.error.slice(0, 1_000),
        inserted: 0,
        updated: 0,
        removed: 0,
        matchedEntries: 0,
      });
    }
    return null;
  },
});

async function completeSync(
  ctx: ActionCtx,
  provider: DeploymentRecipeProvider,
  sourceRevision: string,
  state: SyncState,
  recipes: ParsedDeploymentRecipe[],
): Promise<RecipeSyncResult> {
  const now = Date.now();
  await ctx.runMutation(internal.deploymentRecipeSync.beginSync, { provider, sourceRevision, now });
  let inserted = 0;
  let updated = 0;
  for (let offset = 0; offset < recipes.length; offset += WRITE_BATCH_SIZE) {
    const result = await ctx.runMutation(internal.deploymentRecipeSync.upsertRecipeBatch, {
      recipes: clean(recipes.slice(offset, offset + WRITE_BATCH_SIZE)),
      now,
    });
    inserted += result.inserted;
    updated += result.updated;
  }
  const final = await ctx.runMutation(internal.deploymentRecipeSync.finalizeSync, {
    provider,
    sourceRevision,
    recipeIds: recipes.map((recipe) => recipe.upstreamId),
    inserted,
    updated,
    initialSync: !state?.lastSuccessAt,
    now,
  });
  return { status: "synchronized", sourceRevision, recipes: recipes.length, inserted, updated, ...final };
}

async function loadVllmRecipes(sourceRevision: string): Promise<ParsedDeploymentRecipe[]> {
  const [indexRaw, taxonomyRaw] = await Promise.all([
    fetchJson(`${VLLM_API_ROOT}/models.json`),
    fetchJson(`${VLLM_API_ROOT}/taxonomy.json`),
  ]);
  const index = Array.isArray(indexRaw)
    ? [...new Map(indexRaw.slice(0, MAX_RECIPES).flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const item = value as UnknownRecord;
        if (typeof item.hf_id !== "string" || !item.hf_id.includes("/")) return [];
        return [{
          hf_id: item.hf_id,
          title: typeof item.title === "string" ? item.title : undefined,
          provider: typeof item.provider === "string" ? item.provider : undefined,
          url: typeof item.url === "string" ? item.url : undefined,
          json: typeof item.json === "string" ? item.json : undefined,
          derived_from: typeof item.derived_from === "string" ? item.derived_from : undefined,
        } satisfies VllmRecipeIndexItem];
      }).map((item) => [item.hf_id, item])).values()]
    : [];
  const taxonomy = taxonomyRaw && typeof taxonomyRaw === "object" ? taxonomyRaw as UnknownRecord : {};
  const profiles = taxonomy.hardware_profiles && typeof taxonomy.hardware_profiles === "object"
    ? taxonomy.hardware_profiles as UnknownRecord
    : {};
  const hardwareLabels = Object.fromEntries(Object.entries(profiles).map(([id, value]) => {
    const profile = value && typeof value === "object" ? value as UnknownRecord : {};
    return [id, typeof profile.display_name === "string" ? profile.display_name : id];
  }));
  return (await mapConcurrent(index, async (item) => {
    const path = item.json ?? `/${item.hf_id}.json`;
    const url = new URL(path, VLLM_API_ROOT);
    if (url.origin !== VLLM_API_ROOT) throw new Error(`Unexpected recipe origin for ${item.hf_id}`);
    return parseVllmRecipe(item, await fetchJson(url.toString()), sourceRevision, hardwareLabels);
  })).filter((recipe): recipe is ParsedDeploymentRecipe => recipe !== null);
}

async function loadSglangRecipes(sourceRevision: string): Promise<ParsedDeploymentRecipe[]> {
  const docsIndex = await fetchJson(
    `https://raw.githubusercontent.com/${SGLANG_REPOSITORY}/${sourceRevision}/docs/docs.json`,
  );
  const pageIds: string[] = [];
  const collectPageIds = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.startsWith("cookbook/") && !value.includes("/base/") && !value.endsWith("/intro")) {
        pageIds.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectPageIds);
      return;
    }
    if (value && typeof value === "object") Object.values(value as UnknownRecord).forEach(collectPageIds);
  };
  collectPageIds(docsIndex);
  const pages = await mapConcurrent([...new Set(pageIds)].slice(0, MAX_RECIPES), async (pageId) => {
    const pagePath = `docs/${pageId}.mdx`;
    const pageSource = await fetchText(
      `https://raw.githubusercontent.com/${SGLANG_REPOSITORY}/${sourceRevision}/${pagePath}`,
    );
    const configImport = pageSource.match(
      /import\s*\{\s*config\s*\}\s*from\s*["']\/(src\/snippets\/configs\/[^"']+\.jsx)["']/,
    );
    return configImport ? { pagePath, pageSource, configPath: `docs/${configImport[1]}` } : null;
  });
  const candidates = [...new Map(
    pages.flatMap((page) => page ? [[page.configPath, page] as const] : []),
  ).values()];
  return (await mapConcurrent(candidates, async ({ configPath, pagePath, pageSource }) => {
    const configSource = await fetchText(
      `https://raw.githubusercontent.com/${SGLANG_REPOSITORY}/${sourceRevision}/${configPath}`,
    );
    return parseSglangRecipe({ configSource, pageSource, configPath, pagePath, sourceSha: sourceRevision });
  })).filter((recipe): recipe is ParsedDeploymentRecipe => recipe !== null);
}

async function syncProvider(
  ctx: ActionCtx,
  provider: DeploymentRecipeProvider,
  repository: string,
  force: boolean,
  loader: (sourceRevision: string) => Promise<ParsedDeploymentRecipe[]>,
): Promise<RecipeSyncResult> {
  let sourceRevision: string | undefined;
  try {
    const feed = await fetchText(`https://github.com/${repository}/commits/main.atom`);
    sourceRevision = githubRevisionFromAtom(feed) ?? undefined;
    if (!sourceRevision) throw new Error(`GitHub did not return the ${provider} recipe revision`);
    const state: SyncState = await ctx.runQuery(internal.deploymentRecipeSync.getSyncState, { provider });
    if (!force && state?.status === "success" && state.sourceRevision === sourceRevision) {
      return { status: "unchanged", sourceRevision, recipes: 0, inserted: 0, updated: 0, removed: 0, matchedEntries: 0, changedEntries: 0 };
    }
    return await completeSync(ctx, provider, sourceRevision, state, await loader(sourceRevision));
  } catch (error) {
    await ctx.runMutation(internal.deploymentRecipeSync.failSync, {
      provider,
      sourceRevision,
      error: error instanceof Error ? error.message : String(error),
      now: Date.now(),
    });
    throw error;
  }
}

export const syncVllm = internalAction({
  args: { force: v.optional(v.boolean()) },
  returns: syncResultValue,
  handler: async (ctx, args): Promise<RecipeSyncResult> =>
    await syncProvider(ctx, "vllm", VLLM_REPOSITORY, args.force ?? false, loadVllmRecipes),
});

export const syncSglang = internalAction({
  args: { force: v.optional(v.boolean()) },
  returns: syncResultValue,
  handler: async (ctx, args): Promise<RecipeSyncResult> =>
    await syncProvider(ctx, "sglang", SGLANG_REPOSITORY, args.force ?? false, loadSglangRecipes),
});

const providerRunValue = v.object({
  provider: providerValue,
  status: v.union(v.literal("unchanged"), v.literal("synchronized"), v.literal("failed")),
  recipes: v.number(),
  matchedEntries: v.number(),
  error: v.optional(v.string()),
});
type ProviderRun = {
  provider: DeploymentRecipeProvider;
  status: "unchanged" | "synchronized" | "failed";
  recipes: number;
  matchedEntries: number;
  error?: string;
};

async function runProvider(
  ctx: ActionCtx,
  provider: DeploymentRecipeProvider,
  force: boolean | undefined,
): Promise<ProviderRun> {
  try {
    const result: RecipeSyncResult = provider === "vllm"
      ? await ctx.runAction(internal.deploymentRecipeSync.syncVllm, { force })
      : await ctx.runAction(internal.deploymentRecipeSync.syncSglang, { force });
    return { provider, status: result.status, recipes: result.recipes, matchedEntries: result.matchedEntries };
  } catch (error) {
    return {
      provider,
      status: "failed",
      recipes: 0,
      matchedEntries: 0,
      error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    };
  }
}

export const syncAll = internalAction({
  args: { force: v.optional(v.boolean()) },
  returns: v.array(providerRunValue),
  handler: async (ctx, args): Promise<ProviderRun[]> => await Promise.all([
    runProvider(ctx, "vllm", args.force),
    runProvider(ctx, "sglang", args.force),
  ]),
});
