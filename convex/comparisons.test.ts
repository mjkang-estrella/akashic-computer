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
    await expect(a.mutation(api.evidence.publish, { reportId })).rejects.toThrow("consent");
    await expect(a.mutation(api.evidence.consentToPublication, { reportId })).rejects.toThrow("not found");
    await b.mutation(api.evidence.consentToPublication, { reportId });
    await expect(b.mutation(api.evidence.publish, { reportId })).rejects.toThrow("Administrator");
    await a.mutation(api.evidence.publish, { reportId });
    const published = (await t.query(api.evidence.listPublic, opts)).page[0];
    expect(published.evidence.deployment!.computer.name).toBe("Published hardware");
    expect(published).not.toHaveProperty("ownerId");
    await b.mutation(api.evidence.withdrawPublication, { reportId });
    expect((await t.query(api.evidence.listPublic, opts)).page).toEqual([]);
    expect((await b.query(api.evidence.listMine, opts)).page).toHaveLength(1);
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
