import { X } from "lucide-react";
import { BENCHES } from "@/lib/atlas/data";
import { fitOf } from "@/lib/atlas/fit";
import { learnTermForFormat } from "@/lib/atlas/learn";
import type { Artifact, RigProfile } from "@/lib/atlas/types";
import { uploaderDisplay } from "@/lib/atlas/naming";
import { DeltaChip, FitBadge } from "./badges";
import { LexiconHint } from "./LexiconHint";

export function CompareDrawer({
  artifacts,
  rig,
  onRemove,
  onClear,
}: {
  artifacts: Artifact[];
  rig: RigProfile;
  onRemove: (repo: string) => void;
  onClear: () => void;
}) {
  const labelCell = "whitespace-nowrap px-2.5 py-1.5 text-xs text-muted align-top";

  return (
    <div
      role="region"
      aria-label="Artifact comparison"
      className="fixed inset-x-0 bottom-0 z-40 max-h-[62vh] overflow-y-auto border-t-2 border-ink bg-panel shadow-[0_-8px_28px_rgba(0,0,0,0.14)] md:max-h-[46vh]"
    >
      <div className="mx-auto max-w-[1240px] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em]">
              Compare artifacts · {artifacts.length} selected
            </h3>
            <p className="mt-0.5 text-[11.5px] text-muted" aria-live="polite">
              {artifacts.length === 1
                ? "Choose one more artifact to compare. Up to four selections are preserved while you browse."
                : "Selections stay available across families and filters. Choose up to four artifacts."}
            </p>
          </div>
          <button
            onClick={onClear}
            aria-label="Clear artifact comparison"
            className="inline-flex h-11 flex-none items-center gap-1 rounded px-2 text-[12.5px] font-semibold text-muted hover:text-ink md:h-8"
          >
            Clear <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 divide-y divide-linesoft md:hidden">
          {artifacts.map((artifact, index) => {
            const fit = fitOf(artifact, rig);
            return (
              <section key={artifact.repo} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-[13px] font-semibold">Artifact {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(artifact.repo)}
                    aria-label={`Remove ${artifact.repo} from comparison`}
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-[7px] text-faint hover:bg-panel2 hover:text-ink"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
                <dl className="mt-1.5 space-y-1 text-[12.5px]">
                  <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="text-muted"><LexiconHint term="quantization">Quant</LexiconHint></dt>
                    <dd className="font-mono font-semibold">
                      <LexiconHint term={learnTermForFormat(artifact.format)} className="text-ink">
                        {artifact.format}
                      </LexiconHint>
                    </dd>
                  </div>
                  <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="text-muted"><LexiconHint term="provider">Provider</LexiconHint></dt>
                    <dd>{uploaderDisplay(artifact.repo)}</dd>
                  </div>
                  <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="text-muted">Repository</dt>
                    <dd className="min-w-0">
                      <a
                        href={`https://huggingface.co/${artifact.repo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all font-mono text-[11px] text-faint underline-offset-2 hover:text-ink hover:underline"
                      >
                        {artifact.repo}
                      </a>
                    </dd>
                  </div>
                </dl>
                <dl className="mt-2.5 grid grid-cols-2 gap-3 border-t border-linesoft pt-2.5">
                  <div>
                    <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">VRAM</dt>
                    <dd className="mt-0.5 font-mono text-[13px]">{artifact.minVramGb}–{artifact.recVramGb} GB</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">Fit</dt>
                    <dd className="mt-0.5"><FitBadge fit={fit} /></dd>
                  </div>
                </dl>
                {artifacts.length > 1 ? (
                  <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-linesoft pt-2.5">
                    {BENCHES.map((bench) => (
                      <div key={bench.key} className="flex items-center justify-between gap-2">
                        <dt className="text-[11px] text-muted">{bench.label}</dt>
                        <dd><DeltaChip delta={artifact.deltas[bench.key]} measured={artifact.measured} /></dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </section>
            );
          })}
        </div>

        <div
          className="mt-2 hidden overflow-x-auto md:block"
          tabIndex={0}
          aria-label="Selected artifact comparison; scroll horizontally for more columns"
        >
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="px-2.5 py-1.5" />
                {artifacts.map((artifact) => (
                  <th key={artifact.repo} className="border-b border-line px-2.5 py-1.5 text-left">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-[13px] font-semibold">Artifact</span>
                      <button
                        type="button"
                        onClick={() => onRemove(artifact.repo)}
                        aria-label={`Remove ${artifact.repo} from comparison`}
                        className="flex h-8 w-8 items-center justify-center rounded text-faint hover:bg-panel2 hover:text-ink"
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={labelCell}>Repo</td>
                {artifacts.map((artifact) => (
                  <td key={artifact.repo} className="break-all px-2.5 py-1.5 align-top font-mono text-[11px] text-faint">
                    <a href={`https://huggingface.co/${artifact.repo}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-ink hover:underline">
                      {artifact.repo}
                    </a>
                  </td>
                ))}
              </tr>
              <tr>
                <td className={labelCell}><LexiconHint term="quantization">Quant</LexiconHint></td>
                {artifacts.map((artifact) => (
                  <td key={artifact.repo} className="px-2.5 py-1.5 align-top font-mono text-[12.5px] font-semibold">
                    <LexiconHint term={learnTermForFormat(artifact.format)} className="text-ink">
                      {artifact.format}
                    </LexiconHint>
                  </td>
                ))}
              </tr>
              <tr>
                <td className={labelCell}><LexiconHint term="provider">Provider</LexiconHint></td>
                {artifacts.map((artifact) => <td key={artifact.repo} className="px-2.5 py-1.5 align-top text-[12.5px]">{uploaderDisplay(artifact.repo)}</td>)}
              </tr>
              <tr>
                <td className={labelCell}>VRAM</td>
                {artifacts.map((artifact) => <td key={artifact.repo} className="whitespace-nowrap px-2.5 py-1.5 align-top font-mono text-[13px] tabular-nums">{artifact.minVramGb}–{artifact.recVramGb} GB</td>)}
              </tr>
              <tr>
                <td className={labelCell}>Fit</td>
                {artifacts.map((artifact) => <td key={artifact.repo} className="px-2.5 py-1.5 align-top"><FitBadge fit={fitOf(artifact, rig)} /></td>)}
              </tr>
              {artifacts.length > 1
                ? BENCHES.map((bench) => (
                    <tr key={bench.key}>
                      <td className={labelCell}>{bench.label} Δ</td>
                      {artifacts.map((artifact) => <td key={artifact.repo} className="px-2.5 py-1.5 align-top"><DeltaChip delta={artifact.deltas[bench.key]} measured={artifact.measured} /></td>)}
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
