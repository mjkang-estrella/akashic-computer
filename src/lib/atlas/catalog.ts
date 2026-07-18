import { unknownDeltas, zeroDeltas } from "./fit";
import type { Artifact, Family, SizeNode } from "./types";

type RepoSpec = {
  repo: string;
  format?: string;
  trust?: Artifact["trust"];
  kinds?: Artifact["kinds"];
  runtimes?: string[];
  minVramGb?: number;
  recVramGb?: number;
};

function formatProfile(format: string) {
  if (format === "GGUF") {
    return {
      factor: 0.66,
      kinds: ["mac", "cpu", "cuda"] as Artifact["kinds"],
      runtimes: ["llama.cpp", "Ollama", "LM Studio"],
    };
  }
  if (format === "NVFP4") {
    return {
      factor: 0.62,
      kinds: ["cuda", "dgx"] as Artifact["kinds"],
      runtimes: ["TensorRT-LLM", "vLLM"],
    };
  }
  if (format.includes("FP4")) {
    return {
      factor: 0.62,
      kinds: ["cuda", "dgx"] as Artifact["kinds"],
      runtimes: ["vLLM", "SGLang"],
    };
  }
  if (format.includes("INT4") || format === "AWQ") {
    return {
      factor: 0.62,
      kinds: ["cuda", "dgx"] as Artifact["kinds"],
      runtimes: ["vLLM", "SGLang"],
    };
  }
  if (format === "BNB 4-bit") {
    return {
      factor: 0.62,
      kinds: ["cuda", "dgx"] as Artifact["kinds"],
      runtimes: ["Transformers"],
    };
  }
  if (format.includes("FP8")) {
    return {
      factor: 1.1,
      kinds: ["cuda", "dgx"] as Artifact["kinds"],
      runtimes: ["vLLM", "SGLang", "TensorRT-LLM"],
    };
  }
  return {
    factor: 2.2,
    kinds: ["cuda", "dgx"] as Artifact["kinds"],
    runtimes: ["vLLM", "SGLang", "Transformers"],
  };
}

function artifactsForSpecs(paramsB: number, specs: RepoSpec[]): Artifact[] {
  return specs.map((spec, index) => {
    const format = spec.format ?? "BF16";
    const profile = formatProfile(format);
    const minVramGb = spec.minVramGb ?? Math.max(2, Math.round(paramsB * profile.factor));
    return {
      repo: spec.repo,
      format,
      trust: spec.trust ?? "official",
      confidence: "verified",
      kinds: spec.kinds ?? profile.kinds,
      runtimes: spec.runtimes ?? profile.runtimes,
      minVramGb,
      recVramGb: spec.recVramGb ?? Math.max(3, Math.round(minVramGb * 1.15)),
      deltas: index === 0 ? zeroDeltas() : unknownDeltas(),
      measured: index === 0,
      qualityRank: index,
    };
  });
}

function officialSize(
  label: string,
  paramsB: number,
  variants: Record<string, RepoSpec[]>,
  metadata: Omit<Partial<SizeNode>, "label" | "paramsB" | "variants" | "curatedArtifacts"> = {},
): SizeNode {
  return {
    label,
    paramsB,
    variants: Object.keys(variants),
    curatedArtifacts: Object.fromEntries(
      Object.entries(variants).map(([variant, specs]) => [
        variant,
        artifactsForSpecs(paramsB, specs),
      ]),
    ),
    ...metadata,
  };
}

function deepseekR1DistillSize(
  label: string,
  paramsB: number,
  foundation: "Qwen" | "Qwen3" | "Llama",
): SizeNode {
  const model =
    foundation === "Qwen3"
      ? "DeepSeek-R1-0528-Qwen3-8B"
      : `DeepSeek-R1-Distill-${foundation}-${label}`;

  return officialSize(label, paramsB, {
    [foundation]: [
      { repo: `deepseek-ai/${model}` },
      {
        repo: `unsloth/${model}-bnb-4bit`,
        format: "BNB 4-bit",
        trust: "vendor",
      },
      {
        repo: `unsloth/${model}-GGUF`,
        format: "GGUF",
        trust: "vendor",
      },
    ],
  });
}

function qwen25Size(label: string, paramsB: number, coder = false): SizeNode {
  const family = coder ? "Qwen2.5-Coder" : "Qwen2.5";
  const model = `${family}-${label}`;
  return officialSize(label, paramsB, {
    Instruct: [
      { repo: `Qwen/${model}-Instruct` },
      { repo: `Qwen/${model}-Instruct-AWQ`, format: "AWQ" },
      { repo: `Qwen/${model}-Instruct-GPTQ-Int4`, format: "GPTQ INT4" },
      { repo: `Qwen/${model}-Instruct-GGUF`, format: "GGUF" },
    ],
    Base: [{ repo: `Qwen/${model}` }],
  });
}

function qwen35Size(
  label: string,
  paramsB: number,
  quantized = false,
  hasBase = true,
): SizeNode {
  const model = `Qwen3.5-${label}`;
  const nvidiaNvfp4 =
    label === "122B-A10B" || label === "397B-A17B"
      ? [
          {
            repo: `nvidia/${model}-NVFP4`,
            format: "NVFP4",
            trust: "vendor" as const,
          },
        ]
      : [];
  return officialSize(label, paramsB, {
    Instruct: [
      { repo: `Qwen/${model}` },
      ...(quantized
        ? [
            { repo: `Qwen/${model}-FP8`, format: "FP8" },
            { repo: `Qwen/${model}-GPTQ-Int4`, format: "GPTQ INT4" },
          ]
        : []),
      ...nvidiaNvfp4,
    ],
    ...(hasBase ? { Base: [{ repo: `Qwen/${model}-Base` }] } : {}),
  });
}

export const FAMILIES: Family[] = [
  {
    id: "qwen",
    name: "Qwen",
    vendor: "Alibaba",
    tags: "reasoning, coding, long context",
    releases: [
      {
        id: "q36",
        name: "Qwen 3.6",
        date: "Apr 2026",
        ctx: "262K",
        license: "Apache-2.0",
        sizes: [
          officialSize("27B", 27, {
            Instruct: [
              { repo: "Qwen/Qwen3.6-27B" },
              { repo: "Qwen/Qwen3.6-27B-FP8", format: "FP8" },
              {
                repo: "nvidia/Qwen3.6-27B-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
          officialSize("35B-A3B", 35, {
            Instruct: [
              { repo: "Qwen/Qwen3.6-35B-A3B" },
              { repo: "Qwen/Qwen3.6-35B-A3B-FP8", format: "FP8" },
              {
                repo: "nvidia/Qwen3.6-35B-A3B-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "q35",
        name: "Qwen 3.5",
        date: "2026",
        ctx: "262K",
        license: "Apache-2.0",
        sizes: [
          qwen35Size("0.8B", 0.8),
          qwen35Size("2B", 2),
          qwen35Size("4B", 4),
          qwen35Size("9B", 9),
          qwen35Size("27B", 27, true, false),
          qwen35Size("35B-A3B", 35, true),
          qwen35Size("122B-A10B", 122, true, false),
          qwen35Size("397B-A17B", 397, true, false),
        ],
      },
      {
        id: "q3-coder",
        name: "Qwen 3 Coder",
        date: "2025–2026",
        ctx: "262K",
        license: "Apache-2.0",
        sizes: [
          officialSize("30B-A3B", 30, {
            Instruct: [
              { repo: "Qwen/Qwen3-Coder-30B-A3B-Instruct" },
              { repo: "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8", format: "FP8" },
            ],
          }),
          officialSize("480B-A35B", 480, {
            Instruct: [
              { repo: "Qwen/Qwen3-Coder-480B-A35B-Instruct" },
              { repo: "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8", format: "FP8" },
              {
                repo: "nvidia/Qwen3-Coder-480B-A35B-Instruct-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
          officialSize("Next", 80, {
            Instruct: [
              { repo: "Qwen/Qwen3-Coder-Next" },
              { repo: "Qwen/Qwen3-Coder-Next-FP8", format: "FP8" },
              { repo: "Qwen/Qwen3-Coder-Next-GGUF", format: "GGUF" },
              {
                repo: "nvidia/Qwen3-Next-80B-A3B-Instruct-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
            Base: [{ repo: "Qwen/Qwen3-Coder-Next-Base" }],
          }),
        ],
      },
      {
        id: "q3",
        name: "Qwen 3",
        date: "Apr 2025",
        ctx: "32K",
        license: "Apache-2.0",
        sizes: [
          { label: "0.6B", paramsB: 0.6, variants: ["Instruct", "Base"] },
          { label: "1.7B", paramsB: 1.7, variants: ["Instruct", "Base"] },
          { label: "4B", paramsB: 4, variants: ["Instruct", "Base"] },
          { label: "8B", paramsB: 8, variants: ["Instruct", "Base"] },
          { label: "14B", paramsB: 14, variants: ["Instruct", "Base"] },
          { label: "30B-A3B", paramsB: 30, variants: ["Instruct", "Base"] },
          { label: "32B", paramsB: 32, variants: ["Instruct"] },
          { label: "235B-A22B", paramsB: 235, variants: ["Instruct"] },
        ],
      },
      {
        id: "q3-embedding",
        name: "Qwen 3 Embedding",
        date: "Jun 2025",
        ctx: "32K",
        license: "Apache-2.0",
        category: "retrieval",
        capabilities: ["embedding", "multilingual"],
        sizes: [
          officialSize(
            "8B",
            8,
            {
              Embedding: [
                {
                  repo: "Qwen/Qwen3-Embedding-8B",
                  runtimes: ["Sentence Transformers", "TEI", "Transformers"],
                  minVramGb: 18,
                  recVramGb: 22,
                },
              ],
            },
            {
              updated: "2025-07-07",
              benchmarkRefs: [
                {
                  name: "MTEB Multilingual",
                  result: "#1 at release · 70.58 mean task score",
                  sourceLabel: "MTEB / Qwen model card",
                  sourceUrl: "https://huggingface.co/Qwen/Qwen3-Embedding-8B#highlights",
                  measuredAt: "2025-06-05",
                },
              ],
            },
          ),
        ],
      },
      {
        id: "q3-reranker",
        name: "Qwen 3 Reranker",
        date: "Jun 2025",
        ctx: "32K",
        license: "Apache-2.0",
        category: "retrieval",
        capabilities: ["reranking", "multilingual"],
        sizes: [
          officialSize(
            "8B",
            8,
            {
              Reranker: [
                {
                  repo: "Qwen/Qwen3-Reranker-8B",
                  runtimes: ["vLLM", "Transformers"],
                  minVramGb: 18,
                  recVramGb: 22,
                },
              ],
            },
            {
              updated: "2026-04-16",
              benchmarkRefs: [
                {
                  name: "MTEB-R",
                  result: "69.02 reranking score",
                  sourceLabel: "Qwen evaluation",
                  sourceUrl: "https://huggingface.co/Qwen/Qwen3-Reranker-8B#evaluation",
                  measuredAt: "2025-06-05",
                },
              ],
            },
          ),
        ],
      },
      {
        id: "q25-coder",
        name: "Qwen 2.5 Coder",
        date: "2024",
        ctx: "128K",
        license: "Apache-2.0",
        sizes: [
          qwen25Size("0.5B", 0.5, true),
          qwen25Size("1.5B", 1.5, true),
          qwen25Size("3B", 3, true),
          qwen25Size("7B", 7, true),
          qwen25Size("14B", 14, true),
          qwen25Size("32B", 32, true),
        ],
      },
      {
        id: "q25",
        name: "Qwen 2.5",
        date: "2024",
        ctx: "128K",
        license: "Apache-2.0",
        sizes: [
          qwen25Size("0.5B", 0.5),
          qwen25Size("1.5B", 1.5),
          qwen25Size("3B", 3),
          qwen25Size("7B", 7),
          qwen25Size("14B", 14),
          qwen25Size("32B", 32),
          qwen25Size("72B", 72),
        ],
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    vendor: "DeepSeek AI",
    tags: "reasoning, code, mixture of experts",
    releases: [
      {
        id: "v4",
        name: "DeepSeek V4",
        date: "2026",
        ctx: "1M",
        license: "MIT",
        sizes: [
          officialSize("Flash 158B", 158, {
            Instruct: [
              { repo: "deepseek-ai/DeepSeek-V4-Flash" },
              {
                repo: "nvidia/DeepSeek-V4-Flash-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
            Base: [{ repo: "deepseek-ai/DeepSeek-V4-Flash-Base" }],
          }),
          officialSize("Pro 862B", 862, {
            Instruct: [
              { repo: "deepseek-ai/DeepSeek-V4-Pro" },
              {
                repo: "nvidia/DeepSeek-V4-Pro-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
            Base: [{ repo: "deepseek-ai/DeepSeek-V4-Pro-Base" }],
          }),
        ],
      },
      {
        id: "v32",
        name: "DeepSeek V3.2",
        date: "Dec 2025",
        ctx: "128K",
        license: "MIT",
        sizes: [
          officialSize("671B-A37B", 671, {
            Instruct: [
              { repo: "deepseek-ai/DeepSeek-V3.2" },
              {
                repo: "nvidia/DeepSeek-V3.2-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
            Speciale: [{ repo: "deepseek-ai/DeepSeek-V3.2-Speciale" }],
          }),
        ],
      },
      {
        id: "v31",
        name: "DeepSeek V3.1",
        date: "Aug 2025",
        ctx: "128K",
        license: "MIT",
        sizes: [
          officialSize("671B-A37B", 671, {
            Instruct: [
              { repo: "deepseek-ai/DeepSeek-V3.1" },
              {
                repo: "nvidia/DeepSeek-V3.1-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "v3-0324",
        name: "DeepSeek V3 0324",
        date: "Mar 2025",
        ctx: "128K",
        license: "MIT",
        sizes: [
          officialSize("671B-A37B", 671, {
            Instruct: [
              { repo: "deepseek-ai/DeepSeek-V3-0324" },
              {
                repo: "nvidia/DeepSeek-V3-0324-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "r1",
        name: "DeepSeek R1",
        date: "Jan 2025",
        ctx: "128K",
        license: "MIT",
        sizes: [
          officialSize("671B-A37B", 671, {
            Reasoner: [
              { repo: "deepseek-ai/DeepSeek-R1", format: "FP8 (native)" },
              { repo: "deepseek-ai/DeepSeek-R1-0528", format: "FP8 (native)" },
              {
                repo: "nvidia/DeepSeek-R1-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
              {
                repo: "nvidia/DeepSeek-R1-0528-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
            Zero: [{ repo: "deepseek-ai/DeepSeek-R1-Zero", format: "FP8 (native)" }],
          }),
        ],
      },
      {
        id: "r1-distill",
        name: "DeepSeek R1 Distill",
        date: "Jan 2025",
        ctx: "128K",
        license: "MIT",
        sizes: [
          deepseekR1DistillSize("1.5B", 1.5, "Qwen"),
          deepseekR1DistillSize("7B", 7, "Qwen"),
          {
            ...deepseekR1DistillSize("8B", 8, "Llama"),
            variants: ["Llama", "Qwen3"],
            curatedArtifacts: {
              ...deepseekR1DistillSize("8B", 8, "Llama").curatedArtifacts,
              ...deepseekR1DistillSize("8B", 8, "Qwen3").curatedArtifacts,
            },
          },
          deepseekR1DistillSize("14B", 14, "Qwen"),
          deepseekR1DistillSize("32B", 32, "Qwen"),
          deepseekR1DistillSize("70B", 70, "Llama"),
        ],
      },
      {
        id: "coder-v2",
        name: "DeepSeek Coder V2",
        date: "2024",
        ctx: "128K",
        license: "DeepSeek License",
        sizes: [
          officialSize("Lite 16B-A2.4B", 16, {
            Instruct: [{ repo: "deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct" }],
            Base: [{ repo: "deepseek-ai/DeepSeek-Coder-V2-Lite-Base" }],
          }),
          officialSize("236B-A21B", 236, {
            Instruct: [{ repo: "deepseek-ai/DeepSeek-Coder-V2-Instruct-0724" }],
            Base: [{ repo: "deepseek-ai/DeepSeek-Coder-V2-Base" }],
          }),
        ],
      },
    ],
  },
  {
    id: "llama",
    name: "Llama",
    vendor: "Meta",
    tags: "general foundation models",
    releases: [
      {
        id: "l4",
        name: "Llama 4",
        date: "Apr 2025",
        ctx: "1M",
        license: "Llama Community",
        sizes: [
          officialSize("Scout 109B-A17B", 109, {
            Instruct: [
              { repo: "meta-llama/Llama-4-Scout-17B-16E-Instruct" },
              {
                repo: "nvidia/Llama-4-Scout-17B-16E-Instruct-FP8",
                format: "FP8",
                trust: "vendor",
              },
              {
                repo: "nvidia/Llama-4-Scout-17B-16E-Instruct-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
            Base: [{ repo: "meta-llama/Llama-4-Scout-17B-16E" }],
          }),
          officialSize("Maverick 402B-A17B", 402, {
            Instruct: [
              { repo: "meta-llama/Llama-4-Maverick-17B-128E-Instruct" },
              { repo: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", format: "FP8" },
              {
                repo: "nvidia/Llama-4-Maverick-17B-128E-Instruct-FP8",
                format: "FP8",
                trust: "vendor",
              },
            ],
            Base: [{ repo: "meta-llama/Llama-4-Maverick-17B-128E" }],
          }),
        ],
      },
      {
        id: "l33",
        name: "Llama 3.3",
        date: "Dec 2024",
        ctx: "128K",
        license: "Llama Community",
        sizes: [
          officialSize("70B", 70, {
            Instruct: [
              { repo: "meta-llama/Llama-3.3-70B-Instruct" },
              {
                repo: "nvidia/Llama-3.3-70B-Instruct-FP8",
                format: "FP8",
                trust: "vendor",
              },
              {
                repo: "nvidia/Llama-3.3-70B-Instruct-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "l32",
        name: "Llama 3.2",
        date: "Sep 2024",
        ctx: "128K",
        license: "Llama Community",
        sizes: [1, 3].map((paramsB) =>
          officialSize(`${paramsB}B`, paramsB, {
            Instruct: [
              { repo: `meta-llama/Llama-3.2-${paramsB}B-Instruct` },
              { repo: `meta-llama/Llama-3.2-${paramsB}B-Instruct-SpinQuant_INT4_EO8`, format: "SpinQuant INT4" },
            ],
            Base: [{ repo: `meta-llama/Llama-3.2-${paramsB}B` }],
          }),
        ),
      },
      {
        id: "l31",
        name: "Llama 3.1",
        date: "Jul 2024",
        ctx: "128K",
        license: "Llama Community",
        sizes: [8, 70, 405].map((paramsB) =>
          officialSize(`${paramsB}B`, paramsB, {
            Instruct: [
              { repo: `meta-llama/Llama-3.1-${paramsB}B-Instruct` },
              {
                repo: `nvidia/Llama-3.1-${paramsB}B-Instruct-FP8`,
                format: "FP8",
                trust: "vendor",
              },
              ...(paramsB === 8 || paramsB === 405
                ? [
                    {
                      repo: `nvidia/Llama-3.1-${paramsB}B-Instruct-NVFP4`,
                      format: "NVFP4",
                      trust: "vendor" as const,
                    },
                  ]
                : []),
            ],
            Base: [{ repo: `meta-llama/Llama-3.1-${paramsB}B` }],
          }),
        ),
      },
    ],
  },
  {
    id: "gemma",
    name: "Gemma",
    vendor: "Google",
    tags: "efficient multimodal models",
    releases: [
      {
        id: "g4",
        name: "Gemma 4",
        date: "2026",
        ctx: "Varies",
        license: "Gemma Terms",
        sizes: [
          ["E2B", 5.1],
          ["E4B", 8],
          ["12B", 12],
          ["26B-A4B", 26],
          ["31B", 31],
        ].map(([label, paramsB]) => {
          const size = officialSize(String(label), Number(paramsB), {
            IT: [
              { repo: `google/gemma-4-${label}-it` },
              ...(label === "26B-A4B"
                ? [
                    {
                      repo: "nvidia/Gemma-4-26B-A4B-NVFP4",
                      format: "NVFP4",
                      trust: "vendor" as const,
                    },
                  ]
                : label === "31B"
                  ? [
                      {
                        repo: "nvidia/Gemma-4-31B-IT-NVFP4",
                        format: "NVFP4",
                        trust: "vendor" as const,
                      },
                    ]
                  : []),
            ],
            PT: [{ repo: `google/gemma-4-${label}` }],
          });
          const context = label === "E2B" || label === "E4B" ? "128K" : "256K";
          return label === "31B"
            ? {
                ...size,
                context,
                updated: "Jul 15 2026",
                benchmarkRefs: [
                  {
                    name: "MMMU-Pro",
                    result: "73% · leading open sub-32B vision model tier",
                    sourceLabel: "Artificial Analysis",
                    sourceUrl: "https://artificialanalysis.ai/articles/sub-32b-open-weights",
                    measuredAt: "2026-07-18",
                  },
                ],
              }
            : { ...size, context };
        }),
      },
      {
        id: "g3",
        name: "Gemma 3",
        date: "Mar 2025",
        ctx: "128K",
        license: "Gemma Terms",
        sizes: [1, 4, 12, 27].map((paramsB) =>
          officialSize(`${paramsB}B`, paramsB, {
            IT: [{ repo: `google/gemma-3-${paramsB}b-it` }],
            PT: [{ repo: `google/gemma-3-${paramsB}b-pt` }],
          }),
        ),
      },
      {
        id: "g3n",
        name: "Gemma 3n",
        date: "2025",
        ctx: "32K",
        license: "Gemma Terms",
        sizes: [2, 4].map((paramsB) =>
          officialSize(`E${paramsB}B`, paramsB, {
            IT: [{ repo: `google/gemma-3n-E${paramsB}B-it` }],
            PT: [{ repo: `google/gemma-3n-E${paramsB}B` }],
          }),
        ),
      },
      {
        id: "codegemma",
        name: "CodeGemma",
        date: "2024",
        ctx: "8K",
        license: "Gemma Terms",
        sizes: [
          officialSize("2B", 2, { PT: [{ repo: "google/codegemma-1.1-2b" }] }),
          officialSize("7B", 7, {
            IT: [
              { repo: "google/codegemma-1.1-7b-it" },
              { repo: "google/codegemma-1.1-7b-it-GGUF", format: "GGUF" },
            ],
          }),
        ],
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    vendor: "Mistral AI",
    tags: "general, reasoning, coding",
    releases: [
      { id: "small4", name: "Mistral Small 4", date: "Mar 2026", ctx: "256K", license: "Apache-2.0", sizes: [officialSize("119B", 119, { Instruct: [{ repo: "mistralai/Mistral-Small-4-119B-2603" }, { repo: "mistralai/Mistral-Small-4-119B-2603-NVFP4", format: "NVFP4" }] })] },
      { id: "medium35", name: "Mistral Medium 3.5", date: "2026", ctx: "128K", license: "Apache-2.0", sizes: [officialSize("128B", 128, { Instruct: [{ repo: "mistralai/Mistral-Medium-3.5-128B" }, { repo: "nvidia/Mistral-Medium-3.5-128B-NVFP4", format: "NVFP4", trust: "vendor" }] })] },
      { id: "large3", name: "Mistral Large 3", date: "Dec 2025", ctx: "256K", license: "Apache-2.0", sizes: [officialSize("675B", 675, { Instruct: [{ repo: "mistralai/Mistral-Large-3-675B-Instruct-2512" }, { repo: "mistralai/Mistral-Large-3-675B-Instruct-2512-NVFP4", format: "NVFP4" }] })] },
      {
        id: "ministral3",
        name: "Ministral 3",
        date: "Dec 2025",
        ctx: "256K",
        license: "Apache-2.0",
        sizes: [3, 8, 14].map((paramsB) =>
          officialSize(`${paramsB}B`, paramsB, {
            Instruct: [
              { repo: `mistralai/Ministral-3-${paramsB}B-Instruct-2512` },
              { repo: `mistralai/Ministral-3-${paramsB}B-Instruct-2512-GGUF`, format: "GGUF" },
            ],
            Reasoning: [
              { repo: `mistralai/Ministral-3-${paramsB}B-Reasoning-2512` },
              { repo: `mistralai/Ministral-3-${paramsB}B-Reasoning-2512-GGUF`, format: "GGUF" },
            ],
          }),
        ),
      },
      {
        id: "devstral2",
        name: "Devstral 2",
        date: "Dec 2025",
        ctx: "256K",
        license: "Apache-2.0",
        sizes: [
          officialSize("Small 24B", 24, { Instruct: [{ repo: "mistralai/Devstral-Small-2-24B-Instruct-2512" }] }),
          officialSize("123B", 123, { Instruct: [{ repo: "mistralai/Devstral-2-123B-Instruct-2512" }] }),
        ],
      },
      { id: "small32", name: "Mistral Small 3.2", date: "Jun 2025", ctx: "128K", license: "Apache-2.0", sizes: [officialSize("24B", 24, { Instruct: [{ repo: "mistralai/Mistral-Small-3.2-24B-Instruct-2506" }] })] },
      { id: "small31", name: "Mistral Small 3.1", date: "Mar 2025", ctx: "128K", license: "Apache-2.0", sizes: [officialSize("24B", 24, { Instruct: [{ repo: "mistralai/Mistral-Small-3.1-24B-Instruct-2503" }] })] },
      {
        id: "codestral",
        name: "Codestral",
        date: "2024",
        ctx: "32K",
        license: "MNPL",
        sizes: [
          officialSize("22B", 22, { Instruct: [{ repo: "mistralai/Codestral-22B-v0.1" }] }),
          officialSize("Mamba 7B", 7, { Instruct: [{ repo: "mistralai/Mamba-Codestral-7B-v0.1" }] }),
        ],
      },
    ],
  },
  {
    id: "gpt-oss",
    name: "GPT-OSS",
    vendor: "OpenAI",
    tags: "reasoning, agentic, mixture of experts",
    releases: [
      {
        id: "gpt-oss",
        name: "GPT-OSS",
        date: "Aug 2025",
        ctx: "128K",
        license: "Apache-2.0",
        sizes: [
          officialSize("20B", 20, { Instruct: [{ repo: "openai/gpt-oss-20b" }] }),
          officialSize("120B", 120, { Instruct: [{ repo: "openai/gpt-oss-120b" }] }),
        ],
      },
    ],
  },
  {
    id: "phi",
    name: "Phi",
    vendor: "Microsoft",
    tags: "small language, reasoning, multimodal",
    releases: [
      {
        id: "phi4",
        name: "Phi 4",
        date: "2024–2026",
        ctx: "128K",
        license: "MIT",
        sizes: [
          officialSize("Mini 4B", 4, {
            Instruct: [{ repo: "microsoft/Phi-4-mini-instruct" }],
            Reasoning: [{ repo: "microsoft/Phi-4-mini-reasoning" }],
            Flash: [{ repo: "microsoft/Phi-4-mini-flash-reasoning" }],
          }),
          officialSize("14B", 14, {
            Instruct: [
              { repo: "microsoft/phi-4" },
              { repo: "microsoft/phi-4-gguf", format: "GGUF" },
            ],
          }),
          officialSize("Reasoning 15B", 15, {
            Reasoning: [{ repo: "microsoft/Phi-4-reasoning" }],
            Plus: [
              { repo: "microsoft/Phi-4-reasoning-plus" },
              {
                repo: "nvidia/Phi-4-reasoning-plus-FP8",
                format: "FP8",
                trust: "vendor",
              },
              {
                repo: "nvidia/Phi-4-reasoning-plus-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
          officialSize("Multimodal 6B", 6, {
            Instruct: [
              { repo: "microsoft/Phi-4-multimodal-instruct" },
              {
                repo: "nvidia/Phi-4-multimodal-instruct-FP8",
                format: "FP8",
                trust: "vendor",
              },
              {
                repo: "nvidia/Phi-4-multimodal-instruct-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
    ],
  },
  {
    id: "nemotron",
    name: "Nemotron",
    vendor: "NVIDIA",
    tags: "reasoning, agentic, inference optimized",
    releases: [
      {
        id: "n3-puzzle",
        name: "Nemotron Labs 3 Puzzle",
        date: "Jul 6 2026",
        ctx: "1M",
        license: "NVIDIA Open Model",
        sizes: [
          {
            ...officialSize("75B-A9B", 75, {
              Reasoning: [
                { repo: "nvidia/NVIDIA-Nemotron-Labs-3-Puzzle-75B-A9B-BF16" },
                {
                  repo: "nvidia/NVIDIA-Nemotron-Labs-3-Puzzle-75B-A9B-FP8",
                  format: "FP8",
                },
                {
                  repo: "nvidia/NVIDIA-Nemotron-Labs-3-Puzzle-75B-A9B-NVFP4",
                  format: "NVFP4",
                },
              ],
            }),
            updated: "Jul 7 2026",
          },
        ],
      },
      {
        id: "n3",
        name: "Nemotron 3",
        date: "2025–2026",
        ctx: "1M",
        license: "NVIDIA Open Model",
        sizes: [
          officialSize("Nano 4B", 4, {
            Instruct: [
              { repo: "nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16" },
              { repo: "nvidia/NVIDIA-Nemotron-3-Nano-4B-FP8", format: "FP8" },
              { repo: "nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF", format: "GGUF" },
            ],
          }),
          officialSize("Nano 30B-A3B", 30, {
            Instruct: [
              { repo: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16" },
              { repo: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8", format: "FP8" },
              { repo: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4", format: "NVFP4" },
            ],
          }),
          officialSize("Super 120B-A12B", 120, {
            Instruct: [
              { repo: "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16" },
              { repo: "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-FP8", format: "FP8" },
              { repo: "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4", format: "NVFP4" },
            ],
          }),
          officialSize("Ultra 550B-A55B", 550, {
            Instruct: [
              { repo: "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16" },
              { repo: "nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-NVFP4", format: "NVFP4" },
            ],
          }),
        ],
      },
    ],
  },
  {
    id: "glm",
    name: "GLM",
    vendor: "Z.ai",
    tags: "agentic, coding, long context",
    releases: [
      {
        id: "glm52",
        name: "GLM 5.2",
        date: "Jun 2026",
        ctx: "1M",
        license: "MIT",
        sizes: [
          officialSize(
            "753B-A40B",
            753,
            {
              Instruct: [
                { repo: "zai-org/GLM-5.2" },
                { repo: "zai-org/GLM-5.2-FP8", format: "FP8" },
                {
                  repo: "nvidia/GLM-5.2-NVFP4",
                  format: "NVFP4",
                  trust: "vendor",
                },
              ],
            },
            {
              benchmarkRefs: [
                {
                  name: "Artificial Analysis Intelligence Index",
                  result: "Leading open-weight model · score 51",
                  sourceLabel: "Artificial Analysis",
                  sourceUrl: "https://artificialanalysis.ai/models/open-source",
                  measuredAt: "2026-07-18",
                },
              ],
            },
          ),
        ],
      },
      {
        id: "glm51",
        name: "GLM 5.1",
        date: "Apr 2026",
        ctx: "203K",
        license: "MIT",
        sizes: [
          officialSize("754B-A40B", 754, {
            Instruct: [
              { repo: "zai-org/GLM-5.1" },
              { repo: "zai-org/GLM-5.1-FP8", format: "FP8" },
              {
                repo: "nvidia/GLM-5.1-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "glm5",
        name: "GLM 5",
        date: "Feb 2026",
        ctx: "203K",
        license: "MIT",
        sizes: [
          officialSize("754B-A40B", 754, {
            Instruct: [
              { repo: "zai-org/GLM-5" },
              { repo: "zai-org/GLM-5-FP8", format: "FP8" },
              {
                repo: "nvidia/GLM-5-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "glm47",
        name: "GLM 4.7",
        date: "Dec 2025",
        ctx: "203K",
        license: "MIT",
        sizes: [
          officialSize("358B-A32B", 358, {
            Instruct: [
              { repo: "zai-org/GLM-4.7" },
              { repo: "zai-org/GLM-4.7-FP8", format: "FP8" },
              {
                repo: "nvidia/GLM-4.7-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
          officialSize("Flash 31B-A3B", 31, {
            Instruct: [{ repo: "zai-org/GLM-4.7-Flash" }],
          }),
        ],
      },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    vendor: "MiniMax",
    tags: "agentic, multimodal, long context",
    releases: [
      {
        id: "m3",
        name: "MiniMax M3",
        date: "Jun 2026",
        ctx: "1M",
        license: "MiniMax Community",
        sizes: [
          officialSize("427B-A23B", 427, {
            Instruct: [
              { repo: "MiniMaxAI/MiniMax-M3" },
              { repo: "MiniMaxAI/MiniMax-M3-MXFP8", format: "MXFP8" },
              {
                repo: "nvidia/MiniMax-M3-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      ...[
        [
          "m27",
          "MiniMax M2.7",
          "Apr 2026",
          "MiniMaxAI/MiniMax-M2.7",
          "nvidia/MiniMax-M2.7-NVFP4",
        ],
        [
          "m25",
          "MiniMax M2.5",
          "Feb 2026",
          "MiniMaxAI/MiniMax-M2.5",
          "nvidia/MiniMax-M2.5-NVFP4",
        ],
        ["m21", "MiniMax M2.1", "Dec 2025", "MiniMaxAI/MiniMax-M2.1"],
        ["m2", "MiniMax M2", "Oct 2025", "MiniMaxAI/MiniMax-M2"],
      ].map(([id, name, date, repo, nvidiaRepo]) => ({
        id,
        name,
        date,
        ctx: "205K",
        license: "MiniMax Community",
        sizes: [
          officialSize("229B-A10B", 229, {
            Instruct: [
              { repo },
              ...(nvidiaRepo
                ? [
                    {
                      repo: nvidiaRepo,
                      format: "NVFP4",
                      trust: "vendor" as const,
                    },
                  ]
                : []),
            ],
          }),
        ],
      })),
    ],
  },
  {
    id: "cosmos3",
    name: "Cosmos 3",
    vendor: "NVIDIA",
    tags: "omnimodal world generation, physical AI, action generation",
    capabilities: ["world-modeling", "agentic"],
    releases: [
      {
        id: "omnimodal",
        name: "Omnimodal",
        date: "May 2026",
        ctx: "N/A",
        license: "OpenMDW 1.1",
        category: "world-models",
        capabilities: [
          "world-modeling",
          "video-generation",
          "image-generation",
          "video-understanding",
          "robot-control",
        ],
        sizes: [
          officialSize(
            "64B",
            64,
            {
              Super: [
                {
                  repo: "nvidia/Cosmos3-Super",
                  runtimes: ["Cosmos", "PyTorch", "vLLM-Omni"],
                  minVramGb: 144,
                  recVramGb: 192,
                },
              ],
            },
            {
              updated: "2026-07-09",
              benchmarkRefs: [
                {
                  name: "Cosmos HUE / Human World Benchmark",
                  result: "Open leader · HUE T2V 89.3 · I2V 89.6 · HWB 71.9",
                  sourceLabel: "NVIDIA Cosmos 3",
                  sourceUrl: "https://huggingface.co/nvidia/Cosmos3-Super#benchmarks",
                  measuredAt: "2026-05-31",
                },
              ],
            },
          ),
          officialSize(
            "16B",
            16,
            {
              Nano: [
                {
                  repo: "nvidia/Cosmos3-Nano",
                  runtimes: ["Cosmos", "PyTorch", "vLLM-Omni"],
                  minVramGb: 36,
                  recVramGb: 48,
                },
              ],
            },
            {
              updated: "2026-07-09",
              benchmarkRefs: [
                {
                  name: "Cosmos HUE / Human World Benchmark",
                  result: "HUE T2V 87.6 · I2V 88.6 · HWB 66.9",
                  sourceLabel: "NVIDIA Cosmos 3",
                  sourceUrl: "https://huggingface.co/nvidia/Cosmos3-Nano#benchmarks",
                  measuredAt: "2026-05-31",
                },
              ],
            },
          ),
        ],
      },
      {
        id: "super-image2video",
        name: "Super Image2Video",
        date: "May 2026",
        ctx: "N/A",
        license: "OpenMDW 1.1",
        category: "video-generation",
        capabilities: ["video-generation", "world-modeling"],
        sizes: [
          officialSize(
            "64B",
            64,
            {
              Generator: [
                {
                  repo: "nvidia/Cosmos3-Super-Image2Video",
                  runtimes: ["Cosmos", "PyTorch", "Diffusers"],
                  minVramGb: 144,
                  recVramGb: 192,
                },
              ],
            },
            { updated: "2026-07-09" },
          ),
        ],
      },
      {
        id: "super-text2image",
        name: "Super Text2Image",
        date: "May 2026",
        ctx: "N/A",
        license: "OpenMDW 1.1",
        category: "image-generation",
        capabilities: ["image-generation", "world-modeling"],
        sizes: [
          officialSize(
            "64B",
            64,
            {
              Generator: [
                {
                  repo: "nvidia/Cosmos3-Super-Text2Image",
                  runtimes: ["Diffusers", "SGLang Diffusion", "vLLM-Omni"],
                  minVramGb: 144,
                  recVramGb: 192,
                },
              ],
            },
            {
              updated: "2026-07-09",
              benchmarkRefs: [
                {
                  name: "Artificial Analysis Text to Image Arena",
                  result: "#1 open weights · Elo 1,216",
                  sourceLabel: "Artificial Analysis",
                  sourceUrl: "https://artificialanalysis.ai/image/leaderboard/text-to-image/open-weights",
                  measuredAt: "2026-07-18",
                },
              ],
            },
          ),
        ],
      },
      {
        id: "nano-policy-droid",
        name: "Nano Policy DROID",
        date: "May 2026",
        ctx: "N/A",
        license: "OpenMDW 1.1",
        category: "robotics",
        capabilities: ["robot-control", "world-modeling", "reasoning"],
        sizes: [
          officialSize(
            "16B",
            16,
            {
              Policy: [
                {
                  repo: "nvidia/Cosmos3-Nano-Policy-DROID",
                  runtimes: ["Cosmos", "PyTorch", "Isaac Lab"],
                  minVramGb: 36,
                  recVramGb: 48,
                },
              ],
            },
            { updated: "2026-07-09" },
          ),
        ],
      },
    ],
  },
  {
    id: "hidream",
    name: "HiDream",
    vendor: "HiDream.ai",
    tags: "text-to-image, image editing, unified image generation",
    category: "image-generation",
    capabilities: ["image-generation", "image-editing"],
    releases: [
      {
        id: "o1-image-2604",
        name: "HiDream O1 Image Dev 2604",
        date: "May 2026",
        ctx: "N/A",
        license: "MIT",
        sizes: [
          officialSize(
            "9B",
            9,
            {
              Dev: [
                {
                  repo: "HiDream-ai/HiDream-O1-Image-Dev-2604",
                  runtimes: ["Transformers", "PyTorch"],
                  minVramGb: 20,
                  recVramGb: 24,
                },
              ],
            },
            {
              updated: "2026-05-15",
              benchmarkRefs: [
                {
                  name: "Artificial Analysis Text to Image Arena",
                  result: "#2 open weights · Elo 1,185",
                  sourceLabel: "Artificial Analysis",
                  sourceUrl: "https://artificialanalysis.ai/image/leaderboard/text-to-image/open-weights",
                  measuredAt: "2026-07-18",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "ltx",
    name: "LTX",
    vendor: "Lightricks",
    tags: "text-to-video, image-to-video, synchronized audio generation",
    category: "video-generation",
    capabilities: ["video-generation"],
    releases: [
      {
        id: "ltx23",
        name: "LTX 2.3",
        date: "Mar 2026",
        ctx: "N/A",
        license: "LTX Community",
        sizes: [
          officialSize(
            "22B",
            22,
            {
              Pro: [
                {
                  repo: "Lightricks/LTX-2.3",
                  runtimes: ["LTX Pipelines", "ComfyUI", "Diffusers"],
                  minVramGb: 48,
                  recVramGb: 56,
                },
                {
                  repo: "Lightricks/LTX-2.3-fp8",
                  format: "FP8",
                  runtimes: ["LTX Pipelines", "ComfyUI"],
                  minVramGb: 24,
                  recVramGb: 30,
                },
                {
                  repo: "Lightricks/LTX-2.3-nvfp4",
                  format: "NVFP4",
                  runtimes: ["ComfyUI", "TensorRT"],
                  minVramGb: 16,
                  recVramGb: 20,
                },
              ],
              Fast: [
                {
                  repo: "Lightricks/LTX-2.3",
                  format: "Distilled BF16",
                  runtimes: ["LTX Pipelines", "ComfyUI"],
                  minVramGb: 48,
                  recVramGb: 56,
                },
              ],
            },
            {
              updated: "2026-07-09",
              benchmarkRefs: [
                {
                  name: "Artificial Analysis Text to Video Arena",
                  result: "#1 open weights with audio · Fast Elo 974",
                  sourceLabel: "Artificial Analysis",
                  sourceUrl: "https://artificialanalysis.ai/video/leaderboard/text-to-video/open-weights",
                  measuredAt: "2026-07-18",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "fish-audio",
    name: "Fish Audio",
    vendor: "Fish Audio",
    tags: "multilingual expressive text-to-speech",
    category: "audio-speech",
    capabilities: ["text-to-speech", "multilingual"],
    releases: [
      {
        id: "s2-pro",
        name: "Fish Audio S2 Pro",
        date: "Mar 2026",
        ctx: "N/A",
        license: "Fish Audio Research",
        sizes: [
          officialSize(
            "4.6B",
            4.6,
            {
              TTS: [
                {
                  repo: "fishaudio/s2-pro",
                  runtimes: ["Fish Speech", "Transformers"],
                  minVramGb: 12,
                  recVramGb: 16,
                },
              ],
            },
            {
              updated: "2026-03-11",
              benchmarkRefs: [
                {
                  name: "Artificial Analysis Speech Arena",
                  result: "#1 open weights · Elo 1,117",
                  sourceLabel: "Artificial Analysis",
                  sourceUrl: "https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice/open-weights",
                  measuredAt: "2026-07-18",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "step-audio",
    name: "Step Audio",
    vendor: "StepFun",
    tags: "expressive speech editing, text-to-speech",
    category: "audio-speech",
    capabilities: ["text-to-speech", "multilingual"],
    releases: [
      {
        id: "editx",
        name: "Step Audio EditX",
        date: "Nov 2025",
        ctx: "N/A",
        license: "StepFun Model License",
        sizes: [
          officialSize(
            "4B",
            4,
            {
              TTS: [
                {
                  repo: "stepfun-ai/Step-Audio-EditX",
                  runtimes: ["vLLM", "PyTorch"],
                  minVramGb: 10,
                  recVramGb: 14,
                },
                {
                  repo: "stepfun-ai/Step-Audio-EditX-AWQ-4bit",
                  format: "AWQ 4-bit",
                  runtimes: ["vLLM"],
                  minVramGb: 4,
                  recVramGb: 6,
                },
              ],
            },
            {
              updated: "2026-02-14",
              benchmarkRefs: [
                {
                  name: "Artificial Analysis Speech Arena",
                  result: "#2 open weights · Elo 1,109",
                  sourceLabel: "Artificial Analysis",
                  sourceUrl: "https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice/open-weights",
                  measuredAt: "2026-07-18",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "parakeet",
    name: "Parakeet",
    vendor: "NVIDIA",
    tags: "multilingual speech recognition, high-throughput transcription",
    category: "audio-speech",
    capabilities: ["speech-recognition", "multilingual"],
    releases: [
      {
        id: "tdt-06b-v3",
        name: "Parakeet TDT 0.6B v3",
        date: "Aug 2025",
        ctx: "3h audio",
        license: "CC-BY-4.0",
        sizes: [
          officialSize(
            "0.6B",
            0.6,
            {
              ASR: [
                {
                  repo: "nvidia/parakeet-tdt-0.6b-v3",
                  format: "F32",
                  runtimes: ["NeMo", "Transformers"],
                  kinds: ["cpu", "cuda", "dgx"],
                  minVramGb: 2,
                  recVramGb: 3,
                },
              ],
            },
            {
              updated: "2026-06-29",
              benchmarkRefs: [
                {
                  name: "Open ASR Leaderboard",
                  result: "6.32 mean WER · 3,332.74x RTFx",
                  sourceLabel: "Hugging Face Open ASR",
                  sourceUrl: "https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3#evaluation-results",
                  measuredAt: "2026-06-29",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "lyra",
    name: "Lyra",
    vendor: "NVIDIA",
    tags: "explorable 3D worlds, camera control, 3D Gaussian reconstruction",
    category: "world-models",
    capabilities: ["world-modeling", "3d-generation", "video-generation"],
    releases: [
      {
        id: "lyra2",
        name: "Lyra 2.0",
        date: "Apr 2026",
        ctx: "N/A",
        license: "NVIDIA Research-only",
        sizes: [
          officialSize(
            "14B",
            14,
            {
              World: [
                {
                  repo: "nvidia/Lyra-2.0",
                  runtimes: ["PyTorch", "NeMo", "3D Gaussian Splatting"],
                  minVramGb: 48,
                  recVramGb: 80,
                },
              ],
            },
            {
              updated: "2026-07-15",
              benchmarkRefs: [
                {
                  name: "WorldRoamBench",
                  result: "#1 open model · 70.32 overall · 91.41 action",
                  sourceLabel: "WorldRoamBench",
                  sourceUrl: "https://arxiv.org/abs/2606.31672",
                  measuredAt: "2026-06-30",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "hy-world",
    name: "HY-World",
    vendor: "Tencent",
    tags: "interactive world generation, persistent 3D worlds, reconstruction",
    capabilities: ["world-modeling", "3d-generation", "video-generation"],
    releases: [
      {
        id: "hyworld2",
        name: "HY-World 2.0",
        date: "Apr 2026",
        ctx: "N/A",
        license: "Tencent HY-World Community",
        category: "3d-spatial",
        capabilities: ["world-modeling", "3d-generation"],
        benchmarkRefs: [
          {
            name: "HY-World 2.0 Technical Evaluation",
            result: "Open SOTA for persistent 3D world generation and reconstruction",
            sourceLabel: "Tencent HY-World 2.0",
            sourceUrl: "https://github.com/Tencent-Hunyuan/HY-World-2.0#evaluation",
            measuredAt: "2026-04-16",
          },
        ],
        sizes: [
          officialSize(
            "80B",
            80,
            {
              "HY-Pano": [
                {
                  repo: "tencent/HY-World-2.0",
                  runtimes: ["PyTorch", "Diffusers", "WorldLens"],
                  minVramGb: 160,
                  recVramGb: 192,
                },
              ],
            },
            { updated: "2026-05-21" },
          ),
          officialSize(
            "17B",
            17,
            {
              WorldStereo: [
                {
                  repo: "tencent/HY-World-2.0",
                  runtimes: ["PyTorch", "WorldLens", "3D Gaussian Splatting"],
                  minVramGb: 40,
                  recVramGb: 48,
                },
              ],
            },
            { updated: "2026-05-21" },
          ),
          officialSize(
            "1.2B",
            1.2,
            {
              WorldMirror: [
                {
                  repo: "tencent/HY-World-2.0",
                  runtimes: ["PyTorch", "WorldLens", "3D Gaussian Splatting"],
                  minVramGb: 10,
                  recVramGb: 16,
                },
              ],
            },
            { updated: "2026-05-21" },
          ),
        ],
      },
      {
        id: "hyworld15",
        name: "HY-World 1.5",
        date: "Dec 2025",
        ctx: "N/A",
        license: "Tencent HY-WorldPlay Community",
        category: "world-models",
        capabilities: ["world-modeling", "video-generation"],
        sizes: [
          officialSize(
            "8B",
            8,
            {
              Autoregressive: [
                {
                  repo: "tencent/HY-WorldPlay",
                  runtimes: ["PyTorch", "HY-WorldPlay", "SageAttention"],
                  minVramGb: 72,
                  recVramGb: 80,
                },
              ],
              RL: [
                {
                  repo: "tencent/HY-WorldPlay",
                  runtimes: ["PyTorch", "HY-WorldPlay"],
                  minVramGb: 72,
                  recVramGb: 80,
                },
              ],
              Distilled: [
                {
                  repo: "tencent/HY-WorldPlay",
                  format: "Distilled BF16",
                  runtimes: ["PyTorch", "HY-WorldPlay"],
                  minVramGb: 28,
                  recVramGb: 34,
                },
              ],
            },
            {
              updated: "2026-03-06",
              benchmarkRefs: [
                {
                  name: "WorldRoamBench",
                  result: "#2 open model · 70.29 overall · 91.61 action",
                  sourceLabel: "WorldRoamBench",
                  sourceUrl: "https://arxiv.org/abs/2606.31672",
                  measuredAt: "2026-06-30",
                },
              ],
            },
          ),
          officialSize(
            "5B",
            5,
            {
              Distilled: [
                {
                  repo: "tencent/HY-WorldPlay",
                  format: "Distilled BF16",
                  runtimes: ["PyTorch", "HY-WorldPlay"],
                  minVramGb: 16,
                  recVramGb: 24,
                },
              ],
            },
            { updated: "2026-03-06" },
          ),
        ],
      },
    ],
  },
  {
    id: "lingbot-world",
    name: "LingBot-World",
    vendor: "Ant Group",
    tags: "interactive world simulation, long-horizon memory, camera control",
    category: "world-models",
    capabilities: ["world-modeling", "video-generation"],
    releases: [
      {
        id: "v2",
        name: "LingBot-World 2.0",
        date: "Jul 2026",
        ctx: "N/A",
        license: "CC-BY-NC-SA-4.0",
        sizes: [
          officialSize(
            "14B",
            14,
            {
              "Causal Fast": [
                {
                  repo: "robbyant/lingbot-world-v2-14b-causal-fast",
                  format: "Distilled BF16",
                  runtimes: ["PyTorch", "SGLang Diffusion", "FlashDreams"],
                  minVramGb: 80,
                  recVramGb: 96,
                },
              ],
            },
            { updated: "2026-07-08" },
          ),
        ],
      },
      {
        id: "v1",
        name: "LingBot-World",
        date: "Jan 2026",
        ctx: "N/A",
        license: "Apache-2.0",
        sizes: [
          officialSize(
            "14B",
            14,
            {
              "Base Camera": [
                {
                  repo: "robbyant/lingbot-world-base-cam",
                  runtimes: ["PyTorch", "SGLang Diffusion"],
                  minVramGb: 80,
                  recVramGb: 96,
                },
              ],
            },
            {
              updated: "2026-02-02",
              benchmarkRefs: [
                {
                  name: "WorldRoamBench",
                  result: "#3 open model · 64.25 overall · 91.31 action",
                  sourceLabel: "WorldRoamBench",
                  sourceUrl: "https://arxiv.org/abs/2606.31672",
                  measuredAt: "2026-06-30",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "matrix-game",
    name: "Matrix-Game",
    vendor: "Skywork",
    tags: "real-time interactive worlds, game simulation, long-horizon memory",
    category: "world-models",
    capabilities: ["world-modeling", "video-generation"],
    releases: [
      {
        id: "v3",
        name: "Matrix-Game 3.0",
        date: "Mar 2026",
        ctx: "N/A",
        license: "Apache-2.0",
        sizes: [
          officialSize(
            "5B",
            5,
            {
              Base: [
                {
                  repo: "Skywork/Matrix-Game-3.0",
                  runtimes: ["PyTorch", "Diffusers", "FlashAttention"],
                  minVramGb: 40,
                  recVramGb: 48,
                },
              ],
              Distilled: [
                {
                  repo: "Skywork/Matrix-Game-3.0",
                  format: "INT8",
                  runtimes: ["PyTorch", "Diffusers", "FlashAttention"],
                  minVramGb: 24,
                  recVramGb: 32,
                },
              ],
            },
            {
              updated: "2026-04-28",
              benchmarkRefs: [
                {
                  name: "WorldRoamBench",
                  result: "#4 open model · 63.31 overall · 5.34 Hz",
                  sourceLabel: "WorldRoamBench",
                  sourceUrl: "https://arxiv.org/abs/2606.31672",
                  measuredAt: "2026-06-30",
                },
                {
                  name: "WBench Navi View",
                  result: "71.2",
                  sourceLabel: "Hugging Face evaluation result",
                  sourceUrl: "https://huggingface.co/Skywork/Matrix-Game-3.0#evaluation-results",
                  measuredAt: "2026-04-28",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "sana-wm",
    name: "SANA-WM",
    vendor: "NVIDIA / MIT HAN Lab",
    tags: "efficient minute-scale world modeling, hybrid linear diffusion",
    category: "world-models",
    capabilities: ["world-modeling", "video-generation"],
    releases: [
      {
        id: "v1",
        name: "SANA-WM",
        date: "May 2026",
        ctx: "N/A",
        license: "Apache-2.0",
        sizes: [
          officialSize(
            "2.6B",
            2.6,
            {
              Bidirectional: [
                {
                  repo: "Efficient-Large-Model/SANA-WM_bidirectional",
                  runtimes: ["PyTorch", "SANA", "Diffusers"],
                  minVramGb: 64,
                  recVramGb: 96,
                },
              ],
              Streaming: [
                {
                  repo: "Efficient-Large-Model/SANA-WM_streaming",
                  runtimes: ["PyTorch", "SANA"],
                  minVramGb: 48,
                  recVramGb: 80,
                },
              ],
              "Chunk Causal": [
                {
                  repo: "Efficient-Large-Model/SANA-WM_chunk_causal",
                  runtimes: ["PyTorch", "SANA"],
                  minVramGb: 48,
                  recVramGb: 80,
                },
              ],
            },
            {
              updated: "2026-06-10",
              benchmarkRefs: [
                {
                  name: "WorldRoamBench",
                  result: "#5 open model · 62.16 overall · 73.08 visual",
                  sourceLabel: "WorldRoamBench",
                  sourceUrl: "https://arxiv.org/abs/2606.31672",
                  measuredAt: "2026-06-30",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "hunyuan3d",
    name: "Hunyuan3D",
    vendor: "Tencent",
    tags: "image-to-3D, text-to-3D, PBR materials",
    category: "3d-spatial",
    capabilities: ["3d-generation"],
    releases: [
      {
        id: "hy3d21",
        name: "Hunyuan3D 2.1",
        date: "Jun 2025",
        ctx: "N/A",
        license: "Tencent Hunyuan Community",
        sizes: [
          officialSize(
            "5.3B",
            5.3,
            {
              System: [
                {
                  repo: "tencent/Hunyuan3D-2.1",
                  runtimes: ["PyTorch", "Diffusers", "ComfyUI"],
                  minVramGb: 24,
                  recVramGb: 32,
                },
              ],
            },
            {
              updated: "2025-10-17",
              benchmarkRefs: [
                {
                  name: "3D Arena",
                  result: "Top-tier open image-to-3D model",
                  sourceLabel: "Hugging Face 3D Arena",
                  sourceUrl: "https://huggingface.co/3d-arena",
                  measuredAt: "2026-07-18",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "gr00t",
    name: "GR00T",
    vendor: "NVIDIA",
    tags: "vision-language-action, humanoid robotics, generalist control",
    category: "robotics",
    capabilities: ["robot-control", "world-modeling", "reasoning"],
    releases: [
      {
        id: "n17",
        name: "GR00T N1.7",
        date: "Apr 2026",
        ctx: "N/A",
        license: "NVIDIA Open Model",
        sizes: [
          officialSize(
            "3B",
            3,
            {
              Base: [
                {
                  repo: "nvidia/GR00T-N1.7-3B",
                  runtimes: ["Isaac GR00T", "PyTorch", "TensorRT"],
                  minVramGb: 8,
                  recVramGb: 12,
                },
              ],
            },
            {
              updated: "2026-04-23",
              benchmarkRefs: [
                {
                  name: "LIBERO",
                  result: "94.35%-98.45% success across four suites after fine-tuning",
                  sourceLabel: "NVIDIA Isaac GR00T evaluation",
                  sourceUrl: "https://github.com/NVIDIA/Isaac-GR00T/blob/main/examples/LIBERO/README.md",
                  measuredAt: "2026-04-23",
                },
              ],
            },
          ),
        ],
      },
    ],
  },
  {
    id: "mimo",
    name: "MiMo",
    vendor: "Xiaomi",
    tags: "reasoning, agentic, mixture of experts",
    releases: [
      {
        id: "mimo25",
        name: "MiMo V2.5",
        date: "Apr 2026",
        ctx: "1M",
        license: "MIT",
        sizes: [
          officialSize("Pro 1.02T-A42B", 1023, {
            Instruct: [
              { repo: "XiaomiMiMo/MiMo-V2.5-Pro" },
              {
                repo: "XiaomiMiMo/MiMo-V2.5-Pro-FP4-DFlash",
                format: "FP4 DFlash",
              },
            ],
            Base: [{ repo: "XiaomiMiMo/MiMo-V2.5-Pro-Base" }],
          }),
          officialSize("311B-A15B", 311, {
            Instruct: [{ repo: "XiaomiMiMo/MiMo-V2.5" }],
            Base: [{ repo: "XiaomiMiMo/MiMo-V2.5-Base" }],
          }),
        ],
      },
      {
        id: "mimo2flash",
        name: "MiMo V2 Flash",
        date: "Dec 2025",
        ctx: "256K",
        license: "MIT",
        sizes: [
          officialSize("310B-A15B", 310, {
            Instruct: [{ repo: "XiaomiMiMo/MiMo-V2-Flash" }],
            Base: [{ repo: "XiaomiMiMo/MiMo-V2-Flash-Base" }],
          }),
        ],
      },
    ],
  },
  {
    id: "inkling",
    name: "Inkling",
    vendor: "Thinking Machines Lab",
    tags: "multimodal reasoning, agentic tools, coding",
    releases: [
      {
        id: "inkling",
        name: "Inkling",
        date: "Jul 15 2026",
        ctx: "1M",
        license: "Apache-2.0",
        sizes: [
          officialSize("975B-A41B", 975, {
            General: [
              { repo: "thinkingmachines/Inkling" },
              {
                repo: "thinkingmachines/Inkling-NVFP4",
                format: "NVFP4",
              },
            ],
          }),
        ],
      },
    ],
  },
  {
    id: "kimi",
    name: "Kimi",
    vendor: "Moonshot AI",
    tags: "agentic, coding, multimodal",
    releases: [
      {
        id: "k27code",
        name: "Kimi K2.7 Code",
        date: "Jun 2026",
        ctx: "256K",
        license: "Modified MIT",
        sizes: [
          officialSize("1.06T-A32B", 1059, {
            Code: [
              {
                repo: "moonshotai/Kimi-K2.7-Code",
                format: "Native INT4",
              },
              {
                repo: "nvidia/Kimi-K2.7-Code-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "k26",
        name: "Kimi K2.6",
        date: "Apr 2026",
        ctx: "256K",
        license: "Modified MIT",
        sizes: [
          officialSize("1.06T-A32B", 1059, {
            Instruct: [
              { repo: "moonshotai/Kimi-K2.6", format: "Native INT4" },
              {
                repo: "nvidia/Kimi-K2.6-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "k25",
        name: "Kimi K2.5",
        date: "Jan 2026",
        ctx: "256K",
        license: "Modified MIT",
        sizes: [
          officialSize("1.06T-A32B", 1059, {
            Instruct: [
              { repo: "moonshotai/Kimi-K2.5", format: "Native INT4" },
              {
                repo: "nvidia/Kimi-K2.5-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "k2thinking",
        name: "Kimi K2 Thinking",
        date: "Nov 2025",
        ctx: "256K",
        license: "Modified MIT",
        sizes: [
          officialSize("1.06T-A32B", 1058, {
            Reasoning: [
              { repo: "moonshotai/Kimi-K2-Thinking" },
              {
                repo: "nvidia/Kimi-K2-Thinking-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "k2",
        name: "Kimi K2",
        date: "Jul 2025",
        ctx: "128K",
        license: "Modified MIT",
        sizes: [
          officialSize("1.06T-A32B", 1058, {
            Instruct: [{ repo: "moonshotai/Kimi-K2-Instruct" }],
            Base: [{ repo: "moonshotai/Kimi-K2-Base" }],
          }),
        ],
      },
    ],
  },
  {
    id: "solar",
    name: "Solar",
    vendor: "Upstage",
    tags: "reasoning, efficient mixture of experts",
    releases: [
      {
        id: "solaropen",
        name: "Solar Open",
        date: "Dec 2025",
        ctx: "128K",
        license: "Upstage Solar",
        sizes: [
          officialSize("103B-A12B", 103, {
            Instruct: [
              { repo: "upstage/Solar-Open-100B" },
              {
                repo: "nota-ai/Solar-Open-100B-NotaMoEQuant-Int4",
                format: "INT4",
                trust: "vendor",
              },
            ],
          }),
        ],
      },
      {
        id: "solarpropreview",
        name: "Solar Pro Preview",
        date: "Sep 2024",
        ctx: "4K",
        license: "MIT",
        sizes: [
          officialSize("22B", 22, {
            Instruct: [{ repo: "upstage/solar-pro-preview-instruct" }],
            Base: [{ repo: "upstage/solar-pro-preview-pretrained" }],
          }),
        ],
      },
      {
        id: "solar107",
        name: "SOLAR 10.7B",
        date: "Dec 2023",
        ctx: "4K",
        license: "CC-BY-NC-4.0",
        sizes: [
          officialSize("10.7B", 10.7, {
            Instruct: [{ repo: "upstage/SOLAR-10.7B-Instruct-v1.0" }],
            Base: [{ repo: "upstage/SOLAR-10.7B-v1.0" }],
          }),
        ],
      },
    ],
  },
  {
    id: "k2",
    name: "K2",
    vendor: "LLM360 / MBZUAI",
    tags: "reasoning, fully open, long context",
    releases: [
      {
        id: "k2v2",
        name: "K2 V2",
        date: "Jan 2026",
        ctx: "256K",
        license: "Apache-2.0",
        sizes: [
          officialSize("73B", 73, {
            Reasoning: [{ repo: "LLM360/K2-Think-V2" }],
            Instruct: [{ repo: "LLM360/K2-V2-Instruct" }],
            Base: [{ repo: "LLM360/K2-V2" }],
          }),
        ],
      },
      {
        id: "k2think",
        name: "K2 Think",
        date: "Sep 2025",
        ctx: "32K",
        license: "Apache-2.0",
        sizes: [
          officialSize("33B", 33, {
            Reasoning: [{ repo: "LLM360/K2-Think" }],
          }),
        ],
      },
      {
        id: "k2original",
        name: "K2",
        date: "Apr 2024",
        ctx: "4K",
        license: "Apache-2.0",
        sizes: [
          officialSize("65B", 65, {
            Instruct: [{ repo: "LLM360/K2-Chat" }],
            Base: [{ repo: "LLM360/K2" }],
          }),
        ],
      },
    ],
  },
  {
    id: "grok",
    name: "Grok",
    vendor: "xAI",
    tags: "mixture of experts, long context",
    releases: [
      {
        id: "grok2",
        name: "Grok 2",
        date: "Aug 2025",
        ctx: "128K",
        license: "Grok 2 Community",
        sizes: [
          officialSize("270B", 270, {
            Instruct: [{ repo: "xai-org/grok-2", format: "FP8" }],
          }),
        ],
      },
      {
        id: "grok1",
        name: "Grok 1",
        date: "Mar 2024",
        ctx: "8K",
        license: "Apache-2.0",
        sizes: [
          officialSize("314B", 314, {
            Base: [{ repo: "xai-org/grok-1" }],
          }),
        ],
      },
    ],
  },
];
