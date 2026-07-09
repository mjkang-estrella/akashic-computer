import {
  Boxes,
  Database,
  Gauge,
  GitBranch,
  HardDrive,
  Search,
  Sparkles,
} from "lucide-react";

const families = [
  { name: "Qwen", detail: "Reasoning, coding, long context", active: true },
  { name: "DeepSeek", detail: "MoE reasoning and code models", active: false },
  { name: "Llama", detail: "General purpose foundation models", active: false },
  { name: "Gemma", detail: "Efficient Google open models", active: false },
  { name: "Mistral", detail: "European open-weight families", active: false },
];

const sizes = ["4B", "8B", "14B", "27B", "72B", "235B-A22B"];

const artifacts = [
  {
    repo: "Qwen/Qwen3.6-27B-Instruct",
    format: "BF16",
    runtime: "vLLM, Transformers",
    fit: "2x 48GB or 1x 80GB",
    score: "Reference quality",
    trust: "Official",
  },
  {
    repo: "nvidia/Qwen3.6-27B-Instruct-NVFP4",
    format: "NVFP4",
    runtime: "TensorRT-LLM, vLLM runtime dependent",
    fit: "1x 48GB target",
    score: "High quality, faster serving",
    trust: "Vendor",
  },
  {
    repo: "community/Qwen3.6-27B-Instruct-AWQ",
    format: "AWQ",
    runtime: "vLLM, AutoAWQ",
    fit: "1x 24GB to 48GB",
    score: "Small benchmark delta",
    trust: "Community",
  },
  {
    repo: "community/Qwen3.6-27B-Instruct-GGUF",
    format: "GGUF Q4/Q5/Q8",
    runtime: "llama.cpp, Ollama",
    fit: "Mac, CPU, consumer GPU",
    score: "Varies by quant",
    trust: "Community",
  },
];

const benchmarks = [
  { label: "MMLU Pro", value: "74.8", delta: "-0.7" },
  { label: "AIME", value: "61.2", delta: "-1.9" },
  { label: "LiveCodeBench", value: "43.5", delta: "-0.8" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#181713]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d9d3c5] pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#181713] text-[#f8f7f2]">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a5f28]">
                Akashic Computer
              </p>
              <h1 className="text-2xl font-semibold tracking-normal">
                Open-weight model atlas
              </h1>
            </div>
          </div>
          <label className="flex h-11 w-full items-center gap-2 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm text-[#5f5a50] shadow-sm md:w-96">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search model families and artifacts</span>
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-[#181713] outline-none placeholder:text-[#8a857a]"
              placeholder="Search Qwen, NVFP4, GGUF, coding..."
            />
          </label>
        </header>

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-lg border border-[#d9d3c5] bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <GitBranch size={16} aria-hidden="true" />
                Families
              </div>
              <div className="space-y-2">
                {families.map((family) => (
                  <button
                    key={family.name}
                    className={`w-full rounded-md border px-3 py-3 text-left transition ${
                      family.active
                        ? "border-[#181713] bg-[#f1eadc]"
                        : "border-transparent hover:border-[#d9d3c5] hover:bg-[#faf9f5]"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {family.name}
                    </span>
                    <span className="block text-xs leading-5 text-[#655f54]">
                      {family.detail}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[#d9d3c5] bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <HardDrive size={16} aria-hidden="true" />
                Hardware fit
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {["Mac", "24GB", "48GB", "80GB", "CPU", "DGX"].map((item) => (
                  <button
                    key={item}
                    className="h-9 rounded-md border border-[#d9d3c5] bg-[#faf9f5] font-medium hover:border-[#181713]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-5">
            <div className="rounded-lg border border-[#d9d3c5] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#2f7664]">
                    Model family
                  </p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-normal">
                    Qwen 3.6
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f5a50]">
                    Browse official checkpoints, tuned variants, quantized
                    artifacts, runtime compatibility, and benchmark deltas from
                    one family page.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md bg-[#edf6f2] px-3 py-2">
                    <div className="font-semibold">262K</div>
                    <div className="text-xs text-[#557066]">context</div>
                  </div>
                  <div className="rounded-md bg-[#f5efd9] px-3 py-2">
                    <div className="font-semibold">Apache</div>
                    <div className="text-xs text-[#786637]">license</div>
                  </div>
                  <div className="rounded-md bg-[#eef1f8] px-3 py-2">
                    <div className="font-semibold">Text</div>
                    <div className="text-xs text-[#58657c]">modality</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {sizes.map((size) => (
                  <button
                    key={size}
                    className={`h-10 min-w-24 rounded-md border px-4 text-sm font-semibold ${
                      size === "27B"
                        ? "border-[#181713] bg-[#181713] text-white"
                        : "border-[#d9d3c5] bg-[#faf9f5]"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-lg border border-[#d9d3c5] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e7e1d3] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Boxes size={16} aria-hidden="true" />
                    Qwen 3.6 27B artifacts
                  </div>
                  <button className="h-9 rounded-md bg-[#2f7664] px-3 text-sm font-semibold text-white">
                    Compare
                  </button>
                </div>
                <div className="divide-y divide-[#eee8dc]">
                  {artifacts.map((artifact) => (
                    <article
                      key={artifact.repo}
                      className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_minmax(0,1fr)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {artifact.repo}
                        </p>
                        <p className="mt-1 text-xs text-[#6b655a]">
                          Trust: {artifact.trust}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b655a]">Format</p>
                        <p className="text-sm font-semibold">
                          {artifact.format}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b655a]">Runtime</p>
                        <p className="text-sm">{artifact.runtime}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b655a]">Fit</p>
                        <p className="text-sm">{artifact.fit}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="space-y-5">
                <section className="rounded-lg border border-[#d9d3c5] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Gauge size={16} aria-hidden="true" />
                    Benchmark deltas
                  </div>
                  <div className="space-y-3">
                    {benchmarks.map((benchmark) => (
                      <div
                        key={benchmark.label}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm"
                      >
                        <span>{benchmark.label}</span>
                        <span className="font-semibold">{benchmark.value}</span>
                        <span className="rounded bg-[#f5efd9] px-2 py-1 text-xs text-[#786637]">
                          {benchmark.delta}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-[#d9d3c5] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Database size={16} aria-hidden="true" />
                    Convex data plan
                  </div>
                  <ul className="space-y-2 text-sm leading-6 text-[#5f5a50]">
                    <li>families, releases, variants</li>
                    <li>artifacts and quantization profiles</li>
                    <li>benchmarks with provenance</li>
                    <li>runtime and hardware compatibility</li>
                  </ul>
                </section>
              </aside>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
