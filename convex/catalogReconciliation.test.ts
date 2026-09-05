import { describe, expect, it } from "vitest";
import { modelEntry } from "../test/catalogFixture";
import { publishableEntry } from "../src/lib/atlas/published";
import { classifyHuggingFaceRepo, compactClassification, type MonitoredSourceRule } from "../src/lib/atlas/huggingface";
import { targetForParsed, mergeParsedIntoPayload } from "./catalogReconciliation";
import type { Doc } from "./_generated/dataModel";

const creator: MonitoredSourceRule = { owner: "zai-org", role: "creator", familyIds: ["glm"] };
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
