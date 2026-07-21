import { describe, expect, it } from "vitest";
import {
  acceptedWebhookEvent,
  classifyHuggingFaceRepo,
  normalizeHuggingFaceRepo,
  webhookDedupeKey,
  type MonitoredSourceRule,
} from "./huggingface";

const creator: MonitoredSourceRule = {
  owner: "Qwen",
  role: "creator",
  familyIds: ["qwen"],
};

function repo(overrides: Record<string, unknown> = {}) {
  return {
    id: "Qwen/Qwen3-8B",
    author: "Qwen",
    sha: "abc123",
    pipeline_tag: "text-generation",
    tags: ["license:apache-2.0"],
    siblings: [{ rfilename: "model-00001-of-00002.safetensors" }],
    safetensors: { parameters: { BF16: 8_000_000_000 } },
    cardData: { license: "apache-2.0" },
    ...overrides,
  };
}

describe("Hugging Face repository classification", () => {
  it("publishes a structured canonical model", () => {
    const result = classifyHuggingFaceRepo(repo(), creator);
    expect(result.status).toBe("publishable");
    if (result.status !== "publishable") return;
    expect(result.parsed).toMatchObject({
      format: "BF16",
      sizeLabel: "8B",
      paramsB: 8,
      category: "language",
    });
    expect(result.parsed.minVramGb).toBeGreaterThan(0);
  });

  it("links a provider quantization only through structured base_model metadata", () => {
    const provider: MonitoredSourceRule = {
      owner: "nvidia",
      role: "artifact_provider",
      familyIds: [],
    };
    const result = classifyHuggingFaceRepo(
      repo({
        id: "nvidia/Qwen3-8B-NVFP4",
        author: "nvidia",
        tags: ["quantized", "nvfp4"],
        safetensors: undefined,
        cardData: { base_model: "Qwen/Qwen3-8B" },
      }),
      provider,
    );
    expect(result.status).toBe("publishable");
    if (result.status !== "publishable") return;
    expect(result.parsed.format).toBe("NVFP4");
    expect(result.parsed.repo.baseModels).toEqual(["Qwen/Qwen3-8B"]);

    const noLineage = classifyHuggingFaceRepo(
      repo({ id: "nvidia/Qwen3-8B-NVFP4", author: "nvidia", cardData: {} }),
      provider,
    );
    expect(noLineage).toMatchObject({ status: "skipped", reason: expect.stringContaining("base-model") });
  });

  it("rejects adapters and arbitrary uploads", () => {
    expect(classifyHuggingFaceRepo(repo({ id: "Qwen/Qwen3-8B-LoRA" }), creator)).toMatchObject({
      status: "skipped",
      reason: expect.stringContaining("adapter"),
    });
    expect(classifyHuggingFaceRepo(repo({ siblings: [{ rfilename: "README.md" }] }), creator)).toMatchObject({
      status: "skipped",
      reason: expect.stringContaining("weight") ,
    });
  });

  it("imports benchmark evidence only from structured model-index metadata", () => {
    const result = classifyHuggingFaceRepo(
      repo({
        cardData: {
          license: "apache-2.0",
          "model-index": [{ results: [{ dataset: { name: "MMLU-Pro" }, metrics: [{ name: "accuracy", value: 0.72 }] }] }],
        },
      }),
      creator,
    );
    expect(result.status).toBe("publishable");
    if (result.status !== "publishable") return;
    expect(result.parsed.benchmarkRows).toEqual([
      expect.objectContaining({ name: "accuracy", result: "0.72", sourceLabel: "MMLU-Pro" }),
    ]);
  });

  it("compacts oversized manifests while retaining weight-file evidence", () => {
    const siblings = Array.from({ length: 9_000 }, (_, index) => ({ rfilename: `assets/${index}.json` }));
    siblings.push({ rfilename: "weights/model.safetensors" });
    const normalized = normalizeHuggingFaceRepo(repo({ siblings }));
    expect(normalized.files.length).toBeLessThanOrEqual(2_048);
    expect(normalized.files).toContain("weights/model.safetensors");
  });

  it("compacts oversized structured metadata before Convex transport", () => {
    const normalized = normalizeHuggingFaceRepo(repo({
      cardData: {
        license: "apache-2.0",
        oversized: Array.from({ length: 9_000 }, (_, index) => index),
      },
    }));
    expect((normalized.cardData.oversized as number[]).length).toBe(2_048);
  });
});

describe("Hugging Face webhook filtering", () => {
  const payload = {
    event: { scope: "repo.content", action: "update" },
    repo: { id: "stable-42", name: "Qwen/Qwen3-8B", type: "model", headSha: "sha-2" },
    updatedRefs: [{ ref: "refs/heads/main", newSha: "sha-2" }],
  };

  it("accepts model updates to main and produces a stable dedupe key", () => {
    expect(acceptedWebhookEvent(payload)).toMatchObject({
      accepted: true,
      repoId: "stable-42",
      repoName: "Qwen/Qwen3-8B",
    });
    expect(webhookDedupeKey(payload)).toBe("stable-42:repo.content:update:sha-2");
  });

  it("ignores pull-request refs and non-model repositories", () => {
    expect(acceptedWebhookEvent({ ...payload, updatedRefs: [{ ref: "refs/pull/7/head", newSha: "x" }] }).accepted).toBe(false);
    expect(acceptedWebhookEvent({ ...payload, repo: { ...payload.repo, type: "dataset" } }).accepted).toBe(false);
  });

  it("distinguishes config changes on the same repository SHA", () => {
    const configEvent = {
      event: { scope: "repo.config", action: "update" },
      repo: payload.repo,
      updatedConfig: { private: true, gated: false },
    };
    const reordered = {
      ...configEvent,
      updatedConfig: { gated: false, private: true },
    };
    const reverted = {
      ...configEvent,
      updatedConfig: { private: false, gated: false },
    };
    expect(webhookDedupeKey(configEvent)).toBe(webhookDedupeKey(reordered));
    expect(webhookDedupeKey(configEvent)).not.toBe(webhookDedupeKey(reverted));
  });
});
