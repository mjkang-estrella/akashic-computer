import { RIG_PRESETS } from "@/lib/atlas/data";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserCircleIcon } from "@hugeicons/core-free-icons";

export function FitBar({
  presetId,
  manualGb,
  onPreset,
  onManualGb,
}: {
  presetId: string;
  manualGb: number | null;
  onPreset: (id: string) => void;
  onManualGb: (gb: number | null) => void;
}) {
  const selectedGb =
    manualGb ?? RIG_PRESETS.find((preset) => preset.id === presetId)?.gb ?? 48;

  return (
    <details className="group relative">
      <summary
        aria-label={`Hardware profile, ${selectedGb} GB VRAM`}
        title={`${selectedGb} GB VRAM`}
        className="flex h-11 w-11 list-none cursor-pointer items-center justify-center rounded-full border border-line bg-panel text-muted transition-colors hover:border-ink hover:text-ink sm:h-9 sm:w-9 [&::-webkit-details-marker]:hidden"
      >
        <HugeiconsIcon
          icon={UserCircleIcon}
          size={23}
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-[min(360px,calc(100vw-40px))] rounded-[10px] border border-ink bg-panel p-3.5">
        <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-linesoft pb-2.5">
          <span className="text-[13px] font-semibold">VRAM profile</span>
          <span className="font-mono text-[13px] text-muted">{selectedGb} GB</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
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
                className={`min-h-11 rounded-[7px] border px-2 py-1 text-[12.5px] font-semibold sm:min-h-9 ${
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper text-muted hover:border-ink"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <label className="mt-2.5 flex min-h-11 items-center justify-between gap-2 rounded-[7px] border border-line bg-paper px-2.5 text-[12.5px] text-muted sm:min-h-9">
          <span>Custom VRAM</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={4}
              max={2048}
              placeholder="GB"
              aria-label="Manual VRAM in GB"
              value={manualGb ?? ""}
              onChange={(event) => {
                const value = parseInt(event.target.value, 10);
                onManualGb(
                  Number.isFinite(value)
                    ? Math.min(2048, Math.max(4, value))
                    : null,
                );
              }}
              className="w-16 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[12.5px] text-ink"
            />
            GB
          </span>
        </label>
      </div>
    </details>
  );
}
