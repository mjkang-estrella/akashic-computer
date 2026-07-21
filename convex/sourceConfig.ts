import type { MonitoredSourceRule } from "../src/lib/atlas/huggingface";

export interface SeedSource extends MonitoredSourceRule {
  displayName: string;
}

const commonExcludes = [
  "*-adapter*",
  "*-lora*",
  "*-checkpoint*",
  "*-demo*",
  "*-test*",
];

export const CURRENT_MONITORED_SOURCES: SeedSource[] = [
  { owner: "Qwen", displayName: "Qwen", role: "creator", familyIds: ["qwen"], includePatterns: ["Qwen/Qwen*"], excludePatterns: commonExcludes },
  { owner: "deepseek-ai", displayName: "DeepSeek AI", role: "creator", familyIds: ["deepseek"], includePatterns: ["deepseek-ai/DeepSeek*"], excludePatterns: commonExcludes },
  { owner: "meta-llama", displayName: "Meta", role: "creator", familyIds: ["llama"], includePatterns: ["meta-llama/Llama*"], excludePatterns: commonExcludes },
  { owner: "google", displayName: "Google", role: "creator", familyIds: ["gemma"], includePatterns: ["google/gemma*"], excludePatterns: commonExcludes },
  { owner: "mistralai", displayName: "Mistral AI", role: "creator", familyIds: ["mistral"], includePatterns: ["mistralai/Mistral*", "mistralai/Mixtral*", "mistralai/Ministral*", "mistralai/Codestral*", "mistralai/Devstral*", "mistralai/Magistral*", "mistralai/Voxtral*", "mistralai/Pixtral*"], excludePatterns: commonExcludes },
  { owner: "openai", displayName: "OpenAI", role: "creator", familyIds: ["gpt-oss", "whisper"], includePatterns: ["openai/gpt-oss*", "openai/whisper*"], excludePatterns: commonExcludes },
  { owner: "microsoft", displayName: "Microsoft", role: "creator", familyIds: ["phi"], includePatterns: ["microsoft/Phi*"], excludePatterns: commonExcludes },
  { owner: "nvidia", displayName: "NVIDIA", role: "creator_provider", familyIds: ["nemotron", "cosmos", "parakeet", "lyra", "groot", "sana-wm"], includePatterns: ["nvidia/*Nemotron*", "nvidia/*Cosmos*", "nvidia/*Parakeet*", "nvidia/*Lyra*", "nvidia/*GR00T*", "nvidia/*Sana*", "nvidia/*NVFP4*"], excludePatterns: commonExcludes },
  { owner: "zai-org", displayName: "Z.ai", role: "creator", familyIds: ["glm"], includePatterns: ["zai-org/GLM*"], excludePatterns: commonExcludes },
  { owner: "MiniMaxAI", displayName: "MiniMax", role: "creator", familyIds: ["minimax"], includePatterns: ["MiniMaxAI/MiniMax*"], excludePatterns: commonExcludes },
  { owner: "HiDream-ai", displayName: "HiDream.ai", role: "creator", familyIds: ["hidream"], includePatterns: ["HiDream-ai/HiDream*"], excludePatterns: commonExcludes },
  { owner: "Lightricks", displayName: "Lightricks", role: "creator", familyIds: ["ltx"], includePatterns: ["Lightricks/LTX*"], excludePatterns: commonExcludes },
  { owner: "fishaudio", displayName: "Fish Audio", role: "creator", familyIds: ["fish-audio"], includePatterns: ["fishaudio/Fish*", "fishaudio/fish*"], excludePatterns: commonExcludes },
  { owner: "stepfun-ai", displayName: "StepFun", role: "creator", familyIds: ["step-audio"], includePatterns: ["stepfun-ai/Step-Audio*"], excludePatterns: commonExcludes },
  { owner: "tencent", displayName: "Tencent", role: "creator", familyIds: ["hy-world", "hunyuan3d"], includePatterns: ["tencent/HY-World*", "tencent/Hunyuan3D*"], excludePatterns: commonExcludes },
  { owner: "robbyant", displayName: "Ant Group", role: "creator", familyIds: ["lingbot-world"], includePatterns: ["robbyant/LingBot-World*"], excludePatterns: commonExcludes },
  { owner: "Skywork", displayName: "Skywork", role: "creator", familyIds: ["matrix-game"], includePatterns: ["Skywork/Matrix-Game*"], excludePatterns: commonExcludes },
  { owner: "Efficient-Large-Model", displayName: "MIT HAN Lab", role: "creator", familyIds: ["sana-wm"], includePatterns: ["Efficient-Large-Model/SANA-WM*"], excludePatterns: commonExcludes },
  { owner: "XiaomiMiMo", displayName: "Xiaomi", role: "creator", familyIds: ["mimo"], excludePatterns: commonExcludes },
  { owner: "thinkingmachines", displayName: "Thinking Machines Lab", role: "creator", familyIds: ["inkling"], includePatterns: ["thinkingmachines/Inkling*"], excludePatterns: commonExcludes },
  { owner: "poolside", displayName: "Poolside", role: "creator", familyIds: ["laguna"], includePatterns: ["poolside/Laguna-*"], excludePatterns: [...commonExcludes, "poolside/*DFlash*", "poolside/*speculator*", "poolside/*tiny*"] },
  { owner: "moonshotai", displayName: "Moonshot AI", role: "creator", familyIds: ["kimi"], includePatterns: ["moonshotai/Kimi*"], excludePatterns: commonExcludes },
  { owner: "upstage", displayName: "Upstage", role: "creator", familyIds: ["solar"], includePatterns: ["upstage/SOLAR*", "upstage/Solar*"], excludePatterns: commonExcludes },
  { owner: "LLM360", displayName: "LLM360 / MBZUAI", role: "creator", familyIds: ["k2"], includePatterns: ["LLM360/K2*"], excludePatterns: commonExcludes },
  { owner: "xai-org", displayName: "xAI", role: "creator", familyIds: ["grok"], includePatterns: ["xai-org/grok*"], excludePatterns: commonExcludes },
  { owner: "internlm", displayName: "Shanghai AI Laboratory", role: "creator", familyIds: ["intern-s", "internlm"], includePatterns: ["internlm/internlm*", "internlm/Intern-S*"], excludePatterns: commonExcludes },
  { owner: "unsloth", displayName: "Unsloth", role: "artifact_provider", familyIds: [], includePatterns: ["unsloth/Qwen*", "unsloth/DeepSeek*", "unsloth/Llama*", "unsloth/gemma*", "unsloth/Mistral*", "unsloth/gpt-oss*", "unsloth/Phi*", "unsloth/GLM*", "unsloth/MiniMax*", "unsloth/Kimi*"], excludePatterns: commonExcludes },
];
