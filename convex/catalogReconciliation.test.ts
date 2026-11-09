import { afterEach, describe, expect, it, vi } from "vitest";
import { modelEntry } from "../test/catalogFixture";
import { publishableEntry } from "../src/lib/atlas/published";
import { classifyHuggingFaceRepo, compactClassification, type MonitoredSourceRule } from "../src/lib/atlas/huggingface";
import { clean, targetForParsed, mergeParsedIntoPayload } from "./catalogReconciliation";
import type { Doc } from "./_generated/dataModel";

const creator: MonitoredSourceRule = { owner: "zai-org", role: "creator", familyIds: ["glm"] };
afterEach(() => vi.restoreAllMocks());
function parsed(name: string, params = 321, bases: string[] = []) {
  const result = compactClassification(classifyHuggingFaceRepo({ id: `zai-org/${name}`, author: "zai-org", sha: "abc",
    pipeline_tag: "text-generation", tags: ["license:mit"], siblings: [{ rfilename: "model.safetensors" }],
    safetensors: { parameters: { BF16: params * 1e9 } }, cardData: { license: "mit", base_model: bases } }, creator));
  if (result.status !== "publishable") throw new Error(result.reason);
  return result.parsed;
}
function doc(name: string, size: number, repos: string[]): Doc<"catalogEntries"> {
  const payload = publishableEntry(modelEntry({ slug: name, repo: repos[0], familyId: "glm", familyName: "GLM", releaseName: name,
    sizeLabel: `${size}B`, paramsB: size }));
  return { slug: name, familyId: "glm", payload, sourceRepos: repos } as Doc<"catalogEntries">;
}
describe("exact model identity reconciliation", () => {
  const flash = doc("GLM 5.3 Flash", 321, ["zai-org/GLM-5.3-Flash"]);
  const regular = doc("GLM 5.3", 753, ["zai-org/GLM-5.3"]);
  it("never joins Flash and regular models by substring, even with a stale existing link", () => {
    const polluted = { ...flash, sourceRepos: [...flash.sourceRepos, "zai-org/GLM-5.3"] };
    expect(targetForParsed([polluted], parsed("GLM-5.3", 753), creator)).toBeNull();
    expect(targetForParsed([regular], parsed("GLM-5.3-Flash"), creator)).toBeNull();
    expect(targetForParsed([flash, regular], parsed("GLM-5.3-BF16", 753), creator)).toBe(regular);
    expect(targetForParsed([flash, regular], parsed("GLM-5.3-Flash-FP8"), creator)).toBe(flash);
  });
  it("requires size agreement for size-free names and does not choose among ambiguous identities", () => {
    expect(targetForParsed([flash], parsed("GLM-5.3-Flash", 753), creator)).toBeNull();
    expect(targetForParsed([flash, { ...flash }], parsed("GLM-5.3-Flash"), creator)).toBeNull();
  });
  it("uses complete exact structured lineage for provider artifacts", () => {
    const provider = { ...creator, role: "artifact_provider" as const };
    expect(targetForParsed([flash, regular], parsed("GLM-5.3-FP8", 753, ["zai-org/GLM-5.3"]), provider)).toBe(regular);
    expect(targetForParsed([flash, regular], parsed("Quant", 321, ["zai-org/GLM-5.3", "zai-org/GLM-5.3-Flash"]), provider)).toBeNull();
    expect(targetForParsed([flash], parsed("Quant", 321, ["unknown/base"]), provider)).toBeNull();
    expect(targetForParsed([flash], parsed("GLM-5.3-Flash-GGUF"), provider)).toBeNull();
    expect(targetForParsed([regular], parsed("My-Finetune", 753, ["zai-org/GLM-5.3"]), provider)).toBeNull();
  });
});

it("does not let a provider artifact change canonical architecture metadata", () => {
  const original = publishableEntry(modelEntry({ slug: "flash", repo: "zai-org/GLM-5.3-Flash", paramsB: 321 }));
  original.size.activeParamsB = 18;
  original.size.isMoe = true;
  const provider = { ...parsed("GLM-5.3-Flash-FP8", 321, ["zai-org/GLM-5.3-Flash"]), activeParamsB: 42 };
  const updated = mergeParsedIntoPayload(original, provider, "artifact_provider");
  expect(updated.size.activeParamsB).toBe(18);
  expect(updated.size.isMoe).toBe(true);
});

describe("artifact source timestamps", () => {
  function original() {
    return publishableEntry(modelEntry({ slug: "flash", repo: "zai-org/GLM-5.3-Flash", paramsB: 321 }));
  }

  it.each([undefined, 0, Date.parse("2026-01-01")])(
    "keeps missing-date replays stable with previous timestamp %s",
    (previous) => {
      const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-01"));
      const entry = original();
      entry.artifacts[0].lastUpdatedAt = previous;
      const input = parsed("GLM-5.3-Flash");
      const first = clean(mergeParsedIntoPayload(entry, input, "creator"));
      expect(first.artifacts[0].lastUpdatedAt).toBe(previous);
      if (previous === undefined) expect(first.artifacts[0]).not.toHaveProperty("lastUpdatedAt");
      clock.mockReturnValue(Date.parse("2026-11-01"));
      expect(clean(mergeParsedIntoPayload(first, input, "creator"))).toEqual(first);
    },
  );

  it("leaves a new undated artifact unknown and preserves real metadata changes", () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-01"));
    const input = parsed("GLM-5.3-Flash-FP8", 321, ["zai-org/GLM-5.3-Flash"]);
    const first = clean(mergeParsedIntoPayload(original(), input, "artifact_provider"));
    expect(first.artifacts).toHaveLength(2);
    expect(first.artifacts[1]).not.toHaveProperty("lastUpdatedAt");
    clock.mockReturnValue(Date.parse("2026-11-01"));
    expect(clean(mergeParsedIntoPayload(first, input, "artifact_provider"))).toEqual(first);
    const changed = clean(mergeParsedIntoPayload(first, {
      ...input, repo: { ...input.repo, gated: !input.repo.gated },
    }, "artifact_provider"));
    expect(changed).not.toEqual(first);
    expect(changed.artifacts[1].gated).toBe(!input.repo.gated);
    expect(changed.artifacts[1]).not.toHaveProperty("lastUpdatedAt");
  });

  it.each([
    { weightsLastModified: "2026-03-01", createdAt: "2026-01-01", lastModified: "2026-04-01", expected: "2026-03-01" },
    { weightsLastModified: null, createdAt: "2026-01-01", lastModified: "2026-04-01", expected: "2026-01-01" },
    { weightsLastModified: "invalid", createdAt: "invalid", lastModified: "2026-04-01", expected: "2026-04-01" },
  ])("preserves source-date precedence: $expected", ({ expected, ...dates }) => {
    const entry = original();
    entry.artifacts[0].lastUpdatedAt = Date.parse("2025-01-01");
    const input = parsed("GLM-5.3-Flash");
    input.repo = { ...input.repo, ...dates };
    const first = clean(mergeParsedIntoPayload(entry, input, "creator"));
    expect(first.artifacts[0].lastUpdatedAt).toBe(Date.parse(expected));
    const newer = clean(mergeParsedIntoPayload(first, {
      ...input, repo: { ...input.repo, weightsLastModified: "2026-05-01" },
    }, "creator"));
    expect(newer.artifacts[0].lastUpdatedAt).toBe(Date.parse("2026-05-01"));
    expect(newer.timestamp).toBe(Date.parse("2026-05-01"));
    expect(newer).not.toEqual(first);
  });

  it("retains the previous timestamp when source dates become invalid", () => {
    const entry = original();
    entry.artifacts[0].lastUpdatedAt = Date.parse("2026-03-01");
    const input = parsed("GLM-5.3-Flash");
    input.repo = { ...input.repo, weightsLastModified: "invalid", createdAt: "invalid", lastModified: "invalid" };
    expect(mergeParsedIntoPayload(entry, input, "creator").artifacts[0].lastUpdatedAt)
      .toBe(entry.artifacts[0].lastUpdatedAt);
  });
});
