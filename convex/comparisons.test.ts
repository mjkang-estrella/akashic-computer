/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, it, expect, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { publishableEntry } from "../src/lib/atlas/published";
import { QWEN_ENTRY } from "../test/catalogFixture";
import { fixtureBuild, fixtureReport, fixtureDeployment } from "../test/deploymentFixture";
const modules = import.meta.glob("./**/*.*s");
beforeEach(() => { vi.stubEnv("WORKSPACE_ACCESS_MODE", "github"); vi.stubEnv("ALLOWED_GITHUB_USER_ID", "1"); });
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { name: "One" }), b = await ctx.db.insert("users", { name: "Two" });
    const account = await ctx.db.insert("accountOwners", { userId: a, githubId: "1", role: "admin" });
    await ctx.db.insert("accountOwners", { userId: b, githubId: "2", role: "member" });
    const connector = await ctx.db.insert("connectors", { ownerId: a, name: "Test", credentialHash: "a".repeat(64), lastSeenAt: 0 });
    const payload = publishableEntry(QWEN_ENTRY);
    await ctx.db.insert("catalogEntries", { slug: payload.slug, familyId: payload.family.id, releaseId: payload.release.id,
      sizeLabel: payload.size.label, sourceRepos: [fixtureBuild.repo], updatedAt: 1, payload, publishedAt: 1, sourceRevision: "a".repeat(40) });
    await ctx.db.insert("artifactBuilds", { ...fixtureBuild, modelSlug: payload.slug, observedAt: 1 });
    return { a, b, account, connector };
  });
  return { t, ids, a: t.withIdentity({ subject: ids.a + "|session" }), b: t.withIdentity({ subject: ids.b + "|session" }) };
}
describe("multi-user deployment decisions", () => {
  it("keeps model-level fidelity private and historical revisions selectable after a README-only update", async () => {
    const { t, a, b } = await setup();
    const contextual = { schemaVersion: 2, id: "unbound", kind: "fidelity", modelSlug: fixtureReport.modelSlug,
      artifactRepo: "AesSedai/example", source: { label: "Context only", origin: "published", limitations: [] },
      protocol: { cache: "unknown", aggregation: "source-reported" }, fidelity: { kld: 0.006 } };
    await a.mutation(api.evidence.importBatch, { json: JSON.stringify(contextual) });
    const args = { modelSlug: fixtureReport.modelSlug, paginationOpts: { numItems: 10, cursor: null } };
    expect((await a.query(api.evidence.listMine, args)).page).toHaveLength(1);
    expect((await b.query(api.evidence.listMine, args)).page).toHaveLength(0);
    expect((await t.query(api.evidence.listPublic, args)).page).toHaveLength(0);
    await t.run(async (ctx) => { await ctx.db.insert("sourceRepositories", { repoId: "stable", repoName: fixtureBuild.repo,
      owner: "test", headSha: "d".repeat(40), private: false, gated: false, disabled: false, status: "published", missingCount: 0, lastSeenAt: 1 }); });
    const picker = { repo: fixtureBuild.repo, paginationOpts: args.paginationOpts };
    expect((await t.query(api.artifactBuilds.list, picker)).page).toHaveLength(0);
    expect((await t.query(api.artifactBuilds.list, { ...picker, includeHistory: true })).page[0].key).toBe(fixtureBuild.key);
  });
  it("isolates profiles, compares immutable snapshots and protects direct IDs", async () => {
    const { a, b } = await setup();
    const computer = await a.mutation(api.comparisons.saveComputer, { profile: fixtureDeployment.computer });
    const comparison = await a.mutation(api.comparisons.save, { value: { name: "Choice", configurations: [fixtureDeployment],
      selectedConfigurationId: fixtureDeployment.id, rationale: "Keep fidelity", evidenceIds: [] } });
    await a.mutation(api.comparisons.saveComputer, { id: computer, profile: { ...fixtureDeployment.computer, name: "Updated" } });
    expect((await a.query(api.comparisons.get, { id: comparison }))!.configurations[0].computer.name).toBe("Framework Desktop");
    expect(await b.query(api.comparisons.get, { id: comparison })).toBeNull();
    expect((await b.query(api.comparisons.profiles, {})).computers).toEqual([]);
    await expect(b.mutation(api.comparisons.remove, { id: computer })).rejects.toThrow("not found");
  });
  it("imports idempotently and requires consent plus administrator publication", async () => {
    const { t, a, b } = await setup();
    const first = await b.mutation(api.evidence.importBatch, { json: JSON.stringify(fixtureReport) });
    const reportId = first.reportIds[0];
    expect(first.inserted).toBe(1);
    expect((await b.mutation(api.evidence.importBatch, { json: JSON.stringify(fixtureReport) })).unchanged).toBe(1);
    await expect(b.mutation(api.evidence.importBatch, { json: JSON.stringify({ ...fixtureReport, source: { ...fixtureReport.source, label: "Changed" } }) })).rejects.toThrow("different content");
    const opts = { buildKey: fixtureBuild.key, paginationOpts: { numItems: 10, cursor: null } };
    expect((await t.query(api.evidence.listPublic, opts)).page).toEqual([]);
    expect(await a.query(api.evidence.references, { reportIds: [reportId] })).toEqual([]);
    expect(await b.query(api.evidence.references, { reportIds: [reportId] })).toHaveLength(1);
    await expect(a.mutation(api.evidence.publish, { reportId })).rejects.toThrow("consent");
    await expect(a.mutation(api.evidence.consentToPublication, { reportId })).rejects.toThrow("not found");
    await b.mutation(api.evidence.consentToPublication, { reportId });
    await expect(b.mutation(api.evidence.publish, { reportId })).rejects.toThrow("Administrator");
    await a.mutation(api.evidence.publish, { reportId });
    const published = (await t.query(api.evidence.listPublic, opts)).page[0];
    expect(published.evidence.deployment!.computer.name).toBe("Published hardware");
    expect(published).not.toHaveProperty("ownerId");
    expect((await a.query(api.evidence.references, { reportIds: [reportId] }))[0].evidence.deployment!.computer.name).toBe("Published hardware");
    await b.mutation(api.evidence.withdrawPublication, { reportId });
    expect((await t.query(api.evidence.listPublic, opts)).page).toEqual([]);
    expect((await b.query(api.evidence.listMine, opts)).page).toHaveLength(1);
    expect(await a.query(api.evidence.references, { reportIds: [reportId] })).toEqual([]);
  });
  it("enforces import quotas transactionally without scanning all report bodies", async () => {
    const { t, a, ids } = await setup();
    await t.run(async (ctx) => { await ctx.db.patch(ids.account, { importedReportCount: 1000 }); });
    await expect(a.mutation(api.evidence.importBatch, { json: JSON.stringify(fixtureReport) })).rejects.toThrow("1,000");
    await t.run(async (ctx) => { await ctx.db.patch(ids.account, { importedReportCount: 999 }); });
    const imported = await a.mutation(api.evidence.importBatch, { json: JSON.stringify(fixtureReport) });
    expect((await a.mutation(api.evidence.importBatch, { json: JSON.stringify(fixtureReport) })).unchanged).toBe(1);
    await a.mutation(api.evidence.remove, { reportId: imported.reportIds[0] });
    expect(await t.run(async (ctx) => (await ctx.db.get(ids.account))!.importedReportCount)).toBe(999);
  });
  it("retains historical pins across source renames without exposing a newly private source", async () => {
    const { t } = await setup();
    const source = await t.run(async (ctx) => {
      const id = await ctx.db.insert("sourceRepositories", { repoId: "stable-id", repoName: fixtureBuild.repo, owner: "test",
        headSha: fixtureBuild.revision, private: false, gated: false, disabled: false, status: "published", missingCount: 0, lastSeenAt: 1 });
      const build = await ctx.db.query("artifactBuilds").withIndex("by_key", (q) => q.eq("key", fixtureBuild.key)).unique();
      await ctx.db.patch(build!._id, { sourceRepositoryId: id });
      await ctx.db.patch(id, { repoName: "renamed/model" });
      return id;
    });
    expect((await t.query(api.artifactBuilds.get, { key: fixtureBuild.key }))!.revision).toBe(fixtureBuild.revision);
    await t.run(async (ctx) => { await ctx.db.patch(source, { private: true }); });
    expect(await t.query(api.artifactBuilds.get, { key: fixtureBuild.key })).toBeNull();
  });
  it("rejects mismatched artifacts, suspensions and unowned evidence references", async () => {
    const { t, a, b, ids } = await setup();
    const wrong = { ...fixtureReport, artifactRepo: "another/Q8" };
    await expect(a.mutation(api.evidence.importBatch, { json: JSON.stringify(wrong) })).rejects.toThrow("subject");
    const imported = await a.mutation(api.evidence.importBatch, { json: JSON.stringify(fixtureReport) });
    await expect(b.mutation(api.comparisons.save, { value: { name: "Invalid", configurations: [fixtureDeployment], rationale: "", evidenceIds: imported.reportIds } })).rejects.toThrow("Evidence not found");
    await t.run(async (ctx) => { await ctx.db.patch(ids.account, { status: "suspended" }); });
    await expect(a.query(api.comparisons.profiles, {})).rejects.toThrow("not allowed");
    await expect(t.mutation(internal.connector.heartbeat, { credentialHash: "a".repeat(64), devices: [], deployments: [] })).rejects.toThrow("not allowed");
  });
});
