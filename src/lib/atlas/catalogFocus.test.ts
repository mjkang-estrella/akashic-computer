import { expect, it } from "vitest";
import { isFocusedModel } from "./catalogFocus";

it("keeps language and media models regardless of size", () => {
  for (const category of ["language", "vision-documents", "image-generation", "audio-speech", "video-generation", "world-models"] as const) {
    expect(isFocusedModel("Useful 4B", category)).toBe(true);
  }
});
it("excludes narrow specialist systems", () => {
  for (const name of ["nvidia/Nemotron-Labs-Dory1.0-4B", "Qwen3-Embedding-4B", "Qwen3-Reranker-4B", "model-reward-8B", "model-speculator"]) {
    expect(isFocusedModel(name, "language")).toBe(false);
  }
  expect(isFocusedModel("GR00T", "robotics")).toBe(false);
  expect(isFocusedModel("Embedding", "retrieval")).toBe(false);
});
