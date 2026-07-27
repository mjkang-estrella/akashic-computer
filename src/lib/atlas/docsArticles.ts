export type DocInteractive =
  | "stack"
  | "moe"
  | "techniques"
  | "post-training"
  | "fine-tuning"
  | "memory"
  | "repository"
  | "runtimes";

export interface DocSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  interactive?: DocInteractive;
}

export interface DocSource {
  title: string;
  publisher: string;
  href: string;
}

export interface DocArticle {
  slug: string;
  category: "Foundations" | "Architecture" | "Weights" | "Deployment";
  title: string;
  summary: string;
  takeaway: string;
  readMinutes: number;
  updated: string;
  sections: DocSection[];
  sources: DocSource[];
  related: string[];
}

export const DOC_ARTICLES: DocArticle[] = [
  {
    slug: "model-checkpoint-artifact-runtime",
    category: "Foundations",
    title: "Model, checkpoint, artifact, runtime",
    summary:
      "A precise vocabulary for separating model identity from the files, software, and hardware used to run it.",
    takeaway:
      "A model name does not tell you which weights to download, which format they use, or which runtime can execute them.",
    readMinutes: 8,
    updated: "2026-07-24",
    sections: [
      {
        id: "why-layers",
        title: "Why the layers matter",
        paragraphs: [
          "Local-model failures are often classification errors before they are software errors. A person chooses a model, downloads a repository with a similar name, and expects any inference application to load it. That workflow collapses several independent decisions into one.",
          "A reliable setup separates five layers: model, checkpoint, artifact, runtime, and hardware. Each layer answers a different question and can change while the others remain fixed. Keeping them separate makes repository names, compatibility tables, and error messages much easier to interpret.",
        ],
        interactive: "stack",
      },
      {
        id: "model-and-checkpoint",
        title: "The model and the checkpoint",
        paragraphs: [
          "A model is the named system people discuss: its architecture family, training lineage, and intended behavior. A family can contain multiple releases, sizes, and variants. The model name is therefore a useful identity, but it is not yet a complete set of executable files.",
          "A checkpoint is a particular saved set of learned tensors plus the configuration needed to interpret them. Base, instruct, reasoning, coding, and distilled checkpoints may share an architecture while behaving differently. Even two repositories with the same parameter count can contain different checkpoints.",
        ],
        bullets: [
          "Family and release identify lineage.",
          "Parameter size identifies scale, not behavior.",
          "Variant identifies training intent such as base, instruct, or reasoning.",
          "A checkpoint fixes all of those choices into one saved state.",
        ],
      },
      {
        id: "artifact",
        title: "The artifact is the downloadable representation",
        paragraphs: [
          "An artifact is how a checkpoint is packaged for distribution and execution. The same checkpoint can be published as BF16 safetensors, an FP8 or NVFP4 conversion, several GGUF quantizations, or a runtime-specific engine. Those artifacts represent the same underlying model identity but have different memory, quality, and compatibility properties.",
          "Artifact provenance matters. The original model creator may publish the reference weights, while NVIDIA, Unsloth, or another provider publishes a conversion. A trustworthy conversion should identify its base model and method rather than relying only on a similar repository name.",
        ],
      },
      {
        id: "runtime-and-hardware",
        title: "The runtime and hardware finish the path",
        paragraphs: [
          "A runtime is the engine that interprets the artifact, allocates model and cache memory, selects kernels, and exposes an interface for generation. llama.cpp, vLLM, Transformers, and TensorRT-LLM overlap, but they do not support every architecture or quantization in the same way.",
          "Hardware is not just a VRAM number. GPU generation, CPU architecture, unified versus discrete memory, accelerator count, interconnects, and available kernels all affect whether a runtime path exists. Enough capacity can still produce an unsupported-operation error.",
        ],
      },
      {
        id: "diagnostic-order",
        title: "A practical diagnostic order",
        paragraphs: [
          "When a model does not load, verify identity before changing flags. Confirm the exact checkpoint, inspect the artifact metadata, check that the runtime documents support for that representation, and only then tune memory and serving settings.",
          "This order prevents a common waste of time: trying to solve an artifact or kernel incompatibility by reducing context length. Context tuning helps capacity problems; it cannot add support for a missing tensor layout or architecture.",
        ],
        bullets: [
          "Is this the intended checkpoint and variant?",
          "Is this a complete artifact or only an adapter?",
          "Does the runtime support this architecture and quantization?",
          "Does the hardware expose the required kernels?",
          "After compatibility is established, does the full runtime state fit?",
        ],
      },
    ],
    sources: [
      {
        title: "Model cards",
        publisher: "Hugging Face",
        href: "https://huggingface.co/docs/hub/en/model-cards",
      },
      {
        title: "Model release checklist",
        publisher: "Hugging Face",
        href: "https://huggingface.co/docs/hub/en/model-release-checklist",
      },
      {
        title: "llama.cpp",
        publisher: "GGML",
        href: "https://github.com/ggml-org/llama.cpp",
      },
    ],
    related: ["reading-model-repository", "choosing-runtime", "memory-and-context"],
  },
  {
    slug: "dense-and-moe",
    category: "Architecture",
    title: "Dense models and mixture of experts",
    summary:
      "How expert routing changes the relationship between total parameters, active parameters, memory, and compute.",
    takeaway:
      "Active parameters can reduce per-token computation, but total parameters still determine how much weight data must be stored or distributed.",
    readMinutes: 9,
    updated: "2026-07-24",
    sections: [
      {
        id: "dense",
        title: "The dense path",
        paragraphs: [
          "In a conventional dense transformer, each token passes through the same feed-forward parameters in every layer. The exact activation values differ by token, but the available weights are not selected from a larger bank of independent experts.",
          "This makes parameter count comparatively direct: a 70B dense model stores roughly 70 billion parameters, and most of the model participates in each token's forward pass. Precision determines the weight payload, while context and runtime state add memory beyond those weights.",
        ],
      },
      {
        id: "routing",
        title: "What MoE routing changes",
        paragraphs: [
          "A mixture-of-experts layer replaces one dense feed-forward block with multiple expert blocks and a router. For each token, the router scores the experts and sends the token to a selected subset. The selected outputs are combined using routing weights.",
          "Routing is dynamic. Two tokens in the same prompt may activate different experts, and one expert can receive more traffic than another. Implementations therefore need both correct routing logic and efficient grouped expert computation.",
        ],
        interactive: "moe",
      },
      {
        id: "counts",
        title: "Total and active parameters answer different questions",
        paragraphs: [
          "Total parameters describe the complete stored checkpoint. Active parameters approximate how much of that parameter bank is used for one token. A model described as 235B total and 22B active still needs access to the 235B checkpoint, even though each token uses a much smaller route.",
          "Active count is not a universal speed predictor. Attention layers, routing overhead, expert balance, memory movement, batch shape, and kernel quality remain important. It is best treated as an architecture property rather than a promise of dense-model-equivalent performance.",
        ],
      },
      {
        id: "memory",
        title: "Memory and distribution",
        paragraphs: [
          "Because all experts must be available, a large MoE checkpoint may not fit on hardware that easily runs a dense model with a similar active count. Multi-device runtimes can shard experts, but that introduces communication and placement decisions.",
          "Expert parallelism can place different experts on different devices. Tensor parallelism can split computations within layers. The best topology depends on the model architecture, runtime, interconnect, and request pattern; the label MoE alone does not choose it.",
        ],
      },
      {
        id: "reading-specs",
        title: "How to read an MoE specification",
        paragraphs: [
          "Look for both total and active parameter counts, the number of routed experts, the number selected per token, and whether shared experts are always active. Then inspect the runtime's support for that architecture rather than assuming generic MoE support is enough.",
          "When only one parameter number is shown, verify whether it is total or active before estimating memory. Akashic displays the total count first and the active count in parentheses to preserve that distinction.",
        ],
        bullets: [
          "Total parameters: stored capacity.",
          "Active parameters: approximate routed compute per token.",
          "Experts per layer: size of the routing pool.",
          "Top-k: number of routed experts selected per token.",
          "Shared experts: dense expert paths that may run for every token.",
        ],
      },
    ],
    sources: [
      {
        title: "Experts backends",
        publisher: "Hugging Face Transformers",
        href: "https://huggingface.co/docs/transformers/experts_interface",
      },
      {
        title: "Switch Transformers",
        publisher: "Journal of Machine Learning Research",
        href: "https://arxiv.org/abs/2101.03961",
      },
    ],
    related: ["memory-and-context", "choosing-runtime", "model-checkpoint-artifact-runtime"],
  },
  {
    slug: "post-training",
    category: "Weights",
    title: "The post-training pipeline",
    summary:
      "How continued pretraining, supervised fine-tuning, preference optimization, and reward-driven training turn a base model into a usable release.",
    takeaway:
      "Post-training is not one algorithm; it is a sequence of data and optimization decisions that changes what a pretrained model does.",
    readMinutes: 13,
    updated: "2026-07-24",
    sections: [
      {
        id: "after-pretraining",
        title: "What happens after pretraining",
        paragraphs: [
          "Pretraining teaches a model to predict tokens across a broad corpus. That objective can produce strong language and world representations, but it does not by itself define how the model should answer instructions, refuse unsafe requests, call tools, expose reasoning, or follow a conversation template.",
          "Post-training is the collection of training stages used to shape those behaviors after the foundation checkpoint exists. The stages can include continued pretraining, supervised fine-tuning, preference optimization, reward modeling, online reinforcement learning, distillation, safety tuning, and targeted capability training.",
          "Not every release uses every stage, and the order can vary. The important discipline is to record which checkpoint entered each stage, what data or reward signal was used, and which evaluations guarded the transition to the next stage.",
        ],
        interactive: "post-training",
      },
      {
        id: "continued-pretraining",
        title: "Continued pretraining changes the domain distribution",
        paragraphs: [
          "Continued pretraining uses the original next-token objective on additional raw text, code, or multimodal data. It can add domain vocabulary and patterns before instruction behavior is introduced. Code, mathematics, medicine, law, and additional languages are common targets.",
          "This stage is not the same as instruction tuning. The examples do not need to be conversations or demonstrations; they can resemble the unstructured data used during foundation training. A model can become more knowledgeable about a domain without becoming better at following a user's request.",
          "Data balance matters because a narrow continuation can shift or forget capabilities learned earlier. Teams often mix replay data from the original distribution with new domain data and evaluate general capabilities throughout the run.",
        ],
      },
      {
        id: "sft",
        title: "Supervised fine-tuning teaches demonstrations",
        paragraphs: [
          "Supervised fine-tuning, usually shortened to SFT, trains the model to imitate target completions. Each example pairs an input or conversation with the response the model should produce. This is where a base model commonly learns instruction following, response structure, chat roles, tool-call syntax, and domain-specific workflows.",
          "The model learns every token included in the target unless the loss mask says otherwise. Dataset formatting is therefore part of the objective. Training on boilerplate, hidden metadata, malformed tool schemas, or inconsistent assistant styles can make those patterns part of the model's behavior.",
          "Quality is not simply the number of examples. A smaller, coherent set of accurate demonstrations can outperform a large mixture with conflicting instructions. Coverage, diversity, duplication, answer quality, and the ratio between easy and difficult examples all affect the result.",
        ],
      },
      {
        id: "preferences",
        title: "Preference optimization changes relative behavior",
        paragraphs: [
          "Preference data compares candidate responses rather than supplying one canonical answer. A record may contain a prompt, a preferred completion, and a rejected completion. Offline methods such as DPO optimize the policy using those comparisons without running a separate reward model during deployment.",
          "Preference optimization can improve helpfulness, style, safety, and instruction adherence, but the preference source defines the direction. Human labels, synthetic judges, and rule-based comparisons have different biases. If the data rewards verbosity, confident tone, or a particular answer format, the model can optimize those proxies.",
          "Preference training usually starts from an SFT checkpoint because a model needs a reasonable response distribution before fine distinctions become useful. Treat it as refinement, not a replacement for foundational demonstrations.",
        ],
      },
      {
        id: "online-reward",
        title: "Online reward training learns from generated rollouts",
        paragraphs: [
          "Online methods generate responses from the current policy during training, score those rollouts, and update the model toward higher reward. The reward may come from a learned model, a human, a compiler, a mathematical verifier, an environment, or a combination of signals.",
          "Verifiable tasks are attractive because the reward can be grounded in whether code runs, a proof checks, or an answer matches a known solution. Even then, reward design is not neutral. A model can exploit incomplete tests, formatting shortcuts, or weaknesses in the evaluator.",
          "Algorithms such as GRPO organize and normalize rewards differently from classic PPO-style RLHF, but the operational questions remain: how completions are sampled, how reward is computed, how far the policy may move, and how regressions are detected.",
        ],
      },
      {
        id: "evaluation",
        title: "Evaluation is part of training, not a final ceremony",
        paragraphs: [
          "Every post-training stage can trade one capability for another. SFT can narrow the response distribution, preference optimization can overfit style, and reward training can exploit the scorer. Held-out evaluations should therefore run between stages, not only after the final checkpoint.",
          "Use separate datasets for training, development, and final evaluation. Check contamination and near-duplicates. Evaluate the base checkpoint and each major intermediate so a regression can be attributed to the stage that introduced it.",
          "A release should document the full lineage: base model, intermediate checkpoints, data categories, chat template, optimization method, evaluation settings, and final artifact conversions. Benchmark scores from the base model or teacher do not automatically apply to the post-trained result.",
        ],
        bullets: [
          "Capability: did the target skill improve?",
          "Retention: which general abilities regressed?",
          "Behavior: are format, tone, and tool calls correct?",
          "Safety: did refusal and misuse behavior change?",
          "Operations: does the checkpoint still load and serve reliably?",
          "Provenance: can the release be traced to exact inputs and revisions?",
        ],
      },
    ],
    sources: [
      {
        title: "TRL post-training library",
        publisher: "Hugging Face",
        href: "https://huggingface.co/docs/trl/en/index",
      },
      {
        title: "TRL quickstart",
        publisher: "Hugging Face",
        href: "https://huggingface.co/docs/trl/quickstart",
      },
      {
        title: "GRPO trainer",
        publisher: "Hugging Face TRL",
        href: "https://huggingface.co/docs/trl/grpo_trainer",
      },
    ],
    related: ["fine-tuning", "distillation", "quantization"],
  },
  {
    slug: "fine-tuning",
    category: "Weights",
    title: "Fine-tuning, LoRA, and QLoRA",
    summary:
      "How full-parameter and parameter-efficient tuning update a model, what an adapter contains, and how training choices affect deployment.",
    takeaway:
      "LoRA reduces the parameters and optimizer state you train; it does not remove the need for a compatible base model, activations, careful data, or independent evaluation.",
    readMinutes: 14,
    updated: "2026-07-24",
    sections: [
      {
        id: "what-fine-tuning-is",
        title: "Fine-tuning updates a pretrained model",
        paragraphs: [
          "Fine-tuning continues gradient-based training from an existing checkpoint using a narrower objective or dataset. It can teach a task, domain, response format, language, style, tool protocol, or preference. Supervised instruction tuning is one common form of fine-tuning, but the term also includes continued task training and adapter-based updates.",
          "The starting checkpoint matters as much as the method. Fine-tuning a base model and fine-tuning an instruct model do not begin from the same behavior. The tokenizer, chat template, license, context configuration, and architecture of the selected revision become dependencies of the result.",
        ],
        interactive: "fine-tuning",
      },
      {
        id: "full-versus-peft",
        title: "Full-parameter tuning versus PEFT",
        paragraphs: [
          "Full fine-tuning computes updates for every model parameter. It offers maximum freedom to change the model but requires gradient storage, optimizer state, activations, and a complete output checkpoint. The optimizer state alone can be several times larger than the inference weights depending on precision and optimizer.",
          "Parameter-efficient fine-tuning, or PEFT, freezes most base weights and trains a much smaller set of added or selected parameters. This lowers optimizer-state and checkpoint-storage costs. It can also make it practical to maintain several specialized adapters over one shared base model.",
          "PEFT is not automatically equal to full tuning for every task. The needed behavior change, adapter placement, rank, dataset, and optimization settings determine whether the restricted update space is sufficient.",
        ],
      },
      {
        id: "lora",
        title: "LoRA learns low-rank weight updates",
        paragraphs: [
          "LoRA freezes an existing weight matrix and learns a low-rank update represented by two smaller matrices. During inference, the update can be applied alongside the base matrix or merged into a copy of the base checkpoint.",
          "The rank controls the dimensionality of the learned update, while target modules determine where adapters are inserted. Rank, scaling, dropout, target layers, and which modules remain fully trainable are model and task choices rather than universal defaults.",
          "An adapter file is not a standalone model. It must identify the exact base model and revision whose tensor names and shapes it expects. Loading an adapter onto a merely similar checkpoint can fail or silently produce incorrect behavior.",
        ],
      },
      {
        id: "qlora",
        title: "QLoRA reduces the base-weight training footprint",
        paragraphs: [
          "QLoRA keeps the base model frozen in a quantized representation while training LoRA adapters. This reduces the memory occupied by base weights during training and enables adapter tuning of models that would be difficult to hold at full precision.",
          "The forward and backward passes still require activations and higher-precision computation in selected places. QLoRA therefore does not make training memory equal to the adapter file size. Sequence length, batch size, gradient accumulation, activation checkpointing, optimizer choice, and distributed strategy remain major factors.",
          "The output is normally an adapter tied to the original base checkpoint. Merging may require materializing a higher-precision base and should be treated as a new artifact with its own size, provenance, and evaluation.",
        ],
      },
      {
        id: "data-format",
        title: "Training data and loss masks define the behavior",
        paragraphs: [
          "Fine-tuning examples must use the tokenizer and prompt format expected by the model. For chat models, that usually means applying the correct chat template rather than manually concatenating role labels. Tool-use data must preserve the exact schema and turn boundaries used at inference time.",
          "Loss masking determines which tokens contribute to the update. Training only on assistant tokens differs from training on the full conversation. Padding, packing multiple examples, truncation, and end-of-sequence handling can also change what the model learns.",
          "Before a long run, inspect tokenized examples rather than only the source JSON. Decode representative batches, verify masks, measure length distributions, and confirm that no answer is accidentally truncated or exposed in the prompt.",
        ],
      },
      {
        id: "optimization",
        title: "Optimization choices interact",
        paragraphs: [
          "Learning rate, effective batch size, sequence length, warmup, scheduler, weight decay, number of epochs, adapter rank, and data mixture cannot be tuned independently. A larger effective batch can change the useful learning-rate range; longer packed sequences can alter example balance.",
          "Track training and validation loss, but do not use loss as the sole decision rule. A lower loss can accompany worse instruction behavior or stronger memorization. Save intermediate checkpoints so behavioral evaluations can identify an earlier, better stopping point.",
          "For LoRA, report the target modules, rank, alpha or scaling rule, dropout, trainable parameter count, base revision, and whether additional modules were saved. Without those fields, another person cannot reproduce or correctly load the adapter.",
        ],
      },
      {
        id: "release",
        title: "Evaluate and package the tuned result",
        paragraphs: [
          "Compare the tuned model with its exact base checkpoint on target tasks and retention tests. Use the same inference template and decoding settings. Add adversarial or out-of-domain tests so specialization does not hide a broad regression.",
          "Release adapters and merged checkpoints as different artifacts. The adapter should carry structured base_model metadata. A merged checkpoint should explain the merge precision and whether it was quantized afterward. Neither should inherit the base model's benchmark results without measurement.",
          "Deployment support must also be verified. Some runtimes can load LoRA adapters dynamically, while others require a merge or support only specific target modules. Runtime compatibility is part of the release evidence, not an assumption based on the file extension.",
        ],
        bullets: [
          "Pin the base model repository and revision.",
          "Publish tokenizer and chat-template dependencies.",
          "Record training method, data categories, and loss masking.",
          "Report adapter configuration and trainable parameter count.",
          "Evaluate target improvement and capability retention.",
          "Separate adapter, merged, and quantized artifacts.",
        ],
      },
    ],
    sources: [
      {
        title: "LoRA conceptual guide",
        publisher: "Hugging Face PEFT",
        href: "https://huggingface.co/docs/peft/main/conceptual_guides/lora",
      },
      {
        title: "LoRA configuration and QLoRA-style training",
        publisher: "Hugging Face PEFT",
        href: "https://huggingface.co/docs/peft/main/package_reference/lora",
      },
      {
        title: "LoRA: Low-Rank Adaptation",
        publisher: "Hu et al.",
        href: "https://arxiv.org/abs/2106.09685",
      },
      {
        title: "QLoRA: Efficient Finetuning of Quantized LLMs",
        publisher: "Dettmers et al.",
        href: "https://arxiv.org/abs/2305.14314",
      },
    ],
    related: ["post-training", "distillation", "reading-model-repository"],
  },
  {
    slug: "distillation",
    category: "Weights",
    title: "Knowledge distillation",
    summary:
      "What a student model learns from a teacher, what is actually transferred, and why a distilled model is a new checkpoint.",
    takeaway:
      "Distillation transfers behavior through training; it does not simply compress the teacher's weight file.",
    readMinutes: 8,
    updated: "2026-07-24",
    sections: [
      {
        id: "definition",
        title: "Distillation is a training process",
        paragraphs: [
          "Knowledge distillation trains a student model using signals produced by a teacher model. The teacher may provide probability distributions, generated answers, reasoning traces, rankings, or other supervision. The student updates its own parameters to reproduce useful aspects of that behavior.",
          "The resulting student is a new checkpoint. It may be smaller than the teacher, use a different architecture, or begin from another pretrained model. The teacher's weights are not numerically converted into the student.",
        ],
        interactive: "techniques",
      },
      {
        id: "signals",
        title: "What can be transferred",
        paragraphs: [
          "Classic distillation uses softened output probabilities because they contain relationships that one-hot labels discard. Modern language-model distillation often uses generated sequences, preference signals, tool traces, or synthetic tasks because full teacher logits may not be available.",
          "The supervision source affects what the student learns. Distilling final answers can improve task behavior without transferring the teacher's internal process. Distilling long reasoning traces may teach a visible style without reproducing the same latent computation.",
        ],
      },
      {
        id: "size",
        title: "A distilled model is not always tiny",
        paragraphs: [
          "Distillation is commonly associated with a small student, but size reduction is a design choice rather than the definition. A large student can be distilled to improve a capability, align behavior, or inherit a teacher's response distribution.",
          "Repository names that include Distill should therefore be read as lineage claims. You still need the student's own parameter count, architecture, license, tokenizer, and runtime support.",
        ],
      },
      {
        id: "versus",
        title: "Distillation versus quantization and fine-tuning",
        paragraphs: [
          "Quantization changes how an existing checkpoint's numerical values are represented. Fine-tuning updates a model using task or instruction data. Distillation is a kind of training distinguished by the teacher-generated signal.",
          "These techniques can be composed. A student can be distilled, fine-tuned, and then quantized for deployment. The final artifact should preserve that lineage so users can tell which model was trained and which representation was produced later.",
        ],
      },
      {
        id: "evaluation",
        title: "Evaluate the student as its own model",
        paragraphs: [
          "A distilled model should not inherit the teacher's benchmark results. It needs its own evaluation because capacity, data selection, training objective, tokenizer, and decoding behavior can all change the outcome.",
          "The meaningful comparison is task-specific: student versus teacher under compatible settings, and student versus other models with similar deployment cost. A single average score can hide capabilities that transferred well and capabilities that did not.",
        ],
      },
    ],
    sources: [
      {
        title: "Distilling the Knowledge in a Neural Network",
        publisher: "Hinton, Vinyals, and Dean",
        href: "https://arxiv.org/abs/1503.02531",
      },
      {
        title: "Sequence-Level Knowledge Distillation",
        publisher: "Kim and Rush",
        href: "https://arxiv.org/abs/1606.07947",
      },
    ],
    related: ["post-training", "fine-tuning", "quantization"],
  },
  {
    slug: "quantization",
    category: "Weights",
    title: "Quantization without the shorthand",
    summary:
      "How lower-precision representations use scales and groups, why 4-bit formats differ, and what quality claims require.",
    takeaway:
      "Bit width is only one property of a quantization; method, granularity, calibration, tensor exceptions, and runtime kernels also matter.",
    readMinutes: 11,
    updated: "2026-07-24",
    sections: [
      {
        id: "representation",
        title: "Quantization changes representation",
        paragraphs: [
          "Neural-network weights are usually trained in floating-point formats with more precision than many inference workloads require. Quantization maps those values into a smaller representable set and stores enough scaling information to approximately reconstruct useful computation.",
          "A simple memory estimate multiplies parameter count by bits per parameter. Real artifacts add scales, zero points, metadata, padding, higher-precision tensors, and sometimes runtime-specific layouts. The bit label is therefore a starting point, not an exact file-size contract.",
        ],
        interactive: "memory",
      },
      {
        id: "scales",
        title: "Scales, groups, and granularity",
        paragraphs: [
          "A quantizer needs a mapping between original values and the lower-precision grid. One scale for an entire tensor is cheap but can lose detail when value ranges differ. Per-channel or per-group scaling uses more metadata to adapt the mapping locally.",
          "Smaller groups can reduce quantization error but increase scale overhead and kernel complexity. Symmetric and asymmetric mappings also differ: asymmetric methods may store a zero point in addition to a scale.",
        ],
      },
      {
        id: "methods",
        title: "INT4, AWQ, GPTQ, and GGUF are not synonyms",
        paragraphs: [
          "INT4 describes a numerical payload class. AWQ and GPTQ describe quantization approaches and checkpoint conventions. GGUF is a container format used by llama.cpp ecosystems and can hold many quantization types, including several 4-bit layouts.",
          "A runtime that supports one 4-bit path does not automatically support every other path. The tensor packing and kernels must match. This is why repository format, quantization method, and runtime support should be recorded separately.",
        ],
      },
      {
        id: "ptq-qat",
        title: "Post-training and quantization-aware paths",
        paragraphs: [
          "Post-training quantization starts from an already trained checkpoint. Some methods only inspect weights; others use calibration data to observe activations or optimize reconstruction. It is the most common path for provider-published inference artifacts.",
          "Quantization-aware training simulates quantization during training so the model can adapt. It requires more work but can improve low-bit behavior. A repository should state which path produced the artifact because the same nominal bit width can have different results.",
        ],
      },
      {
        id: "quality",
        title: "How to evaluate a quantized artifact",
        paragraphs: [
          "Do not assume a fixed quality loss for a bit width. Measure the actual artifact against its reference checkpoint using the same prompts, chat template, decoding settings, and evaluation harness. Report missing measurements as missing rather than inferring a universal delta.",
          "Perplexity can reveal distribution changes, but downstream benchmarks and workload-specific tests remain important. Runtime stability and speed are also separate outcomes: a quality-preserving artifact is not useful if its execution path is unsupported or slower on the target hardware.",
        ],
      },
    ],
    sources: [
      {
        title: "Quantization concepts",
        publisher: "Hugging Face Transformers",
        href: "https://huggingface.co/docs/transformers/quantization/concept_guide",
      },
      {
        title: "Quantization overview",
        publisher: "Hugging Face Transformers",
        href: "https://huggingface.co/docs/transformers/quantization/overview",
      },
      {
        title: "Quantized inference",
        publisher: "vLLM",
        href: "https://docs.vllm.ai/en/latest/features/quantization/",
      },
    ],
    related: ["fine-tuning", "nvfp4", "memory-and-context"],
  },
  {
    slug: "nvfp4",
    category: "Weights",
    title: "NVFP4 and block-scaled 4-bit inference",
    summary:
      "What NVFP4 stores, where the extra half-bit estimate comes from, and why Blackwell support is more than VRAM capacity.",
    takeaway:
      "NVFP4 combines 4-bit values with block-level scaling metadata and depends on a supported NVIDIA software and hardware path.",
    readMinutes: 9,
    updated: "2026-07-24",
    sections: [
      {
        id: "format",
        title: "A 4-bit floating-point payload",
        paragraphs: [
          "NVFP4 represents quantized values with NVIDIA's 4-bit floating-point format and applies scales over small blocks. The scale lets each block use the limited FP4 value range more effectively than a single scale for a large tensor.",
          "The practical representation is therefore not exactly four bits per original parameter. A useful planning approximation adds the block-scale overhead, while still acknowledging that global scales, alignment, metadata, and tensors left at higher precision affect the final artifact.",
        ],
        interactive: "memory",
      },
      {
        id: "half-bit",
        title: "Why estimates often use about 4.5 bits",
        paragraphs: [
          "With one 8-bit scale for a block of sixteen 4-bit values, the scale contributes roughly half a bit per value: eight scale bits divided across sixteen values. That produces a convenient 4.5-bit payload estimate before other exceptions.",
          "This is a capacity heuristic, not a format specification for every file in a repository. Inspect the quantization configuration and actual shard sizes when precision matters.",
        ],
      },
      {
        id: "hardware",
        title: "The hardware path matters",
        paragraphs: [
          "NVFP4 is designed around supported NVIDIA hardware and kernels, particularly Blackwell-class acceleration paths. A GPU with enough memory but no compatible native or emulated execution path may fail to load the artifact or run it inefficiently.",
          "Compatibility requires alignment across checkpoint metadata, runtime version, CUDA and kernel support, and hardware capability. Provider documentation should identify the expected serving stack rather than presenting NVFP4 as a universally portable 4-bit file.",
        ],
      },
      {
        id: "exceptions",
        title: "Not every tensor must remain at four bits",
        paragraphs: [
          "Low-bit checkpoints commonly preserve sensitive layers, scales, embeddings, normalization data, or output heads at higher precision. These exceptions can improve quality and numerical stability.",
          "As a result, two NVFP4 artifacts of the same base model may have different file sizes or benchmark behavior. The provider's conversion recipe and runtime layout are part of the artifact identity.",
        ],
      },
      {
        id: "compare",
        title: "How to compare NVFP4 artifacts",
        paragraphs: [
          "First confirm that both artifacts derive from the same base checkpoint and variant. Then compare artifact size, supported runtimes, measured quality against the BF16 reference, prompt-processing speed, decode speed, and maximum stable context under the same hardware conditions.",
          "A provider label is provenance, not proof of equivalent behavior. Prefer immutable repository revisions and structured benchmark evidence so later model or runtime updates do not silently change the comparison.",
        ],
      },
    ],
    sources: [
      {
        title: "NVFP4 quantization configuration",
        publisher: "NVIDIA Nemotron",
        href: "https://docs.nvidia.com/nemotron/nightly/train-models/reference/optimize/quantize.html",
      },
      {
        title: "Quantization concepts",
        publisher: "Hugging Face Transformers",
        href: "https://huggingface.co/docs/transformers/quantization/concept_guide",
      },
    ],
    related: ["quantization", "memory-and-context", "choosing-runtime"],
  },
  {
    slug: "memory-and-context",
    category: "Deployment",
    title: "Model memory, KV cache, and context",
    summary:
      "A practical memory model that separates weight payload from cache, temporary buffers, concurrency, and runtime headroom.",
    takeaway:
      "Weight memory answers whether loading is plausible; context and concurrency determine how much memory remains while serving.",
    readMinutes: 10,
    updated: "2026-07-24",
    sections: [
      {
        id: "weights",
        title: "Start with the weight payload",
        paragraphs: [
          "The simplest lower bound is parameter count multiplied by effective bits per parameter. Convert bytes to GiB carefully: model names use decimal billions, while memory tools often report binary GiB.",
          "This estimate is most useful for rejecting impossible configurations. It is not enough to certify a runnable setup because scales, tensor exceptions, allocator behavior, and runtime workspaces add memory.",
        ],
        interactive: "memory",
      },
      {
        id: "runtime-state",
        title: "Loading creates more than weights",
        paragraphs: [
          "A runtime may allocate temporary buffers, compiled graphs, communication workspaces, logits, sampling state, and duplicated structures. Some loaders briefly require extra host or device memory while converting or materializing tensors.",
          "Planning headroom protects against these costs, but no single percentage is universal. The estimator above uses a visible 15 percent loading floor so the assumption is explicit rather than hidden inside a fit badge.",
        ],
      },
      {
        id: "kv-cache",
        title: "KV cache grows with tokens and requests",
        paragraphs: [
          "Autoregressive decoding stores attention keys and values for tokens that have already been processed. This KV cache avoids recomputing the entire prefix for every new token, but its memory grows with context length, layer structure, cache precision, batch size, and concurrent sequences.",
          "Grouped-query and multi-query attention can reduce cache size by using fewer key-value heads. Some runtimes can quantize the cache. Those architecture and runtime choices are why two models with similar parameter counts can support very different serving shapes.",
        ],
      },
      {
        id: "context",
        title: "Advertised context is not a free allocation",
        paragraphs: [
          "A model may be trained or configured for a long context window, but allocating the maximum can leave too little memory for concurrency or even prevent startup. Practical context is a serving decision constrained by the workload.",
          "For interactive use, one long sequence may be acceptable. For an API, several shorter concurrent requests can consume more total cache. The correct setting comes from expected prompt length, output length, concurrency, and latency goals.",
        ],
      },
      {
        id: "procedure",
        title: "A capacity-planning procedure",
        paragraphs: [
          "Choose the exact artifact and runtime first. Estimate the weight floor, reserve runtime headroom, then select an initial context and concurrency below the advertised maximum. Measure peak memory during prefill and decode rather than relying only on idle usage.",
          "Increase one dimension at a time. When a run fails, record whether it failed during loading, prefill, or decoding. Those stages point to different causes and prevent a generic out-of-memory label from erasing useful evidence.",
        ],
        bullets: [
          "Weights: mostly fixed after loading.",
          "KV cache: grows with tokens and live sequences.",
          "Workspaces: depend on runtime and kernels.",
          "Concurrency: multiplies request state.",
          "Headroom: protects against peaks and allocator fragmentation.",
        ],
      },
    ],
    sources: [
      {
        title: "KV cache",
        publisher: "Hugging Face Transformers",
        href: "https://huggingface.co/docs/transformers/kv_cache",
      },
      {
        title: "Memory optimization",
        publisher: "vLLM",
        href: "https://docs.vllm.ai/en/latest/configuration/optimization/",
      },
    ],
    related: ["quantization", "nvfp4", "dense-and-moe"],
  },
  {
    slug: "reading-model-repository",
    category: "Deployment",
    title: "How to read a model repository",
    summary:
      "A file-by-file method for checking lineage, completeness, configuration, weights, tokenizer, license, and evaluation evidence.",
    takeaway:
      "Treat the repository as evidence: verify structured metadata and a complete weight set before trusting the name or README prose.",
    readMinutes: 12,
    updated: "2026-07-24",
    sections: [
      {
        id: "card",
        title: "Begin with the model card, but do not stop there",
        paragraphs: [
          "On the Hugging Face Hub, the README is rendered as a model card. It should explain intended use, limitations, training information, datasets, license, and evaluation results. Its YAML metadata can also identify the task, library, language, and base model.",
          "The model card is publisher-provided documentation rather than an independent audit. Prefer claims that identify an evaluation method, runtime settings, and source. When prose conflicts with structured files, investigate before downloading.",
        ],
        interactive: "repository",
      },
      {
        id: "config",
        title: "Read configuration as architecture evidence",
        paragraphs: [
          "For Transformers checkpoints, config.json commonly identifies the architecture class, hidden dimensions, layer counts, attention layout, context configuration, expert routing, and quantization metadata. These fields help a runtime decide which implementation to construct.",
          "Configuration is necessary but not sufficient for compatibility. A runtime may recognize the architecture name while lacking a kernel for the checkpoint's quantization or a newer configuration option.",
        ],
      },
      {
        id: "weights",
        title: "Confirm a complete set of weights",
        paragraphs: [
          "Large checkpoints are often split into multiple safetensors shards with an index that maps tensor names to files. A complete artifact needs every referenced shard. File size should be plausible for the parameter count and representation.",
          "Adapters, LoRA repositories, and intermediate checkpoints may contain only deltas or training state. Look for structured base_model metadata and adapter configuration before assuming a small repository is a miraculous full model.",
        ],
      },
      {
        id: "tokenizer",
        title: "Tokenizer and chat template are executable configuration",
        paragraphs: [
          "The tokenizer defines how text becomes token IDs and which special tokens mark roles or boundaries. Instruct models also depend on a chat template that serializes system, user, assistant, tool, and reasoning turns into the expected token sequence.",
          "A checkpoint can load successfully and still produce poor results when paired with the wrong tokenizer or template. Preserve the files published with the selected variant unless the model documentation explicitly specifies another source.",
        ],
      },
      {
        id: "provenance",
        title: "Verify lineage and revision",
        paragraphs: [
          "For a quantized or fine-tuned artifact, inspect the structured base model reference and publisher identity. Record the repository revision or commit SHA when reproducibility matters because files and model cards can change under the same URL.",
          "License and access terms can differ between a base model and a derived artifact. Verify both rather than assuming the provider's repository replaces the upstream conditions.",
        ],
        bullets: [
          "Repository owner and canonical model identity.",
          "Structured base_model lineage for derived artifacts.",
          "Complete weight shards and index.",
          "Architecture and quantization configuration.",
          "Matching tokenizer and chat template.",
          "License, access restrictions, and immutable revision.",
        ],
      },
    ],
    sources: [
      {
        title: "Model cards",
        publisher: "Hugging Face",
        href: "https://huggingface.co/docs/hub/en/model-cards",
      },
      {
        title: "Model release checklist",
        publisher: "Hugging Face",
        href: "https://huggingface.co/docs/hub/en/model-release-checklist",
      },
      {
        title: "Repository cards",
        publisher: "Hugging Face Hub",
        href: "https://huggingface.co/docs/huggingface_hub/main/package_reference/cards",
      },
    ],
    related: ["fine-tuning", "model-checkpoint-artifact-runtime", "quantization"],
  },
  {
    slug: "choosing-runtime",
    category: "Deployment",
    title: "Choosing a local inference runtime",
    summary:
      "How to choose between desktop applications, portable engines, and GPU serving stacks without treating them as interchangeable wrappers.",
    takeaway:
      "Choose the runtime after the artifact, hardware, and workload are known; convenience and throughput are different optimization targets.",
    readMinutes: 10,
    updated: "2026-07-24",
    sections: [
      {
        id: "layers",
        title: "Application and engine are different layers",
        paragraphs: [
          "LM Studio and Ollama provide product-level workflows for acquiring, configuring, and exposing local models. llama.cpp, vLLM, and TensorRT-LLM are inference engines or stacks with different execution models. An application may use an engine internally without exposing all of its controls.",
          "This distinction explains why two tools can run the same GGUF artifact but offer different configuration, APIs, logging, and update behavior. It also explains why a model supported by an underlying engine may not yet appear in an application's managed catalog.",
        ],
        interactive: "runtimes",
      },
      {
        id: "artifact-first",
        title: "Start from artifact compatibility",
        paragraphs: [
          "GGUF points naturally toward llama.cpp-based paths. Hugging Face safetensors and supported quantization configurations often point toward Transformers, vLLM, SGLang, or TensorRT-LLM. Runtime-specific engines may require conversion or compilation.",
          "Do not convert first and investigate later. Confirm that the runtime supports the model architecture, quantization method, tokenizer behavior, and target hardware before downloading a very large artifact.",
        ],
      },
      {
        id: "workload",
        title: "Interactive use and serving optimize different things",
        paragraphs: [
          "A desktop application prioritizes setup, inspection, and a direct chat workflow. A serving engine prioritizes batching, cache management, concurrency, observability, and an API contract. Both can be local, but they solve different operational problems.",
          "For one user exploring models, a simple managed workflow may be the right choice. For an application with concurrent requests, measure aggregate throughput, time to first token, per-request latency, and failure behavior under load.",
        ],
      },
      {
        id: "hardware",
        title: "Hardware support means usable kernels",
        paragraphs: [
          "A runtime can advertise a quantization name while supporting it only on specific GPU generations or through a fallback path. Native kernels, compiler versions, and architecture-specific implementations determine practical speed and stability.",
          "Multi-GPU support is similarly broad. Tensor parallelism, pipeline parallelism, expert parallelism, and CPU offload have different communication patterns. Confirm the exact topology rather than relying on a generic multi-GPU label.",
        ],
      },
      {
        id: "decision",
        title: "A runtime decision checklist",
        paragraphs: [
          "Choose the narrowest runtime that satisfies the intended workload, then test the exact artifact. A successful startup is only a smoke test; verify prompt formatting, output quality, memory peaks, prompt-processing speed, decode speed, and shutdown or restart behavior.",
          "Keep model data and runtime state separate. Checkpoints should remain immutable inputs, while logs, caches, compiled engines, and server configuration belong to operational directories that can be replaced without changing model provenance.",
        ],
        bullets: [
          "Exact architecture and artifact support.",
          "Target CPU, GPU, and accelerator generation.",
          "Interactive versus concurrent serving workload.",
          "Context, batching, and cache controls.",
          "API, observability, and restart requirements.",
          "Measured quality and performance on the real artifact.",
        ],
      },
    ],
    sources: [
      {
        title: "llama.cpp",
        publisher: "GGML",
        href: "https://github.com/ggml-org/llama.cpp",
      },
      {
        title: "Quantized inference",
        publisher: "vLLM",
        href: "https://docs.vllm.ai/en/latest/features/quantization/",
      },
      {
        title: "TensorRT-LLM documentation",
        publisher: "NVIDIA",
        href: "https://nvidia.github.io/TensorRT-LLM/",
      },
    ],
    related: ["model-checkpoint-artifact-runtime", "reading-model-repository", "memory-and-context"],
  },
];

export function docArticleBySlug(slug: string | null | undefined) {
  return DOC_ARTICLES.find((article) => article.slug === slug);
}
