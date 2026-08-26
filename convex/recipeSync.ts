import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import {
  parseVllmRecipe,
  stableHash,
  vllmRecipeRevisionFromAtom,
  type ParsedRecipeReference,
  type VllmRecipeIndexItem,
} from "../src/lib/atlas/intelligence";
import type { PublishedCatalogEntry } from "../src/lib/atlas/published";
import { upsertMaterialChange } from "./intelligence";
import { scheduleCatalogSnapshotRefresh } from "./catalogSnapshot";

const RECIPE_STATE_KEY = "vllm";
const GITHUB_REPOSITORY = "vllm-project/recipes";
const API_ROOT = "https://recipes.vllm.ai";
const MAX_RECIPES = 1_000;
const FETCH_CONCURRENCY = 8;
const WRITE_BATCH_SIZE = 24;

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
      const response = await fetch(url, {
        headers: { "User-Agent": "Akashic catalog synchronizer" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

async function fetchText(url: string, attempts = 3): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Akashic catalog synchronizer" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]);
    }
  }));
  return results;
}

export const getSyncState = internalQuery({
  args: {},
  returns: v.union(v.null(), v.object({
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    sourceRevision: v.optional(v.string()),
    lastSuccessAt: v.optional(v.number()),
  })),
  handler: async (ctx) => {
    const state = await ctx.db
      .query("recipeSyncState")
      .withIndex("by_key", (q) => q.eq("key", RECIPE_STATE_KEY))
      .unique();
    return state
      ? { status: state.status, sourceRevision: state.sourceRevision, lastSuccessAt: state.lastSuccessAt }
      : null;
  },
});

export const beginSync = internalMutation({
  args: { sourceRevision: v.string(), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("recipeSyncState")
      .withIndex("by_key", (q) => q.eq("key", RECIPE_STATE_KEY))
      .unique();
    const value = {
      key: RECIPE_STATE_KEY,
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
    else await ctx.db.insert("recipeSyncState", value);
    return null;
  },
});

export const upsertRecipeBatch = internalMutation({
  args: { recipes: v.array(v.any()), now: v.number() },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const raw of args.recipes) {
      const recipe = raw as ParsedRecipeReference;
      const existing = await ctx.db
        .query("recipeReferences")
        .withIndex("by_upstream_id", (q) => q.eq("upstreamId", recipe.upstreamId))
        .unique();
      const value = clean({
        ...recipe,
        available: true,
        lastSyncedAt: args.now,
      });
      if (!existing) {
        await ctx.db.insert("recipeReferences", value);
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
    const storedRecipes = await ctx.db
      .query("recipeReferences")
      .withIndex("by_available", (q) => q.eq("available", true))
      .take(MAX_RECIPES);
    let removed = 0;
    for (const recipe of storedRecipes) {
      if (currentIds.has(recipe.upstreamId)) continue;
      await ctx.db.patch(recipe._id, { available: false, lastSyncedAt: args.now });
      removed += 1;
    }
    const availableRecipes = storedRecipes.filter((recipe) => currentIds.has(recipe.upstreamId));
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
      const repos = new Set([
        ...entry.sourceRepos,
        ...payload.artifacts.map((artifact) => artifact.repo),
      ].map((repo) => repo.toLowerCase()));
      const matches = [...new Map(
        [...repos].flatMap((repo) => recipesByRepo.get(repo) ?? [])
          .map((recipe) => [recipe.upstreamId, recipe]),
      ).values()]
        .sort((left, right) => left.title.localeCompare(right.title))
        .map((recipe) => ({
          provider: recipe.provider,
          upstreamId: recipe.upstreamId,
          title: recipe.title,
          publisher: recipe.publisher,
          description: recipe.description,
          recipeUrl: recipe.recipeUrl,
          sourceUrl: recipe.sourceUrl,
          sourceSha: recipe.sourceSha,
          upstreamUpdatedAt: recipe.upstreamUpdatedAt,
          minimumVllmVersion: recipe.minimumVllmVersion,
          difficulty: recipe.difficulty,
          tasks: recipe.tasks,
          features: recipe.features,
          verifiedHardware: recipe.verifiedHardware,
          variants: recipe.variants,
          artifactRepos: recipe.artifactRepos,
        }));
      if (matches.length > 0) matchedEntries += 1;
      const previous = payload.recipeReferences ?? [];
      if (equal(previous, matches)) continue;
      await ctx.db.patch(entry._id, { payload: clean({ ...payload, recipeReferences: matches }) });
      changedEntries += 1;

      if (!args.initialSync) {
        for (const recipe of matches) {
          const prior = previous.find((item) => item.upstreamId === recipe.upstreamId);
          const type = prior ? "recipe_updated" as const : "recipe_published" as const;
          if (prior && prior.sourceSha === recipe.sourceSha) continue;
          await upsertMaterialChange(ctx, {
            dedupeKey: `${entry.slug}:${type}:${recipe.recipeUrl}:${recipe.sourceSha}`,
            modelSlug: entry.slug,
            modelName: payload.name,
            type,
            occurredAt: recipe.upstreamUpdatedAt ?? args.now,
            title: prior ? "Official vLLM recipe updated" : "Official vLLM recipe available",
            summary: `${recipe.title} is listed by the official vLLM Recipes project.`,
            sourceLabel: "vLLM Recipes",
            sourceUrls: [recipe.recipeUrl, recipe.sourceUrl],
          }, args.now);
        }
      }
    }

    const state = await ctx.db
      .query("recipeSyncState")
      .withIndex("by_key", (q) => q.eq("key", RECIPE_STATE_KEY))
      .unique();
    if (!state) throw new Error("Recipe sync state disappeared");
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
          revision: `recipes:${args.sourceRevision}`,
          syncedAt: args.now,
        });
        await scheduleCatalogSnapshotRefresh(
          ctx,
          catalogState._id,
          catalogState.snapshotRefreshScheduledAt,
          args.now,
          0,
        );
      }
    }
    return { removed, matchedEntries, changedEntries };
  },
});

export const failSync = internalMutation({
  args: { sourceRevision: v.optional(v.string()), error: v.string(), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("recipeSyncState")
      .withIndex("by_key", (q) => q.eq("key", RECIPE_STATE_KEY))
      .unique();
    if (state) {
      await ctx.db.patch(state._id, {
        sourceRevision: args.sourceRevision ?? state.sourceRevision,
        status: "failed",
        completedAt: args.now,
        lastError: args.error.slice(0, 1_000),
      });
    } else {
      await ctx.db.insert("recipeSyncState", {
        key: RECIPE_STATE_KEY,
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

export const syncVllmRecipes = internalAction({
  args: { force: v.optional(v.boolean()) },
  returns: v.object({
    status: v.union(v.literal("unchanged"), v.literal("synchronized")),
    sourceRevision: v.string(),
    recipes: v.number(),
    inserted: v.number(),
    updated: v.number(),
    removed: v.number(),
    matchedEntries: v.number(),
    changedEntries: v.number(),
  }),
  handler: async (ctx, args): Promise<RecipeSyncResult> => {
    let sourceRevision: string | undefined;
    try {
      const commitFeed = await fetchText(`https://github.com/${GITHUB_REPOSITORY}/commits/main.atom`);
      sourceRevision = vllmRecipeRevisionFromAtom(commitFeed) ?? undefined;
      if (!sourceRevision) throw new Error("GitHub did not return the vLLM Recipes revision");
      const state: {
        status: "running" | "success" | "failed";
        sourceRevision?: string;
        lastSuccessAt?: number;
      } | null =
        await ctx.runQuery(internal.recipeSync.getSyncState, {});
      if (!args.force && state?.status === "success" && state.sourceRevision === sourceRevision) {
        return {
          status: "unchanged" as const,
          sourceRevision,
          recipes: 0,
          inserted: 0,
          updated: 0,
          removed: 0,
          matchedEntries: 0,
          changedEntries: 0,
        };
      }
      const now = Date.now();
      await ctx.runMutation(internal.recipeSync.beginSync, { sourceRevision, now });
      const [indexRaw, taxonomyRaw] = await Promise.all([
        fetchJson(`${API_ROOT}/models.json`),
        fetchJson(`${API_ROOT}/taxonomy.json`),
      ]);
      const index = Array.isArray(indexRaw)
        ? [...new Map(
            indexRaw.slice(0, MAX_RECIPES).flatMap((value) => {
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
            })
              .map((item) => [item.hf_id, item]),
          ).values()]
        : [];
      const taxonomy = taxonomyRaw && typeof taxonomyRaw === "object" ? taxonomyRaw as UnknownRecord : {};
      const profiles = taxonomy.hardware_profiles && typeof taxonomy.hardware_profiles === "object"
        ? taxonomy.hardware_profiles as UnknownRecord
        : {};
      const hardwareLabels = Object.fromEntries(Object.entries(profiles).map(([id, value]) => {
        const profile = value && typeof value === "object" ? value as UnknownRecord : {};
        return [id, typeof profile.display_name === "string" ? profile.display_name : id];
      }));
      const parsed = (await mapConcurrent(index, FETCH_CONCURRENCY, async (item) => {
        const path = item.json ?? `/${item.hf_id}.json`;
        const url = new URL(path, API_ROOT);
        if (url.origin !== API_ROOT) throw new Error(`Unexpected recipe origin for ${item.hf_id}`);
        const raw = await fetchJson(url.toString());
        return parseVllmRecipe(item, raw, sourceRevision!, hardwareLabels);
      })).filter((recipe): recipe is ParsedRecipeReference => recipe !== null);

      let inserted = 0;
      let updated = 0;
      for (let offset = 0; offset < parsed.length; offset += WRITE_BATCH_SIZE) {
        const result = await ctx.runMutation(internal.recipeSync.upsertRecipeBatch, {
          recipes: clean(parsed.slice(offset, offset + WRITE_BATCH_SIZE)),
          now,
        });
        inserted += result.inserted;
        updated += result.updated;
      }
      const final: { removed: number; matchedEntries: number; changedEntries: number } =
        await ctx.runMutation(internal.recipeSync.finalizeSync, {
        sourceRevision,
        recipeIds: parsed.map((recipe) => recipe.upstreamId),
        inserted,
        updated,
        initialSync: !state?.lastSuccessAt,
        now,
        });
      return {
        status: "synchronized" as const,
        sourceRevision,
        recipes: parsed.length,
        inserted,
        updated,
        ...final,
      };
    } catch (error) {
      await ctx.runMutation(internal.recipeSync.failSync, {
        sourceRevision,
        error: error instanceof Error ? error.message : String(error),
        now: Date.now(),
      });
      throw error;
    }
  },
});
