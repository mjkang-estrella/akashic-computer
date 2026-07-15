import { unknownDeltas, zeroDeltas } from "./fit";
import type { Artifact, Family, SizeNode } from "./types";

type RepoSpec = {
  repo: string;
  format?: string;
  trust?: Artifact["trust"];
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
    const minVramGb = Math.max(2, Math.round(paramsB * profile.factor));
    return {
      repo: spec.repo,
      format,
      trust: spec.trust ?? "official",
      confidence: "verified",
      kinds: profile.kinds,
      runtimes: profile.runtimes,
      minVramGb,
      recVramGb: Math.max(3, Math.round(minVramGb * 1.15)),
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
  };
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
        ctx: "Varies",
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
          officialSize("1.5B", 1.5, { Qwen: [{ repo: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B" }] }),
          officialSize("7B", 7, { Qwen: [{ repo: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B" }] }),
          officialSize("8B", 8, {
            Llama: [{ repo: "deepseek-ai/DeepSeek-R1-Distill-Llama-8B" }],
            Qwen3: [{ repo: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B" }],
          }),
          officialSize("14B", 14, { Qwen: [{ repo: "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B" }] }),
          officialSize("32B", 32, { Qwen: [{ repo: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B" }] }),
          officialSize("70B", 70, { Llama: [{ repo: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B" }] }),
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
        ].map(([label, paramsB]) =>
          officialSize(String(label), Number(paramsB), {
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
          }),
        ),
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
        id: "n3",
        name: "Nemotron 3",
        date: "2025–2026",
        ctx: "Varies",
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
          officialSize("753B-A40B", 753, {
            Instruct: [
              { repo: "zai-org/GLM-5.2" },
              { repo: "zai-org/GLM-5.2-FP8", format: "FP8" },
              {
                repo: "nvidia/GLM-5.2-NVFP4",
                format: "NVFP4",
                trust: "vendor",
              },
            ],
          }),
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
