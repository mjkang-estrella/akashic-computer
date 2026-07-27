export interface StackLayer {
  id: string;
  label: string;
  question: string;
  definition: string;
  example: string;
}

export const INFERENCE_STACK: StackLayer[] = [
  {
    id: "model",
    label: "Model",
    question: "What behavior was trained?",
    definition:
      "The architecture and learned behavior people refer to by name. A model can be published in several sizes, variants, and downloadable forms.",
    example: "Qwen 3, DeepSeek R1, or Gemma 3",
  },
  {
    id: "checkpoint",
    label: "Checkpoint",
    question: "Which learned weights?",
    definition:
      "A specific saved set of tensors and configuration. Base, instruct, reasoning, and distilled checkpoints can share an architecture while behaving differently.",
    example: "A 32B instruct checkpoint",
  },
  {
    id: "artifact",
    label: "Artifact",
    question: "How are the weights packaged?",
    definition:
      "The files you download. An artifact records a precision or quantization, tensor layout, metadata, and often a runtime-oriented format.",
    example: "BF16 safetensors, NVFP4, or GGUF Q4_K_M",
  },
  {
    id: "runtime",
    label: "Runtime",
    question: "What executes the artifact?",
    definition:
      "The software engine that loads tensors, allocates caches, selects kernels, and serves tokens. Artifact support is specific to each runtime.",
    example: "llama.cpp, vLLM, or TensorRT-LLM",
  },
  {
    id: "hardware",
    label: "Hardware",
    question: "Where does inference happen?",
    definition:
      "The CPU, GPU, accelerator, and memory topology available to the runtime. Capacity alone does not guarantee that an artifact has compatible kernels.",
    example: "Apple Silicon, one GPU, or a multi-GPU node",
  },
];

export interface Technique {
  id: "distillation" | "quantization" | "fine-tuning";
  label: string;
  purpose: string;
  changes: string;
  needsTraining: string;
  identity: string;
  tradeoff: string;
}

export const MODEL_TECHNIQUES: Technique[] = [
  {
    id: "distillation",
    label: "Distillation",
    purpose: "Transfer behavior from a teacher into a different student model.",
    changes: "The student is trained and receives a new set of learned weights.",
    needsTraining: "Yes. It requires a teacher signal and a student training process.",
    identity: "Creates a distinct model checkpoint, often with a different architecture or size.",
    tradeoff: "Can preserve useful behavior at lower cost, but does not reproduce the teacher exactly.",
  },
  {
    id: "quantization",
    label: "Quantization",
    purpose: "Represent an existing checkpoint with lower-precision numbers.",
    changes: "The numerical representation and sometimes the tensor layout.",
    needsTraining: "Usually no for post-training quantization; some methods use calibration or quantization-aware training.",
    identity: "Usually remains an artifact of the same model checkpoint.",
    tradeoff: "Reduces memory and may improve speed, with quality and compatibility depending on the method.",
  },
  {
    id: "fine-tuning",
    label: "Fine-tuning",
    purpose: "Adapt a model to new behavior, data, or instructions.",
    changes: "All weights or a smaller adapter are updated through training.",
    needsTraining: "Yes. The amount of training depends on full tuning versus parameter-efficient methods.",
    identity: "Produces a new variant or adapter derived from the original checkpoint.",
    tradeoff: "Can specialize behavior, but may narrow capabilities or introduce new failure modes.",
  },
];

export const POST_TRAINING_STAGES = [
  {
    id: "continued-pretraining",
    label: "Continued pretraining",
    input: "Raw domain text or code",
    objective: "Next-token prediction",
    result:
      "Changes the model's domain distribution and knowledge before instruction behavior is added.",
  },
  {
    id: "sft",
    label: "Supervised fine-tuning",
    input: "Demonstrations and instruction-response examples",
    objective: "Imitate target completions",
    result:
      "Teaches response format, task behavior, chat conventions, and tool-use patterns.",
  },
  {
    id: "preference",
    label: "Preference optimization",
    input: "Preferred and rejected responses",
    objective: "Increase relative preference",
    result:
      "Moves behavior toward human or synthetic preferences without requiring a scalar reward at inference time.",
  },
  {
    id: "online",
    label: "Online reward training",
    input: "Model-generated rollouts and reward signals",
    objective: "Maximize measured reward",
    result:
      "Optimizes behavior against verifiable, learned, or environment-provided feedback.",
  },
  {
    id: "evaluation",
    label: "Evaluation and release",
    input: "Held-out tasks, safety tests, and deployment trials",
    objective: "Find regressions and establish evidence",
    result:
      "Produces a release candidate only after capability, safety, formatting, and runtime behavior are checked.",
  },
] as const;

export const FINE_TUNING_METHODS = [
  {
    id: "full",
    label: "Full fine-tuning",
    trainable: "All model parameters",
    baseWeights: "Updated directly",
    optimizerState: "Large",
    output: "A complete new checkpoint",
    useWhen: "The behavior change justifies the highest training and storage cost.",
  },
  {
    id: "lora",
    label: "LoRA",
    trainable: "Small low-rank adapter matrices",
    baseWeights: "Frozen",
    optimizerState: "Much smaller than full tuning",
    output: "An adapter, or a merged checkpoint",
    useWhen: "You need efficient specialization or several swappable behaviors.",
  },
  {
    id: "qlora",
    label: "QLoRA",
    trainable: "LoRA adapters over a quantized base",
    baseWeights: "Frozen and quantized for training",
    optimizerState: "Adapter-sized, with a lower base-weight footprint",
    output: "An adapter tied to the exact base model",
    useWhen: "Base-weight memory is the main barrier to adapter training.",
  },
] as const;

export interface PrecisionFormat {
  id: "bf16" | "fp8" | "nvfp4" | "int4";
  label: string;
  effectiveBits: number;
  calculationLabel: string;
  description: string;
  caveat: string;
}

export const PRECISION_FORMATS: PrecisionFormat[] = [
  {
    id: "bf16",
    label: "BF16",
    effectiveBits: 16,
    calculationLabel: "16 bits per parameter",
    description: "A common high-fidelity reference precision for inference.",
    caveat: "Runtime buffers and KV cache are additional.",
  },
  {
    id: "fp8",
    label: "FP8",
    effectiveBits: 8,
    calculationLabel: "8 bits per parameter",
    description: "An 8-bit floating-point representation for supported accelerators and kernels.",
    caveat: "Some tensors or operations may remain at higher precision.",
  },
  {
    id: "nvfp4",
    label: "NVFP4",
    effectiveBits: 4.5,
    calculationLabel: "about 4.5 bits per parameter",
    description: "A block-scaled 4-bit floating-point representation designed for supported NVIDIA hardware.",
    caveat: "The estimate includes block scales but not higher-precision exceptions or runtime state.",
  },
  {
    id: "int4",
    label: "INT4",
    effectiveBits: 4,
    calculationLabel: "4-bit payload per parameter",
    description: "A broad class of integer quantization used by methods such as AWQ and GPTQ.",
    caveat: "Scales, zero points, grouping, and metadata make real artifacts larger than the raw payload.",
  },
];

export function estimateWeightMemory(
  parameterBillions: number,
  effectiveBits: number,
) {
  const bytes = parameterBillions * 1_000_000_000 * (effectiveBits / 8);
  const gib = bytes / 1024 ** 3;
  return {
    weightGiB: gib,
    planningGiB: gib * 1.15,
  };
}

export const REPOSITORY_VIEWS = [
  {
    id: "card",
    label: "Model card",
    lookFor: "Intended use, limitations, license, training notes, and reported evaluations.",
    warning:
      "A model card is publisher-provided documentation. Check whether claims identify their evaluation settings and source.",
  },
  {
    id: "config",
    label: "config.json",
    lookFor: "Architecture, hidden size, layer count, expert routing, context configuration, and quantization metadata.",
    warning:
      "Configuration names describe structure, but runtime support still depends on the engine version and kernels.",
  },
  {
    id: "files",
    label: "Weight files",
    lookFor: "Safetensors or GGUF files, shard indexes, tensor sizes, and a complete set of weight shards.",
    warning:
      "A repository can contain adapters or conversion output instead of a complete standalone checkpoint.",
  },
  {
    id: "tokenizer",
    label: "Tokenizer",
    lookFor: "Tokenizer files, special tokens, and a chat template that matches the selected model variant.",
    warning:
      "Using the wrong tokenizer or prompt template can make a healthy checkpoint appear broken.",
  },
] as const;

export const RUNTIME_MATRIX = [
  {
    name: "LM Studio",
    role: "Desktop application",
    bestFor: "Inspecting and running supported local models through a graphical interface.",
    artifactPath: "Commonly GGUF and supported packaged formats",
  },
  {
    name: "Ollama",
    role: "Local model service",
    bestFor: "A simple local API and managed model workflow.",
    artifactPath: "Packaged models, commonly backed by GGUF",
  },
  {
    name: "llama.cpp",
    role: "Portable inference engine",
    bestFor: "Direct control across CPU, Metal, CUDA, Vulkan, and other supported backends.",
    artifactPath: "GGUF",
  },
  {
    name: "vLLM",
    role: "GPU serving engine",
    bestFor: "Throughput-oriented serving, batching, and OpenAI-compatible APIs.",
    artifactPath: "Supported Hugging Face checkpoints and quantizations",
  },
  {
    name: "TensorRT-LLM",
    role: "NVIDIA inference stack",
    bestFor: "NVIDIA-specific compilation and optimized deployment paths.",
    artifactPath: "Supported checkpoints and TensorRT engines",
  },
] as const;
