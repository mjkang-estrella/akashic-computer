export const FAMILY_LOGOS: Partial<Record<string, string>> = {
  qwen: "/brands/qwen.svg",
  deepseek: "/brands/deepseek.svg",
  llama: "/brands/llama.svg",
  gemma: "/brands/gemma.svg",
  mistral: "/brands/mistral.svg",
  "gpt-oss": "/brands/gpt-oss.svg",
  whisper: "/brands/gpt-oss.svg",
  "intern-s": "/brands/internlm.webp",
  internlm: "/brands/internlm.webp",
  phi: "/brands/phi.svg",
  nemotron: "/brands/nemotron.svg",
  glm: "/brands/glm.svg",
  minimax: "/brands/minimax.svg",
  mimo: "/brands/mimo.svg",
  kimi: "/brands/kimi.svg",
  inkling: "/brands/thinking-machines.png",
  laguna: "/brands/poolside.webp",
  solar: "/brands/solar.svg",
  k2: "/brands/k2.webp",
  grok: "/brands/grok.svg",
  cosmos3: "/brands/nemotron.svg",
  lyra: "/brands/nemotron.svg",
  "sana-wm": "/brands/nemotron.svg",
  gr00t: "/brands/nemotron.svg",
  parakeet: "/brands/nemotron.svg",
};

export interface FamilyBrand {
  company: string;
  /** Signature color as Artificial Analysis charts it; see `AA_UNLISTED` for the exceptions. */
  color: string;
}

const COMPANY_COLORS = {
  // Artificial Analysis `modelCreatorColor`, leaderboard retrieved 2026-11-15.
  Alibaba: "#ff7018",
  NVIDIA: "#76b900",
  Google: "#34a853",
  DeepSeek: "#2243e6",
  "Z.ai": "#1c7ff8",
  Microsoft: "#0078d5",
  Xiaomi: "#ff6900",
  Meta: "#0089f4",
  "Mistral AI": "#f32e02",
  MiniMax: "#eb3568",
  "Moonshot AI": "#047afe",
  OpenAI: "#1f1f1f",
  "Ant Group": "#4fb5ff", // AA lists Ant Group's models under InclusionAI.
  "Thinking Machines Lab": "#676767",
  Upstage: "#7c59f5",
  Tencent: "#5cb9ff",
  StepFun: "#00f5e7",
  xAI: "#736cd3", // AA: SpaceXAI.
  "Institute of Foundation Models": "#1521a9",
  // AA_UNLISTED: not on Artificial Analysis; distinct colors chosen here, not brand colors.
  "Shanghai AI Laboratory": "#0e9f8f",
  Lightricks: "#c026d3",
  Poolside: "#b45309",
  "HiDream.ai": "#9333ea",
  Skywork: "#64748b",
} as const;

type Company = keyof typeof COMPANY_COLORS;

const FAMILY_COMPANY: Partial<Record<string, Company>> = {
  qwen: "Alibaba",
  nemotron: "NVIDIA",
  cosmos3: "NVIDIA",
  parakeet: "NVIDIA",
  lyra: "NVIDIA",
  "sana-wm": "NVIDIA",
  gr00t: "NVIDIA",
  gemma: "Google",
  deepseek: "DeepSeek",
  internlm: "Shanghai AI Laboratory",
  "intern-s": "Shanghai AI Laboratory",
  glm: "Z.ai",
  phi: "Microsoft",
  mimo: "Xiaomi",
  llama: "Meta",
  mistral: "Mistral AI",
  minimax: "MiniMax",
  kimi: "Moonshot AI",
  ltx: "Lightricks",
  whisper: "OpenAI",
  "gpt-oss": "OpenAI",
  "lingbot-world": "Ant Group",
  laguna: "Poolside",
  inkling: "Thinking Machines Lab",
  solar: "Upstage",
  hidream: "HiDream.ai",
  "hy-world": "Tencent",
  "step-audio": "StepFun",
  grok: "xAI",
  k2: "Institute of Foundation Models",
  "matrix-game": "Skywork",
};

/** The company behind a family and its chart color; null for families not mapped yet. */
export function familyBrand(familyId: string): FamilyBrand | null {
  const company = FAMILY_COMPANY[familyId];
  return company ? { company, color: COMPANY_COLORS[company] } : null;
}
