import { RIG_PRESETS } from "@/lib/atlas/data";
import type { RigProfile } from "@/lib/atlas/types";

export function FitBar({
  presetId,
  manualGb,
  onlyRunnable,
  rig,
  onPreset,
  onManualGb,
  onOnlyRunnable,
}: {
  presetId: string;
  manualGb: number | null;
  onlyRunnable: boolean;
  rig: RigProfile;
  onPreset: (id: string) => void;
  onManualGb: (gb: number | null) => void;
  onOnlyRunnable: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-linesoft py-2.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        My rig
      </span>
      {RIG_PRESETS.map((preset) => {
        const active = !manualGb && preset.id === presetId;
        return (
          <button
            key={preset.id}
            aria-pressed={active}
            onClick={() => onPreset(preset.id)}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
              active
                ? "border-ink bg-ink text-paper"
                : "border-line bg-panel text-muted hover:border-ink"
            }`}
          >
            {preset.label}
          </button>
        );
      })}
      <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
        or
        <input
          type="number"
          min={4}
          max={2048}
          placeholder="GB"
          aria-label="Manual VRAM in GB"
          value={manualGb ?? ""}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onManualGb(Number.isFinite(v) && v > 0 ? v : null);
          }}
          className="w-16 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[12.5px]"
        />
        GB VRAM
      </label>
      <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold">
        <input
          type="checkbox"
          checked={onlyRunnable}
          onChange={(e) => onOnlyRunnable(e.target.checked)}
        />
        Only runnable
      </label>
      <span className="basis-full text-xs text-faint lg:ml-auto lg:basis-auto">
        {rig.manual
          ? `Exploring as ${rig.gb} GB GPU — clear the field to return to your saved rig.`
          : `Saved rig: ${rig.label}. Fit badges everywhere use it.`}
      </span>
    </div>
  );
}
