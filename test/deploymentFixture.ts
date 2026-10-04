import { buildsFromFiles } from "../src/lib/atlas/artifactBuilds";
import { architectureFromConfig } from "../src/lib/atlas/memory";
import { defaultDeployment, computerTemplates } from "../src/lib/atlas/deployments";
import type { EvidenceReport } from "../src/lib/atlas/evidence";
import { QWEN_ENTRY } from "./catalogFixture";
export const fixtureBuild = buildsFromFiles(QWEN_ENTRY.artifacts[0].repo, "a".repeat(40),
  [{ path: "model-Q8_0.gguf", bytes: 37801097504, sha256: "b".repeat(64) }], [], {
    architecture: architectureFromConfig({ num_hidden_layers: 40, num_key_value_heads: 2, head_dim: 256,
      max_position_embeddings: 262144,
      layer_types: Array.from({ length: 40 }, (_, i) => i % 4 === 3 ? "full_attention" : "linear_attention") }),
  })[0];
export const fixtureDeployment = defaultDeployment(fixtureBuild.key, QWEN_ENTRY.slug, fixtureBuild.repo, "Synthetic deployment");
fixtureDeployment.computer = computerTemplates.framework;
fixtureDeployment.runtime = { name: "llama.cpp", version: "b11146", backend: "vulkan", platform: "linux-x64" };
export const fixtureReport: EvidenceReport = {
  schemaVersion: 2, id: "synthetic-performance", kind: "performance",
  modelSlug: QWEN_ENTRY.slug, artifactRepo: fixtureBuild.repo, buildKey: fixtureBuild.key,
  source: { label: "Synthetic test", origin: "local_import", limitations: ["Not a real device observation."] },
  protocol: { id: "synthetic", promptSetHash: "synthetic-cases", tool: "fixture", toolVersion: "1",
    cache: "disabled", aggregation: "median-across-prompts", repeatsPerPrompt: 1 },
  deployment: fixtureDeployment,
  trials: [{ caseId: "one", promptTokens: 41, generatedTokens: 512, decodeTps: 53.15867051725467, finishReason: "length" }],
};
