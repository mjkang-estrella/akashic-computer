"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUpRight01Icon, Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
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

/** Per-artifact starting commands, collapsed so the artifact table stays scannable. */
export function RunCommands({ commands, repo }: { commands: RunCommand[]; repo: string }) {
  if (commands.length === 0) return null;
  return (
    <details className="motion-disclosure group/run min-w-0 md:col-span-full md:pl-[56px]">
      <summary
        aria-label={`Run ${repo} locally`}
        className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 pl-11 text-[11.5px] font-semibold text-meta marker:hidden hover:text-ink md:pl-0"
      >
        Run locally · {commands.map((command) => command.runtime).join(", ")}
        <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} aria-hidden="true" className="transition-transform group-open/run:rotate-180" />
      </summary>
      <div className="disclosure-body">
        <div className="disclosure-content">
          <ul className="mt-1 divide-y divide-linesoft border-y border-linesoft">
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
                  <span className="mt-1 block text-[10.5px] leading-relaxed text-muted">{command.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
