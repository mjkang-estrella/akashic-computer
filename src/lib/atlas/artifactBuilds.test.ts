import { describe, it, expect } from "vitest";
import { buildsFromFiles, filesFromTree } from "./artifactBuilds";
const revision = "5bc3e238d916f48a861bac2f8a1990a0e9b7e98d";
const repo = "unsloth/Qwen3.6-35B-A3B-MTP-GGUF";
describe("exact artifact manifests", () => {
  it("keeps Q6 variants and Q8 separate without requiring file dates", () => {
    const files = filesFromTree([
      { path: "Qwen3.6-35B-A3B-Q8_0.gguf", size: 37801097504, oid: "git-blob", lfs: { oid: "c1283d8b80c3e38b2735ddbc9766d3b3126f44d6c484be419d4e101d09a76131" } },
      { path: "Qwen3.6-35B-A3B-UD-Q6_K.gguf", size: 30011242784 },
      { path: "Qwen3.6-35B-A3B-UD-Q6_K_XL.gguf", size: 32611711264 },
    ]);
    const builds = buildsFromFiles(repo, revision, files, ["Qwen/Qwen3.6-35B-A3B"]);
    expect(new Set(builds.map((b) => b.key)).size).toBe(3);
    expect(builds.map((b) => b.bytes).sort()).toEqual([30011242784, 32611711264, 37801097504]);
    expect(builds.map((b) => b.quantization).sort()).toEqual(["Q8_0", "UD-Q6_K", "UD-Q6_K_XL"]);
    expect(builds[0].mtp).toBe("unknown");
    expect(files[0].sha256).toHaveLength(64);
    expect(buildsFromFiles(repo, "main", files, [])).toEqual([]);
  });
  it("does not mistake Git IDs for checksums or partial shard sets for complete downloads", () => {
    const files = filesFromTree([{ path: "Q8_0-00001-of-00002.gguf", size: 10, oid: "a".repeat(40) }]);
    expect(files[0].sha256).toBeUndefined();
    const build = buildsFromFiles(repo, revision, files, [])[0];
    expect(build.complete).toBe(false);
    expect(build.bytes).toBeNull();
    expect(buildsFromFiles(repo, revision, [...files, { path: "Q8_0-00002-of-00002.gguf", bytes: 12 }], [])[0].bytes).toBe(22);
  });
  it("separates two shardings of one file name instead of failing the repository", () => {
    const files = [
      { path: "transformer/model-00001-of-00002.safetensors", bytes: 10 },
      { path: "transformer/model-00002-of-00002.safetensors", bytes: 10 },
      { path: "transformer/model-00001-of-00003.safetensors", bytes: 5 },
      { path: "transformer/model-00002-of-00003.safetensors", bytes: 5 },
      { path: "transformer/model-00003-of-00003.safetensors", bytes: 5 },
      { path: "vae/model.safetensors", bytes: 3 },
    ];
    const builds = buildsFromFiles("Lightricks/LTX", revision, files, [], { format: "BF16" });
    expect(builds.map((b) => [b.label, b.complete, b.bytes]).sort()).toEqual([
      ["transformer/model-of-00002.safetensors", true, 20],
      ["transformer/model-of-00003.safetensors", true, 15],
      ["vae/model.safetensors", true, 3],
    ]);
  });
  it("keeps existing labels when a shard count is unambiguous", () => {
    const builds = buildsFromFiles(repo, revision, [
      { path: "BF16/model-00001-of-00002.safetensors", bytes: 1 },
      { path: "BF16/model-00002-of-00002.safetensors", bytes: 1 },
    ], []);
    expect(builds.map((b) => b.label)).toEqual(["BF16/model.safetensors"]);
  });
  it("omits an oversized build whole and reports it, keeping the repository's other builds", () => {
    const shards = Array.from({ length: 282 }, (_, index) => ({
      path: `BF16/GLM-BF16-${String(index + 1).padStart(5, "0")}-of-00282.gguf`, bytes: 1,
    }));
    const omitted: string[] = [];
    const builds = buildsFromFiles(repo, revision, [...shards, { path: "GLM-Q4_K_M.gguf", bytes: 4 }], [], {
      onOmit: ({ label, reason }) => omitted.push(`${label}: ${reason}`),
    });
    expect(builds.map((b) => b.quantization)).toEqual(["Q4_K_M"]);
    expect(omitted).toEqual(["BF16/GLM-BF16.gguf: Build exceeds 256 shards"]);
  });
});
