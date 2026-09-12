import { describe, expect, it } from "vitest";
import {
  artifact,
  modelEntry,
  MINIMAX_H3_ENTRY,
  QWEN_ENTRY,
} from "../../../test/catalogFixture";
import { resolveModelPath } from "./modelPath";

const largerQwen = modelEntry({
  slug: "qwen-qwen3-32b",
  repo: "Qwen/Qwen3-32B",
  paramsB: 32,
  sizeLabel: "32B",
  variants: ["Base", "Instruct"],
  artifacts: [
    artifact("Qwen/Qwen3-32B-Base", "BF16", "Base"),
    artifact("Qwen/Qwen3-32B"),
  ],
});
const entries = [largerQwen, MINIMAX_H3_ENTRY, QWEN_ENTRY];

describe("homepage model path", () => {
  it("starts with a represented family and orders sizes without modifying the catalog", () => {
    const path = resolveModelPath(entries, {})!;
    expect(path.family.id).toBe("qwen");
    expect(path.entry.slug).toBe(QWEN_ENTRY.slug);
    expect(path.sizes.map((entry) => entry.size.paramsB)).toEqual([8, 32]);
    expect(entries[0]).toBe(largerQwen);
  });

  it("resolves stale descendant choices inside the newly selected family", () => {
    const path = resolveModelPath(entries, {
      familyId: "minimax",
      releaseId: "qwen3",
      slug: largerQwen.slug,
      variant: "Base",
      format: "NVFP4",
    })!;
    expect(path.entry.slug).toBe(MINIMAX_H3_ENTRY.slug);
    expect(path.variant).toBe("FL2VA");
    expect(path.format).toBe("");
    expect(path.artifacts.every((item) => item.variant === "FL2VA")).toBe(true);
  });

  it("demonstrates a release with multiple sizes rather than a newer single checkpoint", () => {
    const newer = modelEntry({
      slug: "qwen-new-1b",
      repo: "Qwen/new",
      releaseId: "new",
      paramsB: 1,
    });
    newer.timestamp = Date.parse("2026-09-12");
    const path = resolveModelPath([...entries, newer], {})!;
    expect(path.release.id).toBe("qwen3");
    expect(path.sizes).toHaveLength(2);
    const explicit = resolveModelPath([...entries, newer], {
      releaseId: "new",
    })!;
    expect(explicit.entry).toBe(newer);
  });

  it("keeps formats and artifacts scoped to the selected variant", () => {
    const path = resolveModelPath(entries, {
      familyId: "qwen",
      slug: largerQwen.slug,
      variant: "Base",
    })!;
    expect(path.artifacts.map((item) => item.repo)).toEqual([
      "Qwen/Qwen3-32B-Base",
    ]);
    expect(path.href).toBe("/models/qwen-qwen3-32b?variant=Base");
    const quantized = resolveModelPath(entries, {
      slug: QWEN_ENTRY.slug,
      format: "NVFP4",
    })!;
    expect(quantized.artifacts.map((item) => item.repo)).toEqual([
      "nvidia/Qwen3-8B-NVFP4",
    ]);
  });

  it("supports variants with no published weights without borrowing another variant's artifacts", () => {
    const emptyVariant = modelEntry({
      slug: "empty-variant",
      repo: "test/model",
      variants: ["Base", "Instruct"],
    });
    const path = resolveModelPath([emptyVariant], { variant: "Base" })!;
    expect(path.artifacts).toEqual([]);
    expect(path.formats).toEqual([]);
    expect(path.href).toBe("/models/empty-variant?variant=Base");
  });

  it("recovers after a selected entry disappears in a live refresh", () => {
    const path = resolveModelPath([MINIMAX_H3_ENTRY], {
      familyId: "qwen",
      slug: QWEN_ENTRY.slug,
    })!;
    expect(path.entry).toBe(MINIMAX_H3_ENTRY);
    expect(resolveModelPath([], {})).toBeNull();
  });

  it("encodes variant names in shareable model links", () => {
    const entry = modelEntry({
      slug: "special",
      repo: "test/model",
      variants: ["Chat / Think"],
      artifacts: [artifact("test/model", "BF16", "Chat / Think")],
    });
    expect(resolveModelPath([entry], {})!.href).toBe(
      "/models/special?variant=Chat%20%2F%20Think",
    );
  });
});
