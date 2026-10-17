import type { ContextChoice } from "./types";

export interface RunCommand {
  runtime: string;
  /** Shell command to copy, or absent for a link-only launcher. */
  command?: string;
  href?: string;
  note: string;
}

interface RunnableArtifact {
  repo: string;
  format: string;
  runtimes: string[];
  gated?: boolean;
}

/**
 * Starting commands for the runtimes an artifact lists. They use each runtime's defaults
 * plus the selected context length, so they describe how to start, not a verified recipe.
 */
export function runCommandsFor(artifact: RunnableArtifact, context: ContextChoice = "native"): RunCommand[] {
  const repo = artifact.repo;
  const runtimes = new Set(artifact.runtimes);
  const tokens = context === "native" ? null : context;
  const commands: RunCommand[] = [];
  const gguf = artifact.format.toUpperCase() === "GGUF";

  if (gguf && runtimes.has("Ollama")) {
    commands.push({
      runtime: "Ollama",
      command: `ollama run hf.co/${repo}`,
      note: "Pulls the Q4_K_M file when the repository has one; append :Q8_0 or another file tag to choose a quantization.",
    });
  }
  if (gguf && runtimes.has("llama.cpp")) {
    commands.push({
      runtime: "llama.cpp",
      command: `llama-server -hf ${repo}${tokens ? ` -c ${tokens}` : ""}`,
      note: "Downloads the Q4_K_M file when present (append :QUANT to choose) and serves an OpenAI-compatible API on port 8080.",
    });
  }
  if (gguf && runtimes.has("LM Studio")) {
    commands.push({
      runtime: "LM Studio",
      href: `lmstudio://open_from_hf?model=${encodeURIComponent(repo)}`,
      note: "Opens the repository in LM Studio, where you choose a file to download.",
    });
  }
  if (runtimes.has("MLX")) {
    commands.push({
      runtime: "MLX",
      command: `mlx_lm.server --model ${repo}`,
      note: "Apple silicon only. Install with pip install mlx-lm; serves an OpenAI-compatible API on port 8080.",
    });
  }
  if (runtimes.has("vLLM")) {
    commands.push({
      runtime: "vLLM",
      command: `vllm serve ${repo}${tokens ? ` --max-model-len ${tokens}` : ""}`,
      note: "Serves an OpenAI-compatible API on port 8000. vLLM reserves most GPU memory for KV cache by default.",
    });
  }
  if (runtimes.has("SGLang")) {
    commands.push({
      runtime: "SGLang",
      command: `python -m sglang.launch_server --model-path ${repo}${tokens ? ` --context-length ${tokens}` : ""}`,
      note: "Serves an OpenAI-compatible API on port 30000.",
    });
  }
  if (runtimes.has("TensorRT-LLM")) {
    commands.push({
      runtime: "TensorRT-LLM",
      command: `trtllm-serve ${repo}${tokens ? ` --max_seq_len ${tokens}` : ""}`,
      note: "NVIDIA GPUs only. Serves an OpenAI-compatible API on port 8000.",
    });
  }
  if (artifact.gated && commands.length > 0) {
    for (const command of commands) {
      command.note += command.command
        ? " Gated: accept the license on Hugging Face and sign in (hf auth login) first."
        : " Gated: accept the license on Hugging Face first.";
    }
  }
  return commands;
}
