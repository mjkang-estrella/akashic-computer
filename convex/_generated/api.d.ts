/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as catalog from "../catalog.js";
import type * as catalogReconciliation from "../catalogReconciliation.js";
import type * as catalogSnapshot from "../catalogSnapshot.js";
import type * as catalogValues from "../catalogValues.js";
import type * as crons from "../crons.js";
import type * as deploymentRecipeSync from "../deploymentRecipeSync.js";
import type * as familyConfig from "../familyConfig.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as huggingFaceClient from "../huggingFaceClient.js";
import type * as intelligence from "../intelligence.js";
import type * as sourceConfig from "../sourceConfig.js";
import type * as sourceConfigSync from "../sourceConfigSync.js";
import type * as sync from "../sync.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  catalog: typeof catalog;
  catalogReconciliation: typeof catalogReconciliation;
  catalogSnapshot: typeof catalogSnapshot;
  catalogValues: typeof catalogValues;
  crons: typeof crons;
  deploymentRecipeSync: typeof deploymentRecipeSync;
  familyConfig: typeof familyConfig;
  health: typeof health;
  http: typeof http;
  huggingFaceClient: typeof huggingFaceClient;
  intelligence: typeof intelligence;
  sourceConfig: typeof sourceConfig;
  sourceConfigSync: typeof sourceConfigSync;
  sync: typeof sync;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
