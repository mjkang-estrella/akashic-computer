import { HARDWARE_PRESETS, RIG_PRESETS } from "@/lib/atlas/data";
import type { RigProfile } from "@/lib/atlas/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChipIcon } from "@hugeicons/core-free-icons";

const hardwareGroups = [...new Set(HARDWARE_PRESETS.map((preset) => preset.group ?? "Other"))];

/** Opens the header budget menu from elsewhere on the page and focuses its hardware list. */
export function openBudgetMenu() {
  const menu = document.querySelector<HTMLDetailsElement>("details[data-budget-menu]");
  if (!menu) return;
  menu.open = true;
  menu.scrollIntoView({ block: "nearest" });
  menu.querySelector<HTMLSelectElement>("select")?.focus();
}

function closeMenu(element: Element) {
  const details = element.closest("details");
  if (details) details.open = false;
}

export function FitBar({
  presetId,
  manualGb,
  rig,
  onPreset,
  onManualGb,
  onClear,
}: {
  presetId: string | null;
  manualGb: number | null;
  rig: RigProfile | null;
  onPreset: (id: string | null) => void;
  onManualGb: (gb: number | null) => void;
  onClear: () => void;
}) {
  const hardwareId = !manualGb && HARDWARE_PRESETS.some((preset) => preset.id === presetId) ? presetId : "";

  return (
    <details data-budget-menu className="group relative">
      <summary
        aria-label={rig ? `Memory budget, ${rig.gb} GB` : "Memory budget not set"}
        title={rig ? `${rig.label} · ${rig.gb} GB` : "Set a memory budget to check fit"}
        className="flex h-11 min-w-11 list-none cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line bg-panel px-3 text-[12.5px] font-semibold text-muted transition-colors hover:border-ink hover:text-ink sm:h-9 sm:min-w-9 [&::-webkit-details-marker]:hidden"
      >
        <HugeiconsIcon icon={ChipIcon} size={18} strokeWidth={1.7} aria-hidden="true" className="flex-none" />
        <span className="hidden font-mono sm:inline">{rig ? `${rig.gb} GB` : "Budget"}</span>
      </summary>
      <div className="profile-popover absolute right-0 top-full z-30 mt-2 w-[min(380px,calc(100vw-40px))] rounded-[10px] border border-ink bg-panel p-3.5">
        <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-linesoft pb-2.5">
          <span className="text-[13px] font-semibold">Memory budget</span>
          <span className="font-mono text-[13px] text-muted">{rig ? `${rig.gb} GB` : "Not set"}</span>
        </div>
        <label className="block text-[11.5px] font-semibold text-muted">
          Hardware
          <select
            value={hardwareId ?? ""}
            onChange={(event) => onPreset(event.target.value || null)}
            className="mt-1 block min-h-11 w-full rounded-[7px] border border-line bg-paper px-2.5 text-[12.5px] font-normal text-ink sm:min-h-9"
          >
            <option value="">Choose a GPU or computer…</option>
            {hardwareGroups.map((group) => (
              <optgroup key={group} label={group}>
                {HARDWARE_PRESETS.filter((preset) => (preset.group ?? "Other") === group).map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {rig?.detail ? <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{rig.detail}</p> : null}
        <p className="mt-3 text-[11.5px] font-semibold text-muted">Or a total budget</p>
        <div className="mt-1 grid grid-cols-5 gap-1.5">
          {RIG_PRESETS.map((preset) => {
            const active = !manualGb && preset.id === presetId;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={(event) => {
                  onPreset(preset.id);
                  closeMenu(event.currentTarget);
                }}
                className={`min-h-11 rounded-[7px] border px-1 py-1 text-[12px] font-semibold sm:min-h-9 ${
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
          <span>Custom memory</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={4}
              max={2048}
              placeholder="GB"
              aria-label="Manual memory budget in GB"
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
        <div className="mt-2.5 flex items-start justify-between gap-3">
          <p className="text-[11.5px] text-muted">A total budget does not describe device topology or confirm runtime fit.</p>
          {rig ? (
            <button
              type="button"
              onClick={(event) => {
                onClear();
                closeMenu(event.currentTarget);
              }}
              className="min-h-9 flex-none text-[11.5px] font-semibold text-meta underline-offset-2 hover:underline"
            >
              Clear budget
            </button>
          ) : null}
        </div>
      </div>
    </details>
  );
}
