import { describe, it, expect } from "vitest";
import { architectureFromConfig, mainKvBytes, estimateDeploymentMemory } from "./memory";
const config = {
  num_hidden_layers: 40, num_key_value_heads: 2, head_dim: 256, max_position_embeddings: 262144,
  layer_types: Array.from({ length: 40 }, (_, i) => i % 4 === 3 ? "full_attention" : "linear_attention"),
};
describe("hybrid cache accounting", () => {
  it("uses ten full-attention layers and independent K/V block formats", () => {
    const a = architectureFromConfig(config);
    expect(a?.growingLayers).toBe(10);
    expect(mainKvBytes(a, 262144, 1, "bf16", "bf16")).toBe(5368709120);
    expect(mainKvBytes(a, 262144, 1, "q8_0", "q8_0")).toBe(2852126720);
    expect(mainKvBytes(a, 262144, 2, "q8_0", "q8_0")).toBe(5704253440);
    expect(mainKvBytes(a, 262144, 1, "bf16", "q8_0")).toBe((5368709120 + 2852126720) / 2);
  });
  it("keeps unknown state/workspace separate from a partial subtotal", () => {
    const estimate = estimateDeploymentMemory({ weightBytes: 37801097504,
      architecture: architectureFromConfig(config), contextTokens: 262144, concurrency: 1, k: "q8_0", v: "q8_0", mtp: true });
    expect(estimate.knownSubtotalBytes).toBe(40653224224);
    expect(estimate.totalBytes).toBeNull();
    expect(estimate.components.find((c) => c.key === "recurrent")?.bytes).toBeNull();
  });
  it("does not guess growing layers from a malformed map", () => {
    const a = architectureFromConfig({ ...config, layer_types: ["full_attention"] });
    expect(mainKvBytes(a, 262144, 1, "bf16", "bf16")).toBeNull();
  });
});
