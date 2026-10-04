/** Local UI harness (loopback by default). Synthetic data and test authentication; never a deployment. */
import { createServer } from "node:http";
import { test } from "vitest";
import { createRequire } from "node:module";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { convexToJson, jsonToConvex } from "convex/values";
import schema from "../convex/schema.ts";
import { publishableEntry, catalogSummary } from "../src/lib/atlas/published.ts";
import { CATALOG_FIXTURES } from "./catalogFixture.ts";
import { fixtureBuild, fixtureReport, fixtureDeployment } from "./deploymentFixture.ts";
import { buildsFromFiles } from "../src/lib/atlas/artifactBuilds.ts";
const { WebSocketServer } = createRequire(import.meta.url)("next/dist/compiled/ws");
process.env.WORKSPACE_ACCESS_MODE = "github";
process.env.ALLOWED_GITHUB_USER_ID = "1";
const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js", "!../convex/**/*.test.ts"]);
const t = convexTest(schema, modules);
const user = await t.run(async (ctx) => {
  const userId = await ctx.db.insert("users", { name: "Synthetic preview account" });
  await ctx.db.insert("accountOwners", { userId, githubId: "1", role: "admin" });
  const entries = CATALOG_FIXTURES.map(publishableEntry);
  for (const payload of entries) await ctx.db.insert("catalogEntries", { slug: payload.slug, familyId: payload.family.id,
    releaseId: payload.release.id, sizeLabel: payload.size.label, sourceRepos: payload.artifacts.map((a) => a.repo),
    updatedAt: 1, payload, publishedAt: 1, sourceRevision: "synthetic" });
  await ctx.db.insert("catalogSnapshotState", { key: "public", revision: "synthetic-preview", syncedAt: Date.now() });
  await ctx.db.insert("catalogSnapshotChunks", { snapshotKey: "public", chunk: 0, entries: entries.map(catalogSummary) });
  const second = buildsFromFiles(fixtureBuild.repo, fixtureBuild.revision,
    [{ path: "model-Q6_K.gguf", bytes: 30011242784, sha256: "c".repeat(64) }], [], { architecture: fixtureBuild.architecture })[0];
  for (const build of [fixtureBuild, second]) await ctx.db.insert("artifactBuilds", { ...build, modelSlug: fixtureDeployment.modelSlug, observedAt: 1 });
  await ctx.db.insert("sourceRepositories", { repoName: fixtureBuild.repo, repoId: fixtureBuild.repo, owner: "test",
    headSha: fixtureBuild.revision, private: false, gated: false, disabled: false, status: "published", missingCount: 0, lastSeenAt: 1 });
  return userId;
});
const identity = { subject: user + "|preview" };
const token = [ { alg: "none" }, { sub: identity.subject, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 } ]
  .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url")).join(".") + ".synthetic";
const allowedQuery = /^(catalog:(listPublished|getBySlug|healthSummary)|intelligence:listRecentChanges|artifactBuilds:(list|get)|workspace:(identity|accessPolicy)|comparisons:(profiles|list|get)|evidence:(listMine|listPublic|references|publicationQueue))$/;
const allowedMutation = /^(comparisons:(save|saveComputer|saveWorkload|remove)|evidence:(importBatch|remove|withdrawPublication))$/;
const stamp = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b.toString("base64"); };
const host = process.env.PREVIEW_HOST ?? "127.0.0.1";
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", host === "127.0.0.1" ? "http://localhost:3100" : "http://" + host + ":3100");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Convex-Client");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.url === "/fixture") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(fixtureReport)); return; }
  if (req.url === "/api/action") {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const value = body.path === "auth:signIn" ? { tokens: { token, refreshToken: "preview" } } : null;
    res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ status: "success", value, logLines: [] })); return;
  }
  res.end("Synthetic Akashic UI harness; not a production backend.");
});
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  let authenticated = false, version = { querySet: 0, identity: 0, ts: stamp(0) }, tick = 1;
  const queries = new Map();
  const send = (v) => ws.send(JSON.stringify(v));
  const client = () => authenticated ? t.withIdentity(identity) : t;
  async function transition(patch = {}, removed = []) {
    const modifications = [];
    for (const [queryId, q] of queries) {
      try {
        if (!allowedQuery.test(q.udfPath)) throw new Error("Query not supported by synthetic harness: " + q.udfPath);
        const value = await client().query(makeFunctionReference(q.udfPath), jsonToConvex(q.args[0]));
        modifications.push({ type: "QueryUpdated", queryId, value: convexToJson(value), logLines: [], journal: null });
      } catch (e) { modifications.push({ type: "QueryFailed", queryId, errorMessage: e.message, errorData: null, logLines: [], journal: null }); }
    }
    modifications.push(...removed.map((queryId) => ({ type: "QueryRemoved", queryId })));
    const next = { ...version, ...patch, ts: stamp(tick++) };
    send({ type: "Transition", startVersion: version, endVersion: next, modifications }); version = next;
  }
  let pending = Promise.resolve();
  ws.on("message", (raw) => { pending = pending.then(async () => {
    const m = JSON.parse(raw.toString());
    if (m.type === "Authenticate") { authenticated = m.tokenType === "User" && m.value === token; await transition({ identity: m.baseVersion + 1 }); }
    if (m.type === "ModifyQuerySet") {
      const removed = [];
      for (const q of m.modifications) { if (q.type === "Add") queries.set(q.queryId, q); else { queries.delete(q.queryId); removed.push(q.queryId); } }
      await transition({ querySet: m.newVersion }, removed);
    }
    if (m.type === "Mutation" || m.type === "Action") {
      try {
        let result;
        if (m.udfPath === "auth:signOut") result = null;
        else if (m.udfPath === "auth:signIn") result = { tokens: { token, refreshToken: "preview" } };
        else {
          if (!allowedMutation.test(m.udfPath)) throw new Error("Mutation unavailable in synthetic preview");
          result = await client().mutation(makeFunctionReference(m.udfPath), jsonToConvex(m.args[0]));
        }
        send({ type: m.type + "Response", requestId: m.requestId, success: true, result: convexToJson(result), ts: stamp(tick), logLines: [] });
        await transition();
      } catch (e) { send({ type: m.type + "Response", requestId: m.requestId, success: false, result: e.message, logLines: [] }); }
    }
  }).catch((e) => console.error(e.message)); });
  const ping = setInterval(() => { if (ws.readyState === 1) send({ type: "Ping" }); }, 10000);
  ws.on("close", () => clearInterval(ping));
});
server.listen(3218, host, () => console.log("Synthetic UI backend listening on " + host + ":3218. All state is disposable; GitHub authentication is simulated."));
test("serve disposable UI fixtures until interrupted", async () => {
  await new Promise((resolve) => process.once("SIGINT", resolve));
  for (const c of wss.clients) c.terminate(); wss.close(); server.close();
}, 3_600_000);
