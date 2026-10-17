import { describe, expect, it } from "vitest";
import { runCommandsFor } from "./runCommands";

describe("run commands", () => {
  it("gives GGUF repositories llama.cpp, Ollama and LM Studio starting points", () => {
    const commands = runCommandsFor({
      repo: "unsloth/Qwen3.6-27B-GGUF", format: "GGUF", runtimes: ["llama.cpp", "Ollama", "LM Studio"],
    }, 32768);
    expect(commands.map((command) => command.runtime)).toEqual(["Ollama", "llama.cpp", "LM Studio"]);
    expect(commands[0].command).toBe("ollama run hf.co/unsloth/Qwen3.6-27B-GGUF");
    expect(commands[1].command).toBe("llama-server -hf unsloth/Qwen3.6-27B-GGUF -c 32768");
    expect(commands[2]).toMatchObject({ href: "lmstudio://open_from_hf?model=unsloth%2FQwen3.6-27B-GGUF" });
    expect(commands[2].command).toBeUndefined();
  });

  it("bounds server context only when a context is chosen", () => {
    const artifact = { repo: "Qwen/Qwen3.6-27B-FP8", format: "FP8", runtimes: ["vLLM", "SGLang", "Transformers"] };
    expect(runCommandsFor(artifact, "native").map((command) => command.command)).toEqual([
      "vllm serve Qwen/Qwen3.6-27B-FP8",
      "python -m sglang.launch_server --model-path Qwen/Qwen3.6-27B-FP8",
    ]);
    expect(runCommandsFor(artifact, 8192)[0].command).toBe("vllm serve Qwen/Qwen3.6-27B-FP8 --max-model-len 8192");
  });

  it("only offers runtimes the artifact lists and flags gated repositories", () => {
    expect(runCommandsFor({ repo: "a/b", format: "GGUF", runtimes: [] })).toEqual([]);
    expect(runCommandsFor({ repo: "a/b", format: "BF16", runtimes: ["Diffusers"] })).toEqual([]);
    const [mlx] = runCommandsFor({ repo: "mlx-community/x-4bit", format: "MLX 4-bit", runtimes: ["MLX"], gated: true });
    expect(mlx.command).toBe("mlx_lm.server --model mlx-community/x-4bit");
    expect(mlx.note).toMatch(/Gated/);
  });
});
