import type { ModelCapabilityId, ModelCategoryId } from "../src/lib/atlas/taxonomy";

export interface FamilyDefinition {
  id: string;
  name: string;
  vendor: string;
  tags: string;
  category?: ModelCategoryId;
  capabilities?: ModelCapabilityId[];
}

export const FAMILY_DEFINITIONS: FamilyDefinition[] = [
  { id: "qwen", name: "Qwen", vendor: "Alibaba", tags: "reasoning, coding, long context" },
  { id: "deepseek", name: "DeepSeek", vendor: "DeepSeek AI", tags: "reasoning, code, mixture of experts" },
  { id: "llama", name: "Llama", vendor: "Meta", tags: "general foundation models" },
  { id: "gemma", name: "Gemma", vendor: "Google", tags: "efficient multimodal models" },
  { id: "mistral", name: "Mistral", vendor: "Mistral AI", tags: "general, reasoning, coding" },
  { id: "gpt-oss", name: "GPT-OSS", vendor: "OpenAI", tags: "reasoning, agentic, mixture of experts" },
  { id: "intern-s", name: "Intern-S", vendor: "Shanghai AI Laboratory", tags: "multimodal scientific reasoning, long-horizon agents, tool use", category: "vision-documents", capabilities: ["general", "reasoning", "science", "mathematics", "agentic", "long-context", "image-understanding", "video-understanding", "document-qa"] },
  { id: "internlm", name: "InternLM", vendor: "Shanghai AI Laboratory", tags: "general language, reasoning, thinking mode, long context", category: "language", capabilities: ["general", "reasoning", "mathematics", "long-context"] },
  { id: "phi", name: "Phi", vendor: "Microsoft", tags: "small language, reasoning, multimodal" },
  { id: "nemotron", name: "Nemotron", vendor: "NVIDIA", tags: "reasoning, agentic, inference optimized" },
  { id: "glm", name: "GLM", vendor: "Z.ai", tags: "agentic, coding, long context" },
  { id: "minimax", name: "MiniMax", vendor: "MiniMax", tags: "agentic, multimodal, long context, video generation, music generation" },
  { id: "cosmos3", name: "Cosmos 3", vendor: "NVIDIA", tags: "omnimodal world generation, physical AI, action generation", category: "world-models", capabilities: ["world-modeling", "agentic"] },
  { id: "hidream", name: "HiDream", vendor: "HiDream.ai", tags: "text-to-image, image editing, unified image generation", category: "image-generation", capabilities: ["image-generation", "image-editing"] },
  { id: "ltx", name: "LTX", vendor: "Lightricks", tags: "text-to-video, image-to-video, synchronized audio generation", category: "video-generation", capabilities: ["video-generation"] },
  { id: "fish-audio", name: "Fish Audio", vendor: "Fish Audio", tags: "multilingual expressive text-to-speech", category: "audio-speech", capabilities: ["text-to-speech", "multilingual"] },
  { id: "step-audio", name: "Step Audio", vendor: "StepFun", tags: "expressive speech editing, text-to-speech", category: "audio-speech", capabilities: ["text-to-speech", "multilingual"] },
  { id: "parakeet", name: "Parakeet", vendor: "NVIDIA", tags: "multilingual speech recognition, high-throughput transcription", category: "audio-speech", capabilities: ["speech-recognition", "multilingual"] },
  { id: "whisper", name: "Whisper", vendor: "OpenAI", tags: "multilingual speech recognition and speech translation", category: "audio-speech", capabilities: ["speech-recognition", "multilingual"] },
  { id: "lyra", name: "Lyra", vendor: "NVIDIA", tags: "explorable 3D worlds, camera control, 3D Gaussian reconstruction", category: "world-models", capabilities: ["world-modeling", "3d-generation", "video-generation"] },
  { id: "hy-world", name: "HY-World", vendor: "Tencent", tags: "interactive world generation, persistent 3D worlds, reconstruction", category: "world-models", capabilities: ["world-modeling", "3d-generation", "video-generation"] },
  { id: "lingbot-world", name: "LingBot-World", vendor: "Ant Group", tags: "interactive world simulation, long-horizon memory, camera control", category: "world-models", capabilities: ["world-modeling", "video-generation"] },
  { id: "matrix-game", name: "Matrix-Game", vendor: "Skywork", tags: "real-time interactive worlds, game simulation, long-horizon memory", category: "world-models", capabilities: ["world-modeling", "video-generation"] },
  { id: "sana-wm", name: "SANA-WM", vendor: "NVIDIA / MIT HAN Lab", tags: "efficient minute-scale world modeling, hybrid linear diffusion", category: "world-models", capabilities: ["world-modeling", "video-generation"] },
  { id: "hunyuan3d", name: "Hunyuan3D", vendor: "Tencent", tags: "image-to-3D, text-to-3D, PBR materials", category: "3d-spatial", capabilities: ["3d-generation"] },
  { id: "gr00t", name: "GR00T", vendor: "NVIDIA", tags: "vision-language-action, humanoid robotics, generalist control", category: "robotics", capabilities: ["robot-control", "world-modeling", "reasoning"] },
  { id: "mimo", name: "MiMo", vendor: "Xiaomi", tags: "reasoning, agentic, mixture of experts" },
  { id: "inkling", name: "Inkling", vendor: "Thinking Machines Lab", tags: "multimodal reasoning, agentic tools, coding" },
  { id: "laguna", name: "Laguna", vendor: "Poolside", tags: "agentic coding, reasoning, long context, mixture of experts", category: "language", capabilities: ["coding", "reasoning", "agentic", "long-context"] },
  { id: "kimi", name: "Kimi", vendor: "Moonshot AI", tags: "agentic, coding, multimodal" },
  { id: "solar", name: "Solar", vendor: "Upstage", tags: "reasoning, efficient mixture of experts" },
  { id: "k2", name: "K2", vendor: "LLM360 / MBZUAI", tags: "reasoning, fully open, long context" },
  { id: "grok", name: "Grok", vendor: "xAI", tags: "mixture of experts, long context" },
];

export const FAMILY_BY_ID = new Map(FAMILY_DEFINITIONS.map((family) => [family.id, family]));
