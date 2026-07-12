export type LearnCategory =
  | "Model structure"
  | "Artifacts and precision"
  | "Runtime and hardware"
  | "Evidence and trust";

export interface LearnTerm {
  id: string;
  term: string;
  short: string;
  definition: string;
  category: LearnCategory;
}

export const LEARN_TERMS: LearnTerm[] = [
  {
    id: "family",
    term: "Model family",
    short: "A related line of models from one organization.",
    definition:
      "A family groups releases that share a name, architecture lineage, or publisher, such as Qwen or Llama.",
    category: "Model structure",
  },
  {
    id: "release",
    term: "Release",
    short: "A named generation or dated revision within a family.",
    definition:
      "A release identifies a specific generation of a family. It can change architecture, capabilities, license, and context length.",
    category: "Model structure",
  },
  {
    id: "parameters",
    term: "Parameters",
    short: "The learned values stored by a model.",
    definition:
      "Parameter count is a rough measure of model scale, not a direct measure of quality or memory use. Quantization changes how many bytes each parameter needs.",
    category: "Model structure",
  },
  {
    id: "active-parameters",
    term: "Active parameters",
    short: "The subset used for one token in a mixture-of-experts model.",
    definition:
      "A model may store many total parameters but route each token through only a smaller active subset. Stored weights still affect memory requirements.",
    category: "Model structure",
  },
  {
    id: "context",
    term: "Context window",
    short: "The maximum token span a model can process at once.",
    definition:
      "Context includes the prompt, conversation history, retrieved text, and generated output. Longer context also increases runtime memory use.",
    category: "Model structure",
  },
  {
    id: "variant",
    term: "Variant",
    short: "A training or behavior branch of the same model size.",
    definition:
      "Base models continue text. Instruct models are tuned to follow requests. Reasoning, coding, and multimodal variants may use different training and templates.",
    category: "Model structure",
  },
  {
    id: "artifact",
    term: "Artifact",
    short: "A downloadable set of model weights in a specific format.",
    definition:
      "One model can have many artifacts published by its creator, a hardware vendor, or the community. Artifacts can differ in precision, runtime support, and provenance.",
    category: "Artifacts and precision",
  },
  {
    id: "quantization",
    term: "Quantization",
    short: "Representing weights with fewer bits to reduce memory use.",
    definition:
      "Quantization usually makes a model smaller and can make inference faster, but support and quality changes depend on the method, runtime, and hardware.",
    category: "Artifacts and precision",
  },
  {
    id: "bf16",
    term: "BF16",
    short: "A 16-bit floating-point reference precision.",
    definition:
      "Bfloat16 is commonly used for high-fidelity inference and as a reference for comparing compressed artifacts. It generally needs about two bytes per parameter before runtime overhead.",
    category: "Artifacts and precision",
  },
  {
    id: "fp8",
    term: "FP8",
    short: "An 8-bit floating-point format used on supported accelerators.",
    definition:
      "FP8 can roughly halve weight memory relative to BF16. Practical support depends on the checkpoint encoding, GPU generation, and inference engine.",
    category: "Artifacts and precision",
  },
  {
    id: "nvfp4",
    term: "NVFP4",
    short: "NVIDIA's block-scaled 4-bit floating-point format.",
    definition:
      "NVFP4 targets NVIDIA hardware and supported engines. It reduces weight memory further than FP8 while retaining selected operations at higher precision.",
    category: "Artifacts and precision",
  },
  {
    id: "int4",
    term: "INT4, AWQ, and GPTQ",
    short: "Families of 4-bit integer weight quantization.",
    definition:
      "INT4 describes the precision. AWQ and GPTQ describe quantization approaches and checkpoint conventions. Runtime compatibility is not interchangeable.",
    category: "Artifacts and precision",
  },
  {
    id: "gguf",
    term: "GGUF",
    short: "A portable format commonly used by llama.cpp applications.",
    definition:
      "GGUF packages weights and model metadata for local inference, especially on CPUs and Apple Silicon. A GGUF repository often contains several quantization levels.",
    category: "Artifacts and precision",
  },
  {
    id: "runtime",
    term: "Runtime",
    short: "The software engine that loads and executes an artifact.",
    definition:
      "Transformers, vLLM, SGLang, TensorRT-LLM, llama.cpp, Ollama, and LM Studio support different models, formats, and hardware paths.",
    category: "Runtime and hardware",
  },
  {
    id: "vram",
    term: "VRAM",
    short: "Accelerator memory available for weights and inference state.",
    definition:
      "Weights are only part of VRAM use. Context length, KV cache, batching, temporary buffers, and runtime overhead also consume memory.",
    category: "Runtime and hardware",
  },
  {
    id: "fit",
    term: "Fit estimate",
    short: "A capacity estimate, not a guarantee of successful inference.",
    definition:
      "Fits means the configured VRAM is at or above the recommended estimate. Tight means it is between minimum and recommended. Runtime and context settings still matter.",
    category: "Runtime and hardware",
  },
  {
    id: "benchmark",
    term: "Benchmark",
    short: "A standardized evaluation of one capability or task set.",
    definition:
      "Benchmarks measure different things and can use different prompts, scoring rules, and inference settings. Scores should only be compared under compatible conditions.",
    category: "Evidence and trust",
  },
  {
    id: "delta",
    term: "Artifact delta",
    short: "The measured score difference from a reference artifact.",
    definition:
      "A delta isolates how a quantized artifact scored relative to its BF16 reference. Missing data is shown as n/a rather than inferred.",
    category: "Evidence and trust",
  },
  {
    id: "provenance",
    term: "Provenance",
    short: "Who published a result or artifact and how it was verified.",
    definition:
      "Official means the model creator published it. Vendor means a hardware or runtime vendor published it. Community means an independent publisher did.",
    category: "Evidence and trust",
  },
];

export const LEARN_MATERIALS = [
  {
    title: "Hugging Face model cards",
    source: "Hugging Face",
    href: "https://huggingface.co/docs/hub/model-cards",
    description: "How model repositories document intended use, licenses, datasets, and evaluation results.",
  },
  {
    title: "Quantization overview",
    source: "Hugging Face Transformers",
    href: "https://huggingface.co/docs/transformers/quantization/overview",
    description: "A practical map of precision formats, methods, and supported hardware backends.",
  },
  {
    title: "Quantization concepts",
    source: "Hugging Face Transformers",
    href: "https://huggingface.co/docs/transformers/quantization/concept_guide",
    description: "A deeper explanation of calibration, granularity, PTQ, and QAT.",
  },
  {
    title: "Quantized inference support",
    source: "vLLM",
    href: "https://docs.vllm.ai/en/latest/features/quantization/",
    description: "Runtime-specific support for AWQ, GPTQ, GGUF, FP8, ModelOpt, and other formats.",
  },
  {
    title: "Local inference and GGUF",
    source: "llama.cpp",
    href: "https://github.com/ggml-org/llama.cpp",
    description: "The reference implementation behind much of the local GGUF ecosystem.",
  },
  {
    title: "Language model evaluation harness",
    source: "EleutherAI",
    href: "https://github.com/EleutherAI/lm-evaluation-harness",
    description: "An open framework for reproducing and understanding many language-model evaluations.",
  },
] as const;

export function learnTermForFormat(format: string) {
  const normalized = format.toLowerCase();
  if (normalized.includes("nvfp4")) return "nvfp4";
  if (normalized.startsWith("fp8")) return "fp8";
  if (normalized.includes("bf16")) return "bf16";
  if (normalized.includes("gguf")) return "gguf";
  if (
    normalized.includes("int4") ||
    normalized.includes("awq") ||
    normalized.includes("gptq")
  )
    return "int4";
  return "quantization";
}
