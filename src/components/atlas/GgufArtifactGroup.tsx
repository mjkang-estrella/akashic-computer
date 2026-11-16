"use client";

import { useId, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";
import { gbLabel } from "@/lib/atlas/fit";
import type { GgufFile } from "@/lib/atlas/ggufFiles";
import type { Artifact, ContextChoice } from "@/lib/atlas/types";
import { uploaderDisplay } from "@/lib/atlas/naming";
import { runCommandsFor } from "@/lib/atlas/runCommands";
import { ARTIFACT_ROW_COLUMNS } from "./artifactTable";
import { RunCommands } from "./RunCommands";

/**
 * A GGUF repository holds many quantizations. It shows as one collapsed row spanning the
 * real file sizes; expanding lists each file in the same columns with its own run commands.
 */
export function GgufArtifactGroup({
  artifact,
  vendor,
  tag,
  files,
  kvBytes,
  budgetGb,
  context,
  selected,
  disabled,
  onCheck,
}: {
  artifact: Artifact;
  /** The model's creator, named in the official-release tooltip. */
  vendor: string;
  /** Distinguishes this repo from another GGUF repo by the same provider, e.g. "QAT". */
  tag?: string;
  files: GgufFile[];
  /** KV cache at the selected context, borrowed from a sibling artifact of the same model. */
  kvBytes: number;
  budgetGb: number | null;
  context: ContextChoice;
  selected: boolean;
  disabled: boolean;
  onCheck: (repo: string, on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const totalGb = (file: GgufFile) => (file.bytes + kvBytes) / 1e9;
  const largest = totalGb(files[0]);
  const smallest = totalGb(files[files.length - 1]);
  const range = files.length === 1 ? `${gbLabel(largest * 1e9)} GB` : `${gbLabel(smallest * 1e9)}–${gbLabel(largest * 1e9)} GB`;
  const noneFit = budgetGb !== null && smallest > budgetGb;
  return (
    <>
      <div className={`relative grid min-w-0 gap-3 px-3 py-3.5 md:items-center ${ARTIFACT_ROW_COLUMNS} ${noneFit ? "bg-alertsoft" : "bg-panel"}`}>
        <label className="absolute flex h-10 w-10 cursor-pointer items-center justify-center md:static" title="Compare artifact">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={(event) => onCheck(artifact.repo, event.target.checked)}
            aria-label={`Compare ${artifact.repo}`}
            className="disabled:cursor-not-allowed disabled:opacity-35"
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-11 md:pl-0">
          <a
            href={`https://huggingface.co/${artifact.repo}`}
            target="_blank"
            rel="noreferrer"
            title={`Open ${artifact.repo} on Hugging Face`}
            className="font-mono text-[13px] font-semibold underline-offset-4 hover:text-meta hover:underline"
          >
            {artifact.format}
          </a>
          {artifact.trust === "official" ? (
            <span title={`Official release from ${vendor}`} className="inline-flex text-meta">
              <HugeiconsIcon icon={CheckmarkBadge01Icon} size={15} strokeWidth={2} aria-hidden="true" />
              <span className="sr-only">Official release</span>
            </span>
          ) : null}
          {tag ? <span className="text-[11.5px] text-muted">{tag}</span> : null}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-9 items-center gap-1 rounded-[7px] px-2 text-[11.5px] font-semibold text-meta hover:bg-panel2 hover:text-ink"
          >
            {files.length} {files.length === 1 ? "file" : "files"}
            <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        <div className="min-w-0 pl-11 md:pl-0">
          <span className="block text-[12.5px] font-semibold">{uploaderDisplay(artifact.repo)}</span>
        </div>
        <div className="pl-11 md:pl-0">
          <span className="text-[11px] text-muted md:hidden">Memory estimate · </span>
          <span className={`font-mono text-[13px] font-semibold tabular-nums ${noneFit ? "text-alert" : ""}`}>{range}</span>
        </div>
        <div aria-hidden="true" className="hidden md:block" />
      </div>
      <div id={listId} role="group" aria-label={`${artifact.repo} files`} hidden={!open} className="divide-y divide-linesoft border-t border-linesoft bg-paper/60">
        {files.map((file) => {
          const gb = totalGb(file);
          const exceeds = budgetGb !== null && gb > budgetGb;
          return (
            <div key={file.quantization} className={`grid min-w-0 gap-x-3 gap-y-1 px-3 py-2 md:items-center ${ARTIFACT_ROW_COLUMNS}`}>
              <span aria-hidden="true" className="hidden md:block" />
              <span className="flex min-w-0 items-baseline gap-2 pl-11 md:pl-3">
                <span className={`font-mono text-[12.5px] font-semibold ${exceeds ? "text-muted" : ""}`}>{file.quantization}</span>
                {file.bits ? <span className="text-[11px] text-muted">≈{file.bits}-bit</span> : null}
              </span>
              <span aria-hidden="true" className="hidden md:block" />
              <span className="pl-11 md:pl-0">
                <span className="text-[11px] text-muted md:hidden">Memory estimate · </span>
                <span className={`font-mono text-[12.5px] font-semibold tabular-nums ${exceeds ? "text-alert" : ""}`}>{gbLabel(gb * 1e9)} GB</span>
              </span>
              <RunCommands commands={runCommandsFor(artifact, context, file.quantization)} repo={`${artifact.repo}:${file.quantization}`} />
            </div>
          );
        })}
      </div>
    </>
  );
}
