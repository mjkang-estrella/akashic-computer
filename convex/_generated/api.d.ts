/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as artifactBuilds from "../artifactBuilds.js";
import type * as artifactValues from "../artifactValues.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as catalogReconciliation from "../catalogReconciliation.js";
import type * as catalogSnapshot from "../catalogSnapshot.js";
import type * as catalogValues from "../catalogValues.js";
import type * as connector from "../connector.js";
import type * as connectorClient from "../connectorClient.js";
import type * as connectorHttp from "../connectorHttp.js";
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
import type * as workspace from "../workspace.js";
import type * as workspaceAccess from "../workspaceAccess.js";
import type * as workspaceMigrations from "../workspaceMigrations.js";
import type * as workspaceSchema from "../workspaceSchema.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  artifactBuilds: typeof artifactBuilds;
  artifactValues: typeof artifactValues;
  auth: typeof auth;
  catalog: typeof catalog;
  catalogReconciliation: typeof catalogReconciliation;
  catalogSnapshot: typeof catalogSnapshot;
  catalogValues: typeof catalogValues;
  connector: typeof connector;
  connectorClient: typeof connectorClient;
  connectorHttp: typeof connectorHttp;
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
  workspace: typeof workspace;
  workspaceAccess: typeof workspaceAccess;
  workspaceMigrations: typeof workspaceMigrations;
  workspaceSchema: typeof workspaceSchema;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
