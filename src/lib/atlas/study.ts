export const STUDY_TOPICS = ["GPU fundamentals", "Inference & memory", "Quantization", "Kernel engineering", "Profiling", "Distributed inference"] as const;
export type StudyTopic = typeof STUDY_TOPICS[number];
export const RESOURCE_KINDS = ["Documentation", "Paper", "Implementation"] as const;
export const STUDY_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

export interface StudyResource {
  id: string;
  title: string;
  publisher: string;
  href: string;
  kind: typeof RESOURCE_KINDS[number];
  level: typeof STUDY_LEVELS[number];
  topics: StudyTopic[];
  description: string;
}

/** Original reading notes; link to primary material instead of reproducing it. */
export const STUDY_RESOURCES: StudyResource[] = [
  { id: "inference-book", title: "All About Transformer Inference", publisher: "How To Scale Your Model", href: "https://jax-ml.github.io/scaling-book/inference/", kind: "Documentation", level: "Beginner", topics: ["Inference & memory", "GPU fundamentals", "Distributed inference"], description: "Follow the work and memory movement behind prompt processing, token generation, batching and sharding." },
  { id: "cuda-guide", title: "CUDA Programming Guide", publisher: "NVIDIA", href: "https://docs.nvidia.com/cuda/cuda-programming-guide/index.html", kind: "Documentation", level: "Beginner", topics: ["GPU fundamentals"], description: "Establish the execution and memory vocabulary you need before interpreting a GPU optimization." },
  { id: "cuda-practices", title: "CUDA Best Practices Guide", publisher: "NVIDIA", href: "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html", kind: "Documentation", level: "Intermediate", topics: ["GPU fundamentals", "Kernel engineering", "Profiling"], description: "Investigate how memory access, measurement and execution choices affect a concrete CUDA workload." },
  { id: "transformer", title: "Attention Is All You Need", publisher: "Vaswani et al.", href: "https://arxiv.org/abs/1706.03762", kind: "Paper", level: "Beginner", topics: ["Inference & memory"], description: "Identify the attention and feed-forward operations that later inference systems must execute." },
  { id: "flash-attention", title: "FlashAttention", publisher: "Dao et al.", href: "https://arxiv.org/abs/2205.14135", kind: "Paper", level: "Advanced", topics: ["Kernel engineering", "Inference & memory"], description: "Study how changing attention's memory access can improve execution without replacing exact attention with an approximation." },
  { id: "paged-attention", title: "PagedAttention / vLLM", publisher: "Kwon et al.", href: "https://arxiv.org/abs/2309.06180", kind: "Paper", level: "Intermediate", topics: ["Inference & memory"], description: "Examine KV-cache allocation and why serving many requests requires more than loading model weights." },
  { id: "kv-cache", title: "How caching works", publisher: "Hugging Face Transformers", href: "https://huggingface.co/docs/transformers/en/cache_explanation", kind: "Documentation", level: "Beginner", topics: ["Inference & memory"], description: "Trace the state retained between generated tokens and connect it to context-dependent memory use." },
  { id: "exl3-conversion", title: "EXL3 conversion settings", publisher: "ExLlamaV3", href: "https://github.com/turboderp-org/exllamav3/blob/master/doc/convert.md", kind: "Documentation", level: "Intermediate", topics: ["Quantization"], description: "Inspect target bitrate, layer-specific precision, recipes and calibration before comparing two EXL3 conversions." },
  { id: "gptq", title: "GPTQ", publisher: "Frantar et al.", href: "https://arxiv.org/abs/2210.17323", kind: "Paper", level: "Advanced", topics: ["Quantization"], description: "Investigate the optimization behind a weight conversion; a bit count alone does not describe the method." },
  { id: "awq", title: "AWQ", publisher: "Lin et al.", href: "https://arxiv.org/abs/2306.00978", kind: "Paper", level: "Advanced", topics: ["Quantization"], description: "Compare an activation-informed quantization method with other ways of allocating limited weight precision." },
  { id: "nsight-systems", title: "Nsight Systems User Guide", publisher: "NVIDIA", href: "https://docs.nvidia.com/nsight-systems/UserGuide/index.html", kind: "Documentation", level: "Intermediate", topics: ["Profiling"], description: "Start with a timeline to locate waits, transfers and CPU/GPU interaction before drilling into a kernel." },
  { id: "nsight-compute", title: "Nsight Compute Profiling Guide", publisher: "NVIDIA", href: "https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html", kind: "Documentation", level: "Advanced", topics: ["Profiling", "Kernel engineering"], description: "Use kernel metrics and roofline analysis to test a bottleneck hypothesis against measurements." },
  { id: "triton", title: "Triton tutorials", publisher: "Triton contributors", href: "https://triton-lang.org/main/getting-started/tutorials/index.html", kind: "Implementation", level: "Intermediate", topics: ["Kernel engineering"], description: "Work through executable examples from vector addition to fused softmax and matrix multiplication." },
  { id: "cutlass", title: "CUTLASS overview", publisher: "NVIDIA", href: "https://docs.nvidia.com/cutlass/latest/overview.html", kind: "Documentation", level: "Advanced", topics: ["Kernel engineering"], description: "Explore the building blocks used to express tiled matrix operations and hardware-specific execution." },
  { id: "llama-cpp", title: "llama.cpp", publisher: "GGML contributors", href: "https://github.com/ggml-org/llama.cpp", kind: "Implementation", level: "Intermediate", topics: ["Quantization", "Inference & memory"], description: "Inspect a local inference engine and distinguish artifact representation from the software executing it." },
  { id: "vllm-parallelism", title: "vLLM parallelism and scaling", publisher: "vLLM contributors", href: "https://docs.vllm.ai/en/latest/serving/parallelism_scaling/", kind: "Documentation", level: "Intermediate", topics: ["Distributed inference"], description: "Connect model placement to tensor and pipeline parallelism, node boundaries and actual runtime settings." },
  { id: "nccl", title: "NCCL collective operations", publisher: "NVIDIA", href: "https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html", kind: "Documentation", level: "Advanced", topics: ["Distributed inference"], description: "Learn which communication operations move and combine data between accelerators." },
  { id: "deep-ep", title: "DeepEP", publisher: "DeepSeek", href: "https://github.com/deepseek-ai/DeepEP", kind: "Implementation", level: "Advanced", topics: ["Distributed inference"], description: "Inspect expert dispatch and combine communication in an implementation built for MoE workloads." },
  { id: "deepseek-v3", title: "DeepSeek-V3 Technical Report", publisher: "DeepSeek-AI", href: "https://arxiv.org/abs/2412.19437", kind: "Paper", level: "Advanced", topics: ["Distributed inference", "Quantization"], description: "Read a model and systems design together, including expert routing and its low-precision training approach." },
  { id: "rocm-profiler", title: "ROCm Compute Profiler", publisher: "AMD", href: "https://rocm.docs.amd.com/projects/rocprofiler-compute/en/latest/", kind: "Documentation", level: "Intermediate", topics: ["Profiling"], description: "Investigate AMD GPU workloads using architecture metrics and the profiler's analysis workflow." },
];

export interface StudyPath {
  slug: string;
  title: string;
  topic: StudyTopic;
  level: typeof STUDY_LEVELS[number];
  summary: string;
  outcome: string;
  prerequisites: string[];
  guides: string[];
  steps: { resourceId: string; focus: string }[];
  exercise: { title: string; prompt: string; deliverables: string[]; toolHref?: string; toolLabel?: string };
}

export const STUDY_PATHS: StudyPath[] = [
  { slug: "gpu-fundamentals", title: "Build a GPU mental model", topic: "GPU fundamentals", level: "Beginner", summary: "Understand the work a GPU executes and the memory it moves.", outcome: "Explain why high peak FLOPs do not guarantee fast token generation.", prerequisites: [], guides: ["model-checkpoint-artifact-runtime"], steps: [
    { resourceId: "inference-book", focus: "Separate prompt processing from token generation. What is read and reused in each phase?" },
    { resourceId: "cuda-guide", focus: "Map threads, blocks and the memory hierarchy to the operations you just identified." },
    { resourceId: "cuda-practices", focus: "Find how access patterns and data reuse change performance without changing the answer." },
  ], exercise: { title: "Explain one token's journey", prompt: "Draw the path from a prompt to a generated token. Mark weight reads, attention state and device memory movement.", deliverables: ["Separate prefill from decode.", "Name one possible memory bottleneck and one compute bottleneck.", "List the measurements you would need to tell them apart."] } },
  { slug: "inference-memory", title: "Account for inference memory", topic: "Inference & memory", level: "Beginner", summary: "Follow attention state from one request to a serving engine.", outcome: "Explain a memory failure even when the weight files appear to fit.", prerequisites: [], guides: ["memory-and-context", "choosing-runtime"], steps: [
    { resourceId: "transformer", focus: "Identify the attention inputs and how sequence length enters the computation." },
    { resourceId: "kv-cache", focus: "What is retained after a token is generated, and what grows as context grows?" },
    { resourceId: "inference-book", focus: "Separate weights, KV state and batching costs in a capacity estimate." },
    { resourceId: "paged-attention", focus: "Investigate how an engine manages cache allocation across requests." },
  ], exercise: { title: "Investigate an out-of-memory report", prompt: "Choose a model and write a memory budget for short and long prompts at concurrency one and four.", deliverables: ["Record weight bytes and cache assumptions separately.", "Identify what depends on model architecture and runtime.", "Keep actual peak memory separate from your estimate."], toolHref: "/docs/memory-and-context", toolLabel: "Open the memory guide" } },
  { slug: "quantization", title: "Compare quantized checkpoints", topic: "Quantization", level: "Intermediate", summary: "Investigate model capacity, conversion method and precision separately.", outcome: "Design a fair larger-model/lower-bpw versus smaller-model/higher-bpw comparison.", prerequisites: ["inference-memory"], guides: ["quantization", "dense-and-moe", "reading-model-repository"], steps: [
    { resourceId: "exl3-conversion", focus: "Which settings can make an EXL3 checkpoint's effective bitrate differ from its target?" },
    { resourceId: "gptq", focus: "Identify the calibration and optimization assumptions behind the reported result." },
    { resourceId: "awq", focus: "How does this method choose which weights need protection? Compare mechanisms, not just bit counts." },
    { resourceId: "llama-cpp", focus: "Check how an inference engine documents representations and execution support." },
  ], exercise: { title: "Investigate GLM versus Flash", prompt: "Compare regular GLM-5.3 at EXL3 2.75 bpw with GLM-5.3-Flash at 3 bpw. Start with the weight tradeoff, then design an experiment that could establish a task-quality winner.", deliverables: ["Pin each exact repository, revision, variant and conversion recipe.", "Record total parameters, actual file bytes and target/effective bpw separately.", "Use the same tasks, prompts, context and generation settings for quality tests.", "Measure speed with the same hardware and runtime; report assumptions and missing evidence."], toolHref: "/compare", toolLabel: "Open the comparison planner" } },
  { slug: "profiling", title: "Find the bottleneck with evidence", topic: "Profiling", level: "Intermediate", summary: "Move from a slow request to a timeline and a testable hypothesis.", outcome: "Distinguish a system wait from a kernel bottleneck and record a reproducible result.", prerequisites: ["gpu-fundamentals"], guides: ["choosing-runtime"], steps: [
    { resourceId: "cuda-practices", focus: "Choose a representative workload and define correctness before measuring a change." },
    { resourceId: "nsight-systems", focus: "Find where time goes across CPU work, transfers, kernels and synchronization." },
    { resourceId: "nsight-compute", focus: "Pick one kernel and test whether compute or memory movement limits it." },
    { resourceId: "rocm-profiler", focus: "Compare the profiling workflow for AMD hardware. Use the tool appropriate to your device." },
  ], exercise: { title: "Write a bottleneck report", prompt: "Profile one representative inference workload and change one setting that tests your hypothesis.", deliverables: ["Record hardware, software versions, precision and workload shape.", "Separate time to first token, decode latency and throughput.", "Include a baseline, repeated measurements and an output-correctness check."] } },
  { slug: "kernel-engineering", title: "Understand and build faster kernels", topic: "Kernel engineering", level: "Advanced", summary: "Connect executable exercises to tiling, fusion and attention memory access.", outcome: "Explain why a kernel improves performance and verify that it preserves the intended computation.", prerequisites: ["gpu-fundamentals", "profiling"], guides: ["nvfp4"], steps: [
    { resourceId: "triton", focus: "Start with vector addition, then compare unfused and fused softmax examples." },
    { resourceId: "cutlass", focus: "Identify tiling, layouts and data movement in the matrix-multiply building blocks." },
    { resourceId: "flash-attention", focus: "Trace the avoided memory traffic and distinguish exact attention from approximate methods." },
    { resourceId: "nsight-compute", focus: "Test your explanation with measured kernel behavior rather than peak hardware specifications." },
  ], exercise: { title: "Reproduce a kernel comparison", prompt: "Run one tutorial on supported hardware. Compare against a baseline with the same shape and precision.", deliverables: ["Validate outputs within an explicit numerical tolerance.", "Warm up and repeat measurements.", "Report speed with shape, dtype, hardware and baseline details."] } },
  { slug: "distributed-inference", title: "Reason about multi-GPU and MoE serving", topic: "Distributed inference", level: "Advanced", summary: "Account for placement, communication and expert routing.", outcome: "Explain why combined VRAM and active parameter count do not establish runtime performance.", prerequisites: ["inference-memory", "gpu-fundamentals"], guides: ["dense-and-moe", "choosing-runtime"], steps: [
    { resourceId: "vllm-parallelism", focus: "Separate tensor, pipeline and expert placement decisions from a combined-memory total." },
    { resourceId: "nccl", focus: "Identify the collectives your chosen parallel strategy needs." },
    { resourceId: "deepseek-v3", focus: "Read total versus active expert capacity as different properties of the model." },
    { resourceId: "deep-ep", focus: "Inspect where expert dispatch and combine introduce communication work." },
  ], exercise: { title: "Audit a multi-GPU setup", prompt: "Choose a model and sketch where its weights, cache and communication live across devices.", deliverables: ["Record per-device capacity and the actual interconnect topology.", "Name the runtime's supported parallel strategy for the exact artifact.", "List communication and workload assumptions before predicting speed."], toolHref: "/models", toolLabel: "Choose a model to investigate" } },
];

export const STUDY_INVESTIGATIONS = [
  { question: "Larger model or higher bpw?", summary: "Separate model scale from conversion fidelity in a GLM-versus-Flash comparison.", pathSlug: "quantization" },
  { question: "The weights fit. Why does inference fail?", summary: "Investigate cache growth, runtime buffers and request concurrency.", pathSlug: "inference-memory" },
  { question: "More GPUs, but little speedup?", summary: "Trace placement, expert routing and communication costs.", pathSlug: "distributed-inference" },
] as const;

export function studyResource(id: string): StudyResource | undefined { return STUDY_RESOURCES.find((resource) => resource.id === id); }
export function studyPath(slug: string): StudyPath | undefined { return STUDY_PATHS.find((path) => path.slug === slug); }

export interface ResourceFilters { query: string; topic: string; kind: string; level: string; unreadOnly?: boolean; }
export function filterStudyResources(resources: StudyResource[], filters: ResourceFilters, readIds: ReadonlySet<string> = new Set()): StudyResource[] {
  const terms = filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return resources.filter((resource) => {
    const text = `${resource.title} ${resource.publisher} ${resource.description} ${resource.topics.join(" ")}`.toLowerCase();
    return terms.every((term) => text.includes(term)) &&
      (!filters.topic || resource.topics.some((topic) => topic === filters.topic)) &&
      (!filters.kind || resource.kind === filters.kind) && (!filters.level || resource.level === filters.level) &&
      (!filters.unreadOnly || !readIds.has(resource.id));
  });
}

export function parseReadResources(raw: string): Set<string> {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return new Set();
    const allowed = new Set(STUDY_RESOURCES.map((resource) => resource.id));
    return new Set(value.filter((id): id is string => typeof id === "string" && allowed.has(id)));
  } catch { return new Set(); }
}
