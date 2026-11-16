"use client";

import { useId, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUpRight01Icon, ComputerTerminal01Icon, Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { RunCommand } from "@/lib/atlas/runCommands";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        window.setTimeout(() => setState("idle"), 1600);
      }}
      aria-label={`Copy ${label} command`}
      title={state === "failed" ? "Copy unavailable; select the command instead" : "Copy command"}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-[7px] text-muted hover:bg-panel2 hover:text-ink"
    >
      <HugeiconsIcon icon={state === "copied" ? Tick02Icon : Copy01Icon} size={15} strokeWidth={1.8} aria-hidden="true" />
      <span className="sr-only" role="status">{state === "copied" ? "Copied" : state === "failed" ? "Copy unavailable" : ""}</span>
    </button>
  );
}

/**
 * Per-artifact starting commands. Renders two grid items: the row's "Run locally" toggle
 * cell and, when open, a full-width command panel.
 */
export function RunCommands({ commands, repo }: { commands: RunCommand[]; repo: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <div className="flex items-center gap-1 pl-11 md:-ml-2 md:pl-0">
        {commands.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`Run ${repo} locally`}
            onClick={() => setOpen((value) => !value)}
            title="Run locally"
            className={`inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-[7px] px-2 text-[11.5px] font-semibold hover:bg-panel2 hover:text-ink ${open ? "bg-panel2 text-ink" : "text-meta"}`}
          >
            <HugeiconsIcon icon={ComputerTerminal01Icon} size={17} strokeWidth={1.8} aria-hidden="true" />
            {/* The column header names the action on wider screens. */}
            <span className="md:hidden">Run locally</span>
            <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : null}
      </div>
      {commands.length > 0 ? (
        <div id={panelId} className="min-w-0 pl-11 md:col-span-full md:pl-[56px]" hidden={!open}>
          <ul className="divide-y divide-linesoft border-y border-linesoft">
            {commands.map((command) => (
              <li key={command.runtime} className="grid gap-1 py-2 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-3">
                <span className="pt-1 text-[11.5px] font-semibold">{command.runtime}</span>
                <span className="min-w-0">
                  {command.command ? (
                    <span className="flex items-center gap-1 rounded-[6px] bg-paper pl-2.5">
                      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-2 font-mono text-[11.5px]">{command.command}</code>
                      <CopyButton text={command.command} label={command.runtime} />
                    </span>
                  ) : command.href ? (
                    <a href={command.href} className="inline-flex min-h-9 items-center gap-1 text-[11.5px] font-semibold text-meta hover:text-ink">
                      Open in {command.runtime}
                      <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} strokeWidth={1.8} aria-hidden="true" />
                    </a>
                  ) : null}
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted">{command.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
