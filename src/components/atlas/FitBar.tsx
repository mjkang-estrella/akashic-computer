import { RIG_PRESETS } from "@/lib/atlas/data";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

export function FitBar({
  presetId,
  manualGb,
  onlyRunnable,
  onPreset,
  onManualGb,
  onOnlyRunnable,
}: {
  presetId: string;
  manualGb: number | null;
  onlyRunnable: boolean;
  onPreset: (id: string) => void;
  onManualGb: (gb: number | null) => void;
  onOnlyRunnable: (v: boolean) => void;
}) {
  const selectedGb =
    manualGb ?? RIG_PRESETS.find((preset) => preset.id === presetId)?.gb ?? 48;

  return (
    <details className="relative">
      <summary className="flex min-h-8 list-none cursor-pointer items-center gap-1.5 rounded-[7px] border border-line bg-panel px-2.5 py-1 text-[12.5px] font-semibold text-muted hover:border-ink [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal size={14} aria-hidden="true" />
        VRAM: {selectedGb} GB
        {onlyRunnable ? <span className="text-verify">· runnable only</span> : null}
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-[min(520px,calc(100vw-40px))] rounded-[10px] border border-ink bg-panel p-3.5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          Capacity filter
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RIG_PRESETS.map((preset) => {
            const active = !manualGb && preset.id === presetId;
            return (
              <button
                key={preset.id}
                aria-pressed={active}
                onClick={(event) => {
                  onPreset(preset.id);
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                }}
                className={`min-h-8 rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper text-muted hover:border-ink"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <label className="flex min-h-8 items-center gap-1.5 text-[12.5px] text-muted">
            Custom
            <input
              type="number"
              min={4}
              max={2048}
              placeholder="GB"
              aria-label="Manual VRAM in GB"
              value={manualGb ?? ""}
              onChange={(event) => {
                const value = parseInt(event.target.value, 10);
                onManualGb(Number.isFinite(value) && value > 0 ? value : null);
              }}
              className="w-16 rounded-md border border-line bg-paper px-2 py-1 font-mono text-[12.5px]"
            />
            GB
          </label>
        </div>
        <label className="mt-2 flex min-h-8 cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold">
          <input
            type="checkbox"
            checked={onlyRunnable}
            onChange={(event) => onOnlyRunnable(event.target.checked)}
          />
          Only show runnable
        </label>
        <p className="mt-1 text-xs text-faint">
          Capacity estimate only. Runtime support remains listed per artifact.
        </p>
      </div>
    </details>
  );
}
