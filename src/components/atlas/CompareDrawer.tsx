import { BENCHES } from "@/lib/atlas/data";
import { X } from "lucide-react";
import { fitOf } from "@/lib/atlas/fit";
import type { Artifact, RigProfile } from "@/lib/atlas/types";
import { uploaderDisplay } from "@/lib/atlas/naming";
import { DeltaChip, FitBadge, PropertyChip, TrustBadge } from "./badges";

export function CompareDrawer({
  title,
  artifacts,
  rig,
  onClear,
}: {
  title: string;
  artifacts: Artifact[];
  rig: RigProfile;
  onClear: () => void;
}) {
  const labelCell =
    "whitespace-nowrap px-2.5 py-1.5 text-xs text-muted align-top";
  return (
    <div
      role="region"
      aria-label="Artifact comparison"
      className="fixed inset-x-0 bottom-0 z-40 max-h-[46vh] overflow-y-auto border-t-2 border-ink bg-panel shadow-[0_-8px_28px_rgba(0,0,0,0.14)]"
    >
      <div className="mx-auto max-w-[1240px] px-5 pb-4 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2.5">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em]">
            Compare artifacts: {title}
          </h3>
          <button
            onClick={onClear}
            aria-label="Clear artifact comparison"
            className="inline-flex min-h-8 items-center gap-1 rounded px-2 py-1 text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            Clear <X size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="px-2.5 py-1.5" />
                {artifacts.map((a) => (
                  <th
                    key={a.repo}
                    className="border-b border-line px-2.5 py-1.5 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[12.5px]">{a.format}</span>
                      <PropertyChip tone="meta">
                        {uploaderDisplay(a.repo)}
                      </PropertyChip>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={labelCell}>Repo</td>
                {artifacts.map((a) => (
                  <td
                    key={a.repo}
                    className="break-all px-2.5 py-1.5 align-top font-mono text-[11px] text-faint"
                  >
                    {a.repo}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={labelCell}>Trust</td>
                {artifacts.map((a) => (
                  <td key={a.repo} className="px-2.5 py-1.5 align-top">
                    <TrustBadge trust={a.trust} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className={labelCell}>VRAM</td>
                {artifacts.map((a) => (
                  <td
                    key={a.repo}
                    className="whitespace-nowrap px-2.5 py-1.5 align-top font-mono text-[13px] tabular-nums"
                  >
                    {a.minVramGb}–{a.recVramGb} GB
                  </td>
                ))}
              </tr>
              <tr>
                <td className={labelCell}>Fit</td>
                {artifacts.map((a) => (
                  <td key={a.repo} className="px-2.5 py-1.5 align-top">
                    <FitBadge fit={fitOf(a, rig)} />
                  </td>
                ))}
              </tr>
              {BENCHES.map((b) => (
                <tr key={b.key}>
                  <td className={labelCell}>{b.label} Δ</td>
                  {artifacts.map((a) => (
                    <td key={a.repo} className="px-2.5 py-1.5 align-top">
                      <DeltaChip delta={a.deltas[b.key]} measured={a.measured} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-faint">
          Difference from the BF16 reference. An asterisk marks an estimate;
          n/a means no data.
        </p>
      </div>
    </div>
  );
}
