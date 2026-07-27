"use client";

import {
  type KeyboardEvent,
  useId,
  useMemo,
  useState,
} from "react";
import {
  INFERENCE_STACK,
  FINE_TUNING_METHODS,
  MODEL_TECHNIQUES,
  POST_TRAINING_STAGES,
  PRECISION_FORMATS,
  REPOSITORY_VIEWS,
  RUNTIME_MATRIX,
  estimateWeightMemory,
} from "@/lib/atlas/docs";

const PARAMETER_PRESETS = [7, 32, 70, 405] as const;

function segmentedButton(active: boolean) {
  return `min-h-11 rounded-[7px] border px-3 py-2 text-left text-[12.5px] font-semibold transition-colors ${
    active
      ? "border-ink bg-ink text-paper"
      : "border-line bg-panel text-muted hover:border-ink hover:text-ink"
  }`;
}

function handleTabListKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
      event.key,
    )
  ) {
    return;
  }

  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not(:disabled)',
    ),
  );
  const currentIndex = tabs.indexOf(
    event.currentTarget.ownerDocument.activeElement as HTMLButtonElement,
  );
  if (currentIndex < 0 || tabs.length === 0) return;

  event.preventDefault();
  let nextIndex = currentIndex;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = tabs.length - 1;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabs.length;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  }

  tabs[nextIndex].focus();
  tabs[nextIndex].click();
}

export function InferenceStackExplorer() {
  const [selectedId, setSelectedId] = useState(INFERENCE_STACK[0].id);
  const tabGroupId = useId();
  const selected =
    INFERENCE_STACK.find((layer) => layer.id === selectedId) ?? INFERENCE_STACK[0];
  const panelId = `${tabGroupId}-panel`;

  return (
    <div className="rounded-[10px] border border-line bg-panel p-4 sm:p-5">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Inference stack"
        onKeyDown={handleTabListKeyDown}
      >
        {INFERENCE_STACK.map((layer, index) => (
          <button
            key={layer.id}
            id={`${tabGroupId}-${layer.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected.id === layer.id}
            aria-controls={panelId}
            tabIndex={selected.id === layer.id ? 0 : -1}
            onClick={() => setSelectedId(layer.id)}
            className={`${segmentedButton(selected.id === layer.id)} flex-1 basis-[120px]`}
          >
            <span className="block font-mono text-[10px] font-normal opacity-65">
              {index + 1}
            </span>
            {layer.label}
          </button>
        ))}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tabGroupId}-${selected.id}-tab`}
        className="mt-5 grid gap-3 border-t border-linesoft pt-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6"
      >
        <div>
          <p className="font-mono text-[11px] font-semibold text-faint">
            {selected.question}
          </p>
          <p className="mt-2 text-[12px] text-muted">
            Example: <span className="font-medium text-ink">{selected.example}</span>
          </p>
        </div>
        <p className="max-w-[68ch] text-[14px] leading-relaxed">{selected.definition}</p>
      </div>
    </div>
  );
}

export function MoeExplorer() {
  const [activeExperts, setActiveExperts] = useState(2);
  const expertCount = 8;
  const activeShare = Math.round((activeExperts / expertCount) * 100);

  return (
    <div className="rounded-[10px] border border-line bg-panel p-4 sm:p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="grid grid-cols-4 gap-2" aria-label={`${activeExperts} of ${expertCount} experts active`}>
            {Array.from({ length: expertCount }, (_, index) => {
              const active = index < activeExperts;
              return (
                <div
                  key={index}
                  className={`flex aspect-[1.5] items-center justify-center rounded-[5px] border font-mono text-[11px] ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-panel2 text-faint"
                  }`}
                >
                  E{index + 1}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            The router selects experts per token. Different tokens can take different paths.
          </p>
        </div>
        <div>
          <label htmlFor="active-experts" className="text-[12.5px] font-semibold">
            Active experts per token
          </label>
          <input
            id="active-experts"
            type="range"
            min={1}
            max={expertCount}
            value={activeExperts}
            aria-valuetext={`${activeExperts} of ${expertCount} experts active`}
            onChange={(event) => setActiveExperts(Number(event.target.value))}
            className="mt-2 h-11 w-full accent-ink"
          />
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-linesoft pt-3">
            <span>
              <span className="block font-mono text-[18px] font-semibold">{expertCount}</span>
              <span className="text-[11.5px] text-muted">stored experts</span>
            </span>
            <span>
              <output
                htmlFor="active-experts"
                className="block font-mono text-[18px] font-semibold"
              >
                {activeShare}%
              </output>
              <span className="text-[11.5px] text-muted">active in this example</span>
            </span>
          </div>
        </div>
      </div>
      <p className="mt-5 border-t border-linesoft pt-4 text-[13px] leading-relaxed">
        A mixture-of-experts model can use fewer parameters for each token, but all expert
        weights still need to be stored or distributed. Active parameter count describes
        compute routing, not total model memory.
      </p>
    </div>
  );
}

export function TechniqueExplorer({
  defaultTechnique = "distillation",
}: {
  defaultTechnique?: (typeof MODEL_TECHNIQUES)[number]["id"];
} = {}) {
  const [selectedId, setSelectedId] =
    useState<(typeof MODEL_TECHNIQUES)[number]["id"]>(defaultTechnique);
  const tabGroupId = useId();
  const selected =
    MODEL_TECHNIQUES.find((technique) => technique.id === selectedId) ??
    MODEL_TECHNIQUES[0];
  const panelId = `${tabGroupId}-panel`;

  return (
    <div className="rounded-[10px] border border-line bg-panel">
      <div
        className="flex flex-wrap gap-2 border-b border-line p-3"
        role="tablist"
        aria-label="Model modification techniques"
        onKeyDown={handleTabListKeyDown}
      >
        {MODEL_TECHNIQUES.map((technique) => (
          <button
            key={technique.id}
            id={`${tabGroupId}-${technique.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected.id === technique.id}
            aria-controls={panelId}
            tabIndex={selected.id === technique.id ? 0 : -1}
            onClick={() => setSelectedId(technique.id)}
            className={segmentedButton(selected.id === technique.id)}
          >
            {technique.label}
          </button>
        ))}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tabGroupId}-${selected.id}-tab`}
        className="p-4 sm:p-5"
      >
        <p className="max-w-[68ch] text-[14px] font-medium leading-relaxed">
          {selected.purpose}
        </p>
        <dl className="mt-4 divide-y divide-linesoft border-y border-linesoft">
          {[
            ["What changes", selected.changes],
            ["Requires training", selected.needsTraining],
            ["Resulting identity", selected.identity],
            ["Main tradeoff", selected.tradeoff],
          ].map(([label, value]) => (
            <div
              key={label}
              className="grid gap-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5"
            >
              <dt className="font-mono text-[11px] font-semibold text-faint">{label}</dt>
              <dd className="text-[12.5px] leading-relaxed text-muted">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function PostTrainingPipeline() {
  const [selectedId, setSelectedId] =
    useState<(typeof POST_TRAINING_STAGES)[number]["id"]>(
      POST_TRAINING_STAGES[0].id,
    );
  const tabGroupId = useId();
  const selected =
    POST_TRAINING_STAGES.find((stage) => stage.id === selectedId) ??
    POST_TRAINING_STAGES[0];
  const panelId = `${tabGroupId}-panel`;

  return (
    <div className="rounded-[10px] border border-line bg-panel">
      <div
        className="flex gap-2 overflow-x-auto border-b border-line p-3"
        role="tablist"
        aria-label="Post-training stages"
        onKeyDown={handleTabListKeyDown}
      >
        {POST_TRAINING_STAGES.map((stage, index) => (
          <button
            key={stage.id}
            id={`${tabGroupId}-${stage.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected.id === stage.id}
            aria-controls={panelId}
            tabIndex={selected.id === stage.id ? 0 : -1}
            onClick={() => setSelectedId(stage.id)}
            className={`${segmentedButton(selected.id === stage.id)} min-w-[150px] flex-1`}
          >
            <span className="block font-mono text-[10px] font-normal opacity-65">
              {index + 1}
            </span>
            {stage.label}
          </button>
        ))}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tabGroupId}-${selected.id}-tab`}
        className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"
      >
        <div>
          <p className="font-mono text-[11px] font-semibold text-faint">Training input</p>
          <p className="mt-1 text-[13px] font-medium">{selected.input}</p>
          <p className="mt-4 font-mono text-[11px] font-semibold text-faint">
            Learning objective
          </p>
          <p className="mt-1 text-[13px] font-medium">{selected.objective}</p>
        </div>
        <div className="border-t border-linesoft pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
          <p className="font-mono text-[11px] font-semibold text-faint">What it changes</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{selected.result}</p>
        </div>
      </div>
    </div>
  );
}

export function FineTuningMethodExplorer() {
  const [selectedId, setSelectedId] =
    useState<(typeof FINE_TUNING_METHODS)[number]["id"]>(
      FINE_TUNING_METHODS[1].id,
    );
  const tabGroupId = useId();
  const selected =
    FINE_TUNING_METHODS.find((method) => method.id === selectedId) ??
    FINE_TUNING_METHODS[0];
  const panelId = `${tabGroupId}-panel`;

  return (
    <div className="rounded-[10px] border border-line bg-panel">
      <div
        className="flex flex-wrap gap-2 border-b border-line p-3"
        role="tablist"
        aria-label="Fine-tuning methods"
        onKeyDown={handleTabListKeyDown}
      >
        {FINE_TUNING_METHODS.map((method) => (
          <button
            key={method.id}
            id={`${tabGroupId}-${method.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected.id === method.id}
            aria-controls={panelId}
            tabIndex={selected.id === method.id ? 0 : -1}
            onClick={() => setSelectedId(method.id)}
            className={segmentedButton(selected.id === method.id)}
          >
            {method.label}
          </button>
        ))}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tabGroupId}-${selected.id}-tab`}
        className="p-4 sm:p-5"
      >
        <dl className="divide-y divide-linesoft border-y border-linesoft">
          {[
            ["Trainable weights", selected.trainable],
            ["Base weights", selected.baseWeights],
            ["Optimizer state", selected.optimizerState],
            ["Release artifact", selected.output],
            ["Useful when", selected.useWhen],
          ].map(([label, value]) => (
            <div
              key={label}
              className="grid gap-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5"
            >
              <dt className="font-mono text-[11px] font-semibold text-faint">{label}</dt>
              <dd className="text-[12.5px] leading-relaxed text-muted">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function WeightMemoryEstimator({
  defaultParameters = 32,
  defaultFormat = "nvfp4",
}: {
  defaultParameters?: number;
  defaultFormat?: (typeof PRECISION_FORMATS)[number]["id"];
} = {}) {
  const [parameters, setParameters] = useState(defaultParameters);
  const [formatId, setFormatId] =
    useState<(typeof PRECISION_FORMATS)[number]["id"]>(defaultFormat);
  const format =
    PRECISION_FORMATS.find((candidate) => candidate.id === formatId) ??
    PRECISION_FORMATS[0];
  const estimate = useMemo(
    () => estimateWeightMemory(parameters, format.effectiveBits),
    [parameters, format.effectiveBits],
  );

  return (
    <div className="rounded-[10px] border border-line bg-panel">
      <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-5">
        <div>
          <label htmlFor="parameter-count" className="text-[12px] font-semibold">
            Parameter count
          </label>
          <div className="mt-2 flex min-h-11 items-center rounded-[7px] border border-line bg-paper px-3">
            <input
              id="parameter-count"
              type="number"
              min={0.1}
              max={2000}
              step={0.1}
              value={parameters}
              onChange={(event) => {
                const value = Number(event.target.value);
                setParameters(Number.isFinite(value) ? Math.max(0, value) : 0);
              }}
              className="min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none"
            />
            <span className="font-mono text-[11px] text-faint">billion</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Parameter presets">
            {PARAMETER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={parameters === preset}
                onClick={() => setParameters(preset)}
                className={`min-h-11 rounded-[5px] px-3 py-1 font-mono text-[11px] ${
                  parameters === preset
                    ? "bg-ink text-paper"
                    : "bg-panel2 text-muted hover:text-ink"
                }`}
              >
                {preset}B
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="precision-format" className="text-[12px] font-semibold">
            Weight representation
          </label>
          <select
            id="precision-format"
            value={format.id}
            onChange={(event) =>
              setFormatId(event.target.value as (typeof PRECISION_FORMATS)[number]["id"])
            }
            className="mt-2 min-h-11 w-full rounded-[7px] border border-line bg-paper px-3 font-mono text-[12px]"
          >
            {PRECISION_FORMATS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label} · {candidate.calculationLabel}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            {format.description}
          </p>
        </div>
      </div>
      <div
        className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5"
        aria-live="polite"
        aria-atomic="true"
      >
        <div>
          <span className="font-mono text-[11px] font-semibold text-faint">
            Raw weight estimate
          </span>
          <strong className="mt-1 block font-mono text-[27px] font-semibold">
            {estimate.weightGiB.toFixed(1)} GiB
          </strong>
          <span className="text-[11.5px] text-muted">
            parameters × effective bits, converted to GiB
          </span>
        </div>
        <div>
          <span className="font-mono text-[11px] font-semibold text-faint">
            Planning floor
          </span>
          <strong className="mt-1 block font-mono text-[27px] font-semibold">
            {estimate.planningGiB.toFixed(1)} GiB
          </strong>
          <span className="text-[11.5px] text-muted">
            raw estimate + 15% loading headroom
          </span>
        </div>
      </div>
      <p className="border-t border-linesoft px-4 py-3 text-[11.5px] leading-relaxed text-muted sm:px-5">
        This is a weight-capacity estimate, not a runnable guarantee. KV cache, context,
        batching, temporary buffers, higher-precision tensors, and runtime behavior require
        additional memory. {format.caveat}
      </p>
    </div>
  );
}

export function RepositoryInspector() {
  const [selectedId, setSelectedId] =
    useState<(typeof REPOSITORY_VIEWS)[number]["id"]>(REPOSITORY_VIEWS[0].id);
  const tabGroupId = useId();
  const selected =
    REPOSITORY_VIEWS.find((view) => view.id === selectedId) ?? REPOSITORY_VIEWS[0];
  const panelId = `${tabGroupId}-panel`;

  return (
    <div className="grid rounded-[10px] border border-line bg-panel md:grid-cols-[190px_minmax(0,1fr)]">
      <div
        className="border-b border-line p-2 md:border-r md:border-b-0"
        role="tablist"
        aria-label="Repository inspection areas"
        onKeyDown={handleTabListKeyDown}
      >
        {REPOSITORY_VIEWS.map((view) => (
          <button
            key={view.id}
            id={`${tabGroupId}-${view.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected.id === view.id}
            aria-controls={panelId}
            tabIndex={selected.id === view.id ? 0 : -1}
            onClick={() => setSelectedId(view.id)}
            className={`block min-h-11 w-full rounded-[7px] px-3 py-2 text-left text-[12.5px] font-semibold ${
              selected.id === view.id
                ? "bg-ink text-paper"
                : "text-muted hover:bg-panel2 hover:text-ink"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tabGroupId}-${selected.id}-tab`}
        className="p-4 sm:p-5"
      >
        <p className="font-mono text-[11px] font-semibold text-faint">Look for</p>
        <p className="mt-2 max-w-[66ch] text-[14px] font-medium leading-relaxed">
          {selected.lookFor}
        </p>
        <p className="mt-5 border-t border-linesoft pt-4 text-[12.5px] leading-relaxed text-muted">
          {selected.warning}
        </p>
      </div>
    </div>
  );
}

export function RuntimeMatrix() {
  return (
    <div
      className="overflow-x-auto border-y border-line"
      tabIndex={0}
      role="region"
      aria-label="Runtime comparison table. Scroll horizontally for additional columns."
    >
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="font-mono text-[10px] font-semibold text-faint">
            <th className="border-b border-line px-2 py-2.5">Runtime</th>
            <th className="border-b border-line px-2 py-2.5">Role</th>
            <th className="border-b border-line px-2 py-2.5">Useful when</th>
            <th className="border-b border-line px-2 py-2.5">Artifact path</th>
          </tr>
        </thead>
        <tbody>
          {RUNTIME_MATRIX.map((runtime) => (
            <tr key={runtime.name} className="border-b border-linesoft last:border-b-0">
              <th className="px-2 py-3 align-top text-[13px] font-semibold">
                {runtime.name}
              </th>
              <td className="px-2 py-3 align-top text-[12px] text-muted">
                {runtime.role}
              </td>
              <td className="max-w-[32ch] px-2 py-3 align-top text-[12px] leading-relaxed text-muted">
                {runtime.bestFor}
              </td>
              <td className="max-w-[30ch] px-2 py-3 align-top font-mono text-[10.5px] leading-relaxed text-faint">
                {runtime.artifactPath}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
