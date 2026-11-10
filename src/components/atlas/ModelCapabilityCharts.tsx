"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CapabilityComparison, CapabilityMetric, CapabilityModel } from "@/lib/atlas/capabilityTypes";

const scoreLabel = (value: number | null | undefined) => value == null ? "—" : Number(value.toFixed(1)).toString();

function BenchmarkChart({ metric, models }: { metric: CapabilityMetric; models: CapabilityModel[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(280);
  const titleId = useId();
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.floor(entry.contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const sorted = [...models].sort((a, b) => {
    const left = a.scores[metric.id], right = b.scores[metric.id];
    if (left == null) return right == null ? Number(b.current) - Number(a.current) || a.name.localeCompare(b.name) : 1;
    if (right == null) return -1;
    return right - left || Number(b.current) - Number(a.current) || a.name.localeCompare(b.name);
  });
  const maximum = Math.max(25, Math.ceil(Math.max(0, ...sorted.map(m => m.scores[metric.id] ?? 0)) / 25) * 25);
  const left = 40, top = 18, baseline = 208, step = (width - left - 8) / Math.max(1, sorted.length);
  const barWidth = Math.min(44, step * 0.73);
  return <figure className="min-w-0" aria-labelledby={titleId}>
    <figcaption id={titleId} className="font-display text-[17px] font-semibold">{metric.name}</figcaption>
    <div ref={container} className="mt-3 h-[350px]">
      <svg width="100%" height="350" viewBox={`0 0 ${width} 350`} role="img" aria-labelledby={titleId}>
        <desc>{metric.protocol}. Higher is better. Current model highlighted in blue. Missing scores are shown as a dash. Exact values and sources follow in Sources and evaluation settings.</desc>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = maximum * tick / 4, y = baseline - (baseline - top) * tick / 4;
          return <g key={tick}>
            <line x1={left} x2={width - 8} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={left - 7} y={y + 4} textAnchor="end" fill="var(--muted)" className="font-mono text-[11px]">{scoreLabel(value)}</text>
          </g>;
        })}
        {sorted.map((model, index) => {
          const value = model.scores[metric.id] ?? null, x = left + step * (index + 0.5);
          const height = value === null ? 0 : (baseline - top) * value / maximum;
          const y = baseline - height;
          const name = model.name.length > 33 ? `${model.name.slice(0, 30)}…` : model.name;
          const words = name.split(" ");
          const lines: string[] = [];
          for (const word of words) {
            if (!lines.length || `${lines[lines.length - 1]} ${word}`.length > 17) lines.push(word);
            else lines[lines.length - 1] += ` ${word}`;
          }
          return <g key={model.id}>
            <title>{`${model.configuration}${model.current ? " · Current model" : ""}${model.closed ? " · Closed anchor" : ""}: ${value === null ? "Not available" : `${scoreLabel(value)} ${metric.unit}`}`}</title>
            {value !== null && height > 0 ? <>
              <rect x={x - barWidth / 2} y={y} width={barWidth} height={height} rx={4} fill={model.current ? "var(--meta)" : "var(--faint)"} />
              <rect x={x - barWidth / 2} y={Math.max(y, baseline - 4)} width={barWidth} height={Math.min(4, height)} fill={model.current ? "var(--meta)" : "var(--faint)"} />
            </> : null}
            <text x={x} y={height >= 30 ? y + height * 0.6 : y - 7} textAnchor="middle"
              fill={height >= 30 ? "var(--panel)" : model.current ? "var(--meta)" : "var(--muted)"} className="font-mono text-[11px] font-semibold">{scoreLabel(value)}</text>
            <text transform={`translate(${x + 4},${baseline + 18}) rotate(-58)`} textAnchor="end"
              fill={model.current ? "var(--meta)" : "var(--foreground)"} className={`font-sans text-[11px] ${model.current ? "font-semibold" : ""}`}>
              {lines.map((line, lineIndex) => <tspan key={lineIndex} x={0} dy={lineIndex ? 13 : 0}>{line}</tspan>)}
            </text>
          </g>;
        })}
      </svg>
    </div>
  </figure>;
}

export function ModelCapabilityCharts({ comparison }: { comparison: CapabilityComparison }) {
  const [includeClosed, setIncludeClosed] = useState(true);
  const models = comparison.models.filter(m => includeClosed || !m.closed);
  const hasAnchors = comparison.models.some(m => m.closed);
  return <section className="border-b border-line py-5" aria-labelledby="capability-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="capability-title" className="font-display text-[19px] font-semibold">Capability</h2>
      <div className="flex flex-wrap items-center gap-4 text-[12px]">
        <span className="rounded-[4px] bg-panel2 px-2 py-1 text-muted">{comparison.group}</span>
        {hasAnchors ? <label className="inline-flex min-h-9 cursor-pointer items-center gap-2"><input type="checkbox" checked={includeClosed} onChange={e => setIncludeClosed(e.target.checked)} className="accent-meta" />Closed anchors</label> : null}
      </div>
    </div>
    <div className="mt-5 grid grid-cols-1 gap-5 min-[700px]:grid-cols-3">
      {comparison.metrics.map(metric => <BenchmarkChart key={metric.id} metric={metric} models={models} />)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-meta" aria-hidden="true" />Current model</span>
      <span>{comparison.source === "Artificial Analysis" ? <a href="https://artificialanalysis.ai/" target="_blank" rel="noreferrer" className="text-meta hover:underline">Artificial Analysis ↗</a> : "Creator reports"}{comparison.retrievedAt ? ` · ${comparison.retrievedAt}` : ""}</span>
    </div>
    <details className="mt-3 text-[12px]">
      <summary className="cursor-pointer py-2 text-muted">Sources & evaluation settings</summary>
      <p className="my-3 text-muted">Checkpoint-level results; quantized artifacts are not individually evaluated. Missing scores are unknown, not zero. {comparison.source === "Artificial Analysis" ? "The highest published reasoning-effort configuration is selected for each checkpoint; exact settings are listed below. Peer groups prioritize model role, then total parameter scale. Closed models are reference anchors." : "Creator reports may use different evaluation settings; consult each linked report."}</p>
      <ul className="mb-3 space-y-1 text-muted">{comparison.metrics.map(m => <li key={m.id}>{m.name}: {m.protocol} · {m.unit}</li>)}</ul>
      <div className="overflow-x-auto"><table className="w-full text-left text-[12px]">
        <caption className="sr-only">Capability scores and exact evaluation configurations</caption>
        <thead><tr className="border-b border-line"><th className="py-2 pr-4 font-medium">Model / configuration</th>{comparison.metrics.map(m => <th key={m.id} className="px-2 py-2 text-right font-medium">{m.name}</th>)}</tr></thead>
        <tbody>{models.map(m => <tr key={m.id} className={`border-b border-linesoft ${m.current ? "text-meta" : ""}`}>
          <th scope="row" className="py-3 pr-4 font-normal">{m.sourceUrl ? <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{m.configuration} ↗</a> : m.configuration}{m.current ? " · Current" : ""}{m.closed ? " · Closed" : ""}</th>
          {comparison.metrics.map(metric => <td key={metric.id} className="px-2 py-3 text-right font-mono">{m.evidence?.[metric.id] ? <a href={m.evidence[metric.id].url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-4" title={[m.evidence[metric.id].label, m.evidence[metric.id].note].filter(Boolean).join(" · ")}>{scoreLabel(m.scores[metric.id])}</a> : scoreLabel(m.scores[metric.id])}</td>)}
        </tr>)}</tbody>
      </table></div>
    </details>
  </section>;
}
