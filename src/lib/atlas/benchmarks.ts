import type { ModelEntry } from "./models";

export type BenchmarkCategoryId =
  | "knowledge"
  | "reasoning"
  | "mathematics"
  | "coding"
  | "agentic"
  | "multimodal"
  | "documents"
  | "spatial"
  | "video";

export interface OfficialBenchmarkResult {
  repo: string;
  score: number;
  sourceUrl: string;
  sourceLabel: string;
  modelName?: string;
  note?: string;
}

export interface OfficialBenchmark {
  id: string;
  name: string;
  category: BenchmarkCategoryId;
  description: string;
  metric: string;
  protocol: string;
  maxScore: number;
  results: OfficialBenchmarkResult[];
}

export interface ResolvedBenchmarkResult extends OfficialBenchmarkResult {
  entry: ModelEntry;
  rank: number;
}

export interface ResolvedBenchmark extends Omit<OfficialBenchmark, "results"> {
  results: ResolvedBenchmarkResult[];
}

export const BENCHMARK_CATEGORIES: {
  id: BenchmarkCategoryId;
  label: string;
}[] = [
  { id: "knowledge", label: "Knowledge" },
  { id: "reasoning", label: "Reasoning" },
  { id: "mathematics", label: "Mathematics" },
  { id: "coding", label: "Coding" },
  { id: "agentic", label: "Agentic" },
  { id: "multimodal", label: "Vision" },
  { id: "documents", label: "Documents" },
  { id: "spatial", label: "Spatial" },
  { id: "video", label: "Video" },
];

const QWEN_36 = "https://huggingface.co/Qwen/Qwen3.6-27B#benchmark-results";
const QWEN_35 = "https://huggingface.co/Qwen/Qwen3.5-122B-A10B#benchmark-results";
const DEEPSEEK_R1 = "https://huggingface.co/deepseek-ai/DeepSeek-R1-0528#2-evaluation-results";
const GPT_OSS = "https://openai.com/open-models/";
const LLAMA_4 = "https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct#benchmarks";
const GLM_52 = "https://huggingface.co/zai-org/GLM-5.2#benchmark";
const KIMI_26 = "https://huggingface.co/moonshotai/Kimi-K2.6#3-evaluation-results";
const MINIMAX_M3 = "https://huggingface.co/MiniMaxAI/MiniMax-M3";

const qwen36 = (repo: string, score: number): OfficialBenchmarkResult => ({
  repo,
  score,
  sourceUrl: QWEN_36,
  sourceLabel: "Qwen 3.6 report",
});

const qwen35 = (repo: string, score: number): OfficialBenchmarkResult => ({
  repo,
  score,
  sourceUrl: QWEN_35,
  sourceLabel: "Qwen 3.5 report",
});

const QWEN_36_REPORT_MODELS = {
  qwen35_27: "Qwen/Qwen3.5-27B",
  qwen35_397: "Qwen/Qwen3.5-397B-A17B",
  qwen36_35: "Qwen/Qwen3.6-35B-A3B",
  qwen36_27: "Qwen/Qwen3.6-27B",
} as const;

type Qwen36ReportModel = keyof typeof QWEN_36_REPORT_MODELS;

function qwen36Scores(
  scores: Partial<Record<Qwen36ReportModel, number>>,
): OfficialBenchmarkResult[] {
  return (Object.entries(scores) as [Qwen36ReportModel, number][]).map(([model, score]) =>
    qwen36(QWEN_36_REPORT_MODELS[model], score),
  );
}

function qwen36Benchmark({
  id,
  name,
  category,
  description,
  metric = "Accuracy (%)",
  protocol,
  scores,
}: {
  id: string;
  name: string;
  category: BenchmarkCategoryId;
  description: string;
  metric?: string;
  protocol?: string;
  scores: Partial<Record<Qwen36ReportModel, number>>;
}): OfficialBenchmark {
  return {
    id,
    name,
    category,
    description,
    metric,
    protocol: protocol ?? `Creator-reported ${name} results`,
    maxScore: 100,
    results: qwen36Scores(scores),
  };
}

export const OFFICIAL_BENCHMARKS: OfficialBenchmark[] = [
  {
    id: "mmlu-pro",
    name: "MMLU-Pro",
    category: "knowledge",
    description: "Broad expert-level knowledge and reasoning across academic disciplines.",
    metric: "Accuracy (%)",
    protocol: "Creator-reported MMLU-Pro results",
    maxScore: 100,
    results: [
      qwen36("Qwen/Qwen3.5-397B-A17B", 87.8),
      qwen35("Qwen/Qwen3.5-122B-A10B", 86.7),
      qwen36("Qwen/Qwen3.6-27B", 86.2),
      qwen35("Qwen/Qwen3.5-27B", 86.1),
      qwen35("Qwen/Qwen3.5-35B-A3B", 85.3),
      qwen36("Qwen/Qwen3.6-35B-A3B", 85.2),
      {
        repo: "deepseek-ai/DeepSeek-R1-0528",
        score: 85,
        modelName: "DeepSeek R1-0528",
        sourceUrl: DEEPSEEK_R1,
        sourceLabel: "DeepSeek model card",
      },
      {
        repo: "meta-llama/Llama-4-Maverick-17B-128E-Instruct",
        score: 80.5,
        sourceUrl: LLAMA_4,
        sourceLabel: "Meta model card",
      },
      {
        repo: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        score: 74.3,
        sourceUrl: LLAMA_4,
        sourceLabel: "Meta model card",
      },
    ],
  },
  {
    id: "mmlu-redux",
    name: "MMLU-Redux",
    category: "knowledge",
    description: "A corrected, less ambiguous revision of the original MMLU knowledge benchmark.",
    metric: "Exact match (%)",
    protocol: "Creator-reported MMLU-Redux results",
    maxScore: 100,
    results: qwen36Scores({
      qwen35_27: 93.2,
      qwen35_397: 94.9,
      qwen36_35: 93.3,
      qwen36_27: 93.5,
    }),
  },
  {
    id: "supergpqa",
    name: "SuperGPQA",
    category: "knowledge",
    description: "Expert-level questions spanning science, engineering, and the humanities.",
    metric: "Accuracy (%)",
    protocol: "Creator-reported SuperGPQA results",
    maxScore: 100,
    results: qwen36Scores({
      qwen35_27: 65.6,
      qwen35_397: 70.4,
      qwen36_35: 64.7,
      qwen36_27: 66,
    }),
  },
  {
    id: "c-eval",
    name: "C-Eval",
    category: "knowledge",
    description: "Chinese-language academic knowledge across four difficulty levels.",
    metric: "Accuracy (%)",
    protocol: "Creator-reported C-Eval results",
    maxScore: 100,
    results: qwen36Scores({
      qwen35_27: 90.5,
      qwen35_397: 93,
      qwen36_35: 90,
      qwen36_27: 91.4,
    }),
  },
  {
    id: "gpqa-diamond",
    name: "GPQA Diamond",
    category: "reasoning",
    description: "Graduate-level science questions designed to resist simple retrieval.",
    metric: "Pass@1 (%)",
    protocol: "Creator-reported GPQA Diamond results",
    maxScore: 100,
    results: [
      {
        repo: "zai-org/GLM-5.2",
        score: 91.2,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "MiniMaxAI/MiniMax-M3",
        score: 93,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
        note: "Comparative result reported by Z.ai",
      },
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 90.5,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
      },
      {
        repo: "zai-org/GLM-5.1",
        score: 86.2,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      qwen36("Qwen/Qwen3.5-397B-A17B", 88.4),
      qwen36("Qwen/Qwen3.6-27B", 87.8),
      qwen35("Qwen/Qwen3.5-122B-A10B", 86.6),
      qwen36("Qwen/Qwen3.6-35B-A3B", 86),
      qwen35("Qwen/Qwen3.5-27B", 85.5),
      qwen35("Qwen/Qwen3.5-35B-A3B", 84.2),
      {
        repo: "deepseek-ai/DeepSeek-R1-0528",
        score: 81,
        modelName: "DeepSeek R1-0528",
        sourceUrl: DEEPSEEK_R1,
        sourceLabel: "DeepSeek model card",
      },
      {
        repo: "openai/gpt-oss-120b",
        score: 80.1,
        sourceUrl: GPT_OSS,
        sourceLabel: "OpenAI report",
        note: "High reasoning effort",
      },
      {
        repo: "openai/gpt-oss-20b",
        score: 71.5,
        sourceUrl: GPT_OSS,
        sourceLabel: "OpenAI report",
        note: "High reasoning effort",
      },
      {
        repo: "meta-llama/Llama-4-Maverick-17B-128E-Instruct",
        score: 69.8,
        sourceUrl: LLAMA_4,
        sourceLabel: "Meta model card",
      },
      {
        repo: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        score: 57.2,
        sourceUrl: LLAMA_4,
        sourceLabel: "Meta model card",
      },
    ],
  },
  {
    id: "hle",
    name: "Humanity's Last Exam",
    category: "reasoning",
    description: "Difficult multidisciplinary questions intended to probe frontier reasoning.",
    metric: "Accuracy (%)",
    protocol: "Text-only, without tools unless the creator states otherwise",
    maxScore: 100,
    results: [
      {
        repo: "zai-org/GLM-5.2",
        score: 40.5,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "MiniMaxAI/MiniMax-M3",
        score: 37,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
        note: "Comparative result reported by Z.ai",
      },
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 34.7,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
      },
      {
        repo: "zai-org/GLM-5.1",
        score: 31,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      qwen36("Qwen/Qwen3.5-397B-A17B", 28.7),
      qwen35("Qwen/Qwen3.5-122B-A10B", 25.3),
      qwen35("Qwen/Qwen3.5-27B", 24.3),
      qwen36("Qwen/Qwen3.6-27B", 24),
      qwen35("Qwen/Qwen3.5-35B-A3B", 22.4),
      qwen36("Qwen/Qwen3.6-35B-A3B", 21.4),
      {
        repo: "openai/gpt-oss-120b",
        score: 19,
        sourceUrl: GPT_OSS,
        sourceLabel: "OpenAI report",
        note: "High reasoning effort",
      },
      {
        repo: "deepseek-ai/DeepSeek-R1-0528",
        score: 17.7,
        modelName: "DeepSeek R1-0528",
        sourceUrl: DEEPSEEK_R1,
        sourceLabel: "DeepSeek model card",
      },
      {
        repo: "openai/gpt-oss-20b",
        score: 17.3,
        sourceUrl: GPT_OSS,
        sourceLabel: "OpenAI report",
        note: "High reasoning effort",
      },
    ],
  },
  {
    id: "aime-2026",
    name: "AIME 2026",
    category: "mathematics",
    description: "Competition mathematics problems from the 2026 AIME I and II exams.",
    metric: "Pass@1 (%)",
    protocol: "Full 2026 AIME I and II; creator-reported inference settings",
    maxScore: 100,
    results: [
      {
        repo: "zai-org/GLM-5.2",
        score: 99.2,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "zai-org/GLM-5.1",
        score: 95.3,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 96.4,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
      },
      qwen36("Qwen/Qwen3.6-27B", 94.1),
      qwen36("Qwen/Qwen3.5-397B-A17B", 93.3),
      qwen36("Qwen/Qwen3.6-35B-A3B", 92.7),
      qwen36("Qwen/Qwen3.5-27B", 92.6),
    ],
  },
  {
    id: "hmmt-feb-2025",
    name: "HMMT February 2025",
    category: "mathematics",
    description: "Competition mathematics problems from the February 2025 HMMT tournament.",
    metric: "Pass@1 (%)",
    protocol: "Creator-reported HMMT February 2025 results",
    maxScore: 100,
    results: qwen36Scores({
      qwen35_27: 92,
      qwen35_397: 94.8,
      qwen36_35: 90.7,
      qwen36_27: 93.8,
    }),
  },
  {
    id: "hmmt-nov-2025",
    name: "HMMT November 2025",
    category: "mathematics",
    description: "Competition mathematics problems from the November 2025 HMMT tournament.",
    metric: "Pass@1 (%)",
    protocol: "Creator-reported HMMT November 2025 results",
    maxScore: 100,
    results: [
      ...qwen36Scores({
        qwen35_27: 89.8,
        qwen35_397: 92.7,
        qwen36_35: 89.1,
        qwen36_27: 90.7,
      }),
      {
        repo: "zai-org/GLM-5.2",
        score: 94.4,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "zai-org/GLM-5.1",
        score: 94,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "MiniMaxAI/MiniMax-M3",
        score: 84.4,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
        note: "Comparative result reported by Z.ai",
      },
    ],
  },
  {
    id: "hmmt-feb-2026",
    name: "HMMT February 2026",
    category: "mathematics",
    description: "Competition mathematics problems from the February 2026 HMMT tournament.",
    metric: "Pass@1 (%)",
    protocol: "Creator-reported HMMT February 2026 results",
    maxScore: 100,
    results: [
      ...qwen36Scores({
        qwen35_27: 84.3,
        qwen35_397: 87.9,
        qwen36_35: 83.6,
        qwen36_27: 84.3,
      }),
      {
        repo: "zai-org/GLM-5.2",
        score: 92.5,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "zai-org/GLM-5.1",
        score: 82.6,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 92.7,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
      },
      {
        repo: "MiniMaxAI/MiniMax-M3",
        score: 84.4,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
        note: "Comparative result reported by Z.ai",
      },
    ],
  },
  {
    id: "imo-answerbench",
    name: "IMO-AnswerBench",
    category: "mathematics",
    description: "Proof-oriented olympiad mathematics questions requiring final structured answers.",
    metric: "Accuracy (%)",
    protocol: "Creator-reported IMO-AnswerBench results",
    maxScore: 100,
    results: [
      ...qwen36Scores({
        qwen35_27: 79.9,
        qwen35_397: 80.9,
        qwen36_35: 78.9,
        qwen36_27: 80.8,
      }),
      {
        repo: "zai-org/GLM-5.2",
        score: 91,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "zai-org/GLM-5.1",
        score: 83.8,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 86,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
      },
    ],
  },
  {
    id: "livecodebench-v6",
    name: "LiveCodeBench v6",
    category: "coding",
    description: "Contamination-resistant coding problems collected over time.",
    metric: "Pass@1 (%)",
    protocol: "LiveCodeBench v6 only",
    maxScore: 100,
    results: [
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 89.6,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
      },
      qwen36("Qwen/Qwen3.6-27B", 83.9),
      qwen36("Qwen/Qwen3.5-397B-A17B", 83.6),
      qwen35("Qwen/Qwen3.5-27B", 80.7),
      qwen36("Qwen/Qwen3.6-35B-A3B", 80.4),
      qwen35("Qwen/Qwen3.5-122B-A10B", 78.9),
      qwen35("Qwen/Qwen3.5-35B-A3B", 74.6),
    ],
  },
  {
    id: "swe-bench-multilingual",
    name: "SWE-bench Multilingual",
    category: "coding",
    description: "Repository-level software issues spanning multiple programming languages.",
    metric: "Resolved (%)",
    protocol: "Qwen internal agent scaffold; identical settings across listed models",
    maxScore: 100,
    results: qwen36Scores({
      qwen35_27: 69.3,
      qwen35_397: 69.3,
      qwen36_35: 67.2,
      qwen36_27: 71.3,
    }),
  },
  {
    id: "skillsbench",
    name: "SkillsBench",
    category: "agentic",
    description: "Agent tasks that test whether models can discover and apply reusable skills.",
    metric: "Average success (%)",
    protocol: "OpenCode on the 78 self-contained tasks; five-run average",
    maxScore: 100,
    results: qwen36Scores({
      qwen35_27: 27.2,
      qwen35_397: 30,
      qwen36_35: 28.7,
      qwen36_27: 48.2,
    }),
  },
  {
    id: "nl2repo",
    name: "NL2Repo",
    category: "coding",
    description: "Repository construction and modification from natural-language requirements.",
    metric: "Score (%)",
    protocol: "Creator-reported results; agent scaffolds may vary",
    maxScore: 100,
    results: [
      ...qwen36Scores({
        qwen35_27: 27.3,
        qwen35_397: 32.2,
        qwen36_35: 29.4,
        qwen36_27: 36.2,
      }),
      {
        repo: "zai-org/GLM-5.2",
        score: 48.9,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "zai-org/GLM-5.1",
        score: 42.7,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "MiniMaxAI/MiniMax-M3",
        score: 42.1,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
        note: "Comparative result reported by Z.ai",
      },
    ],
  },
  {
    id: "swe-bench-verified",
    name: "SWE-bench Verified",
    category: "coding",
    description: "Verified real-world GitHub issues resolved by an agent scaffold.",
    metric: "Resolved (%)",
    protocol: "Creator-reported agent results; scaffolds vary",
    maxScore: 100,
    results: [
      {
        repo: "MiniMaxAI/MiniMax-M3",
        score: 80.5,
        sourceUrl: MINIMAX_M3,
        sourceLabel: "MiniMax model card",
        note: "Internal Claude Code scaffold, four-run average",
      },
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 80.2,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
        note: "In-house SWE-agent-derived scaffold, ten-run average",
      },
      qwen36("Qwen/Qwen3.6-27B", 77.2),
      qwen36("Qwen/Qwen3.5-397B-A17B", 76.2),
      qwen36("Qwen/Qwen3.5-27B", 75),
      qwen36("Qwen/Qwen3.6-35B-A3B", 73.4),
      qwen35("Qwen/Qwen3.5-122B-A10B", 72),
      qwen35("Qwen/Qwen3.5-35B-A3B", 69.2),
      {
        repo: "deepseek-ai/DeepSeek-R1-0528",
        score: 57.6,
        modelName: "DeepSeek R1-0528",
        sourceUrl: DEEPSEEK_R1,
        sourceLabel: "DeepSeek model card",
      },
    ],
  },
  {
    id: "swe-bench-pro",
    name: "SWE-bench Pro",
    category: "coding",
    description: "Longer, harder software-engineering tasks across commercial repositories.",
    metric: "Resolved (%)",
    protocol: "Creator-reported agent results; scaffolds vary",
    maxScore: 100,
    results: [
      {
        repo: "zai-org/GLM-5.2",
        score: 62.1,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "zai-org/GLM-5.1",
        score: 58.4,
        sourceUrl: GLM_52,
        sourceLabel: "Z.ai model card",
      },
      {
        repo: "MiniMaxAI/MiniMax-M3",
        score: 59,
        sourceUrl: MINIMAX_M3,
        sourceLabel: "MiniMax model card",
      },
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 58.6,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
      },
      qwen36("Qwen/Qwen3.6-27B", 53.5),
      qwen36("Qwen/Qwen3.5-27B", 51.2),
      qwen36("Qwen/Qwen3.5-397B-A17B", 50.9),
      qwen36("Qwen/Qwen3.6-35B-A3B", 49.5),
    ],
  },
  {
    id: "terminal-bench-2",
    name: "Terminal-Bench 2.0",
    category: "coding",
    description: "End-to-end tasks completed by agents in realistic terminal environments.",
    metric: "Task success (%)",
    protocol: "Terminus-2 or creator-stated terminal harness",
    maxScore: 100,
    results: [
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 66.7,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
        note: "Terminus-2 scaffold",
      },
      qwen36("Qwen/Qwen3.6-27B", 59.3),
      qwen36("Qwen/Qwen3.5-397B-A17B", 52.5),
      qwen36("Qwen/Qwen3.6-35B-A3B", 51.5),
      qwen35("Qwen/Qwen3.5-122B-A10B", 49.4),
      qwen35("Qwen/Qwen3.5-27B", 41.6),
      qwen35("Qwen/Qwen3.5-35B-A3B", 40.5),
    ],
  },
  qwen36Benchmark({
    id: "mmmu",
    name: "MMMU",
    category: "multimodal",
    description: "Multidiscipline college-level reasoning over diagrams, charts, and images.",
    scores: { qwen35_27: 82.3, qwen35_397: 85, qwen36_35: 81.7, qwen36_27: 82.9 },
  }),
  qwen36Benchmark({
    id: "mathvista-mini",
    name: "MathVista Mini",
    category: "multimodal",
    description: "Visual mathematical reasoning across figures, diagrams, and real-world images.",
    scores: { qwen35_27: 87.8, qwen36_35: 86.4, qwen36_27: 87.4 },
  }),
  qwen36Benchmark({
    id: "dynamath",
    name: "DynaMath",
    category: "multimodal",
    description: "Dynamic visual mathematics designed to reduce memorization and contamination.",
    scores: { qwen35_27: 87.7, qwen35_397: 86.3, qwen36_35: 82.8, qwen36_27: 85.6 },
  }),
  qwen36Benchmark({
    id: "vlms-are-blind",
    name: "VLMs Are Blind",
    category: "spatial",
    description: "Simple visual primitives that expose spatial perception failures in vision models.",
    scores: { qwen35_27: 96.9, qwen36_35: 96.6, qwen36_27: 97 },
  }),
  qwen36Benchmark({
    id: "realworldqa",
    name: "RealWorldQA",
    category: "multimodal",
    description: "Understanding and reasoning about everyday real-world photographs.",
    scores: { qwen35_27: 83.7, qwen35_397: 83.9, qwen36_35: 85.3, qwen36_27: 84.1 },
  }),
  qwen36Benchmark({
    id: "mmstar",
    name: "MMStar",
    category: "multimodal",
    description: "Multimodal capability isolated from text-only knowledge leakage.",
    scores: { qwen35_27: 81, qwen35_397: 83.8, qwen36_35: 80.7, qwen36_27: 81.4 },
  }),
  qwen36Benchmark({
    id: "mmbench-en",
    name: "MMBench EN",
    category: "multimodal",
    description: "English-language multiple-choice evaluation of broad vision-language ability.",
    scores: { qwen35_27: 92.6, qwen36_35: 92.8, qwen36_27: 92.3 },
    protocol: "MMBench EN-DEV v1.1",
  }),
  qwen36Benchmark({
    id: "simplevqa",
    name: "SimpleVQA",
    category: "multimodal",
    description: "Short-answer visual questions emphasizing factual image understanding.",
    scores: { qwen35_27: 56, qwen35_397: 67.1, qwen36_35: 58.9, qwen36_27: 56.1 },
  }),
  qwen36Benchmark({
    id: "charxiv-rq",
    name: "CharXiv RQ",
    category: "documents",
    description: "Reasoning questions grounded in scientific-paper charts and figures.",
    scores: { qwen35_27: 79.5, qwen35_397: 80.8, qwen36_35: 78, qwen36_27: 78.4 },
  }),
  qwen36Benchmark({
    id: "cc-ocr",
    name: "CC-OCR",
    category: "documents",
    description: "OCR across multilingual, structured, and visually complex content.",
    scores: { qwen35_27: 81, qwen35_397: 82, qwen36_35: 81.9, qwen36_27: 81.2 },
  }),
  qwen36Benchmark({
    id: "ocrbench",
    name: "OCRBench",
    category: "documents",
    description: "Text recognition and document-oriented visual question answering.",
    scores: { qwen35_27: 89.4, qwen36_35: 90, qwen36_27: 89.4 },
  }),
  qwen36Benchmark({
    id: "erqa",
    name: "ERQA",
    category: "spatial",
    description: "Embodied and spatial relationship reasoning from visual scenes.",
    scores: { qwen35_27: 60.5, qwen35_397: 67.5, qwen36_35: 61.8, qwen36_27: 62.5 },
  }),
  qwen36Benchmark({
    id: "countbench",
    name: "CountBench",
    category: "spatial",
    description: "Visual counting accuracy over controlled and natural images.",
    scores: { qwen35_27: 97.8, qwen35_397: 97.2, qwen36_35: 96.1, qwen36_27: 97.8 },
  }),
  qwen36Benchmark({
    id: "refcoco-avg",
    name: "RefCOCO Average",
    category: "spatial",
    description: "Referring-expression grounding across the RefCOCO benchmark family.",
    scores: { qwen35_27: 90.9, qwen35_397: 92.3, qwen36_35: 92, qwen36_27: 92.5 },
  }),
  qwen36Benchmark({
    id: "embspatialbench",
    name: "EmbSpatialBench",
    category: "spatial",
    description: "Embodied spatial understanding in visually grounded environments.",
    scores: { qwen35_27: 84.5, qwen36_35: 84.3, qwen36_27: 84.6 },
  }),
  qwen36Benchmark({
    id: "refspatialbench",
    name: "RefSpatialBench",
    category: "spatial",
    description: "Fine-grained spatial reference and relationship understanding.",
    scores: { qwen35_27: 67.7, qwen36_35: 64.3, qwen36_27: 70 },
  }),
  qwen36Benchmark({
    id: "videomme-subs",
    name: "Video-MME",
    category: "video",
    description: "Long- and short-form video understanding across diverse domains.",
    protocol: "Video-MME with subtitles",
    scores: { qwen35_27: 87, qwen35_397: 87.5, qwen36_35: 86.6, qwen36_27: 87.7 },
  }),
  qwen36Benchmark({
    id: "videommmu",
    name: "VideoMMMU",
    category: "video",
    description: "College-level multidisciplinary reasoning over video inputs.",
    scores: { qwen35_27: 82.3, qwen35_397: 84.7, qwen36_35: 83.7, qwen36_27: 84.4 },
  }),
  qwen36Benchmark({
    id: "mlvu",
    name: "MLVU",
    category: "video",
    description: "Multi-task long-video understanding and reasoning.",
    scores: { qwen35_27: 85.9, qwen35_397: 86.7, qwen36_35: 86.2, qwen36_27: 86.6 },
  }),
  qwen36Benchmark({
    id: "mvbench",
    name: "MVBench",
    category: "video",
    description: "Temporal and multimodal understanding across twenty video tasks.",
    scores: { qwen35_27: 74.6, qwen35_397: 77.6, qwen36_35: 74.6, qwen36_27: 75.5 },
  }),
  qwen36Benchmark({
    id: "v-star",
    name: "V*",
    category: "agentic",
    description: "Visual search and reasoning over high-resolution images.",
    scores: { qwen35_27: 93.7, qwen35_397: 95.8, qwen36_35: 90.1, qwen36_27: 94.7 },
  }),
  qwen36Benchmark({
    id: "androidworld",
    name: "AndroidWorld",
    category: "agentic",
    description: "Interactive mobile-device tasks completed through visual and UI actions.",
    metric: "Task success (%)",
    scores: { qwen35_27: 64.2, qwen36_27: 70.3 },
  }),
  {
    id: "mmmu-pro",
    name: "MMMU-Pro",
    category: "multimodal",
    description: "College-level multimodal reasoning across many disciplines.",
    metric: "Accuracy (%)",
    protocol: "Standard result without external tools",
    maxScore: 100,
    results: [
      {
        repo: "moonshotai/Kimi-K2.6",
        score: 79.4,
        sourceUrl: KIMI_26,
        sourceLabel: "Moonshot model card",
      },
      qwen36("Qwen/Qwen3.5-397B-A17B", 79),
      {
        repo: "MiniMaxAI/MiniMax-M3",
        score: 78.1,
        sourceUrl: MINIMAX_M3,
        sourceLabel: "MiniMax model card",
      },
      qwen36("Qwen/Qwen3.6-27B", 75.8),
      qwen36("Qwen/Qwen3.6-35B-A3B", 75.3),
      qwen36("Qwen/Qwen3.5-27B", 75),
      {
        repo: "meta-llama/Llama-4-Maverick-17B-128E-Instruct",
        score: 59.6,
        sourceUrl: LLAMA_4,
        sourceLabel: "Meta model card",
      },
      {
        repo: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        score: 52.2,
        sourceUrl: LLAMA_4,
        sourceLabel: "Meta model card",
      },
    ],
  },
];

export function resolveOfficialBenchmarks(entries: ModelEntry[]): ResolvedBenchmark[] {
  const entriesByRepo = new Map<string, ModelEntry>();
  for (const entry of entries) {
    for (const artifact of entry.artifacts) entriesByRepo.set(artifact.repo, entry);
  }

  return OFFICIAL_BENCHMARKS.map((benchmark) => {
    const results = benchmark.results
      .flatMap((result) => {
        const entry = entriesByRepo.get(result.repo);
        return entry ? [{ ...result, entry }] : [];
      })
      .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
      .map((result, index, sorted) => ({
        ...result,
        rank: sorted.findIndex((candidate) => candidate.score === result.score) + 1,
      }));

    return { ...benchmark, results };
  }).filter((benchmark) => benchmark.results.length >= 2);
}
