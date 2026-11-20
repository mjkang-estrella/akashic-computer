import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { ModelEntry } from "@/lib/atlas/models";
import { modelTransitionName } from "@/lib/atlas/motion";
import { modelReleaseName, parameterDetailLabel, parameterTotalLabel } from "@/lib/atlas/naming";
import { checkpointVariants, type CatalogGroup } from "@/lib/atlas/catalogGroups";
import { FamilyLogo } from "./FamilyLogo";

function CatalogEntryRow({ entry, index, title }: { entry: ModelEntry; index: number; title?: string }) {
  return (
    <Link
      href={`/models/${entry.slug}`}
      prefetch={false}
      aria-label={title ? `Open Nemotron Labs Sigma · ${title} · ${entry.size.label}` : `Open ${entry.name}`}
      className="group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-2.5 text-left transition-colors hover:bg-panel lg:catalog-table:grid-cols-[240px_125px_64px_260px_150px_minmax(0,1fr)_36px] lg:catalog-table:items-center lg:catalog-table:gap-0 lg:catalog-table:px-2 lg:catalog-table:py-4"
    >
      <span
        className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 lg:catalog-table:col-auto lg:catalog-table:row-auto lg:catalog-table:gap-3"
        style={index < 60 ? { viewTransitionName: modelTransitionName(entry.slug) } : undefined}
      >
        <FamilyLogo familyId={entry.family.id} familyName={entry.family.name} />
        <span className="min-w-0">
          <span className="line-clamp-2 font-display text-[14px] font-semibold leading-tight group-hover:underline group-hover:underline-offset-4 lg:catalog-table:line-clamp-none lg:catalog-table:text-[15px]">
            {title ?? modelReleaseName(entry.family, entry.release)}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted lg:catalog-table:mt-1 lg:catalog-table:text-[13px]">{entry.family.vendor}</span>
        </span>
      </span>
      <span className="col-start-2 row-start-1 text-right lg:catalog-table:col-auto lg:catalog-table:row-auto lg:catalog-table:text-left">
        <span className="sr-only">Parameters · </span>
        <span className="block font-mono text-[13px] font-semibold">{parameterTotalLabel(entry.size)}</span>
        {parameterDetailLabel(entry.size) ? (
          <span className="mt-0.5 block text-[11px] text-muted">{parameterDetailLabel(entry.size)}</span>
        ) : null}
      </span>
      <span className="col-start-1 row-start-2 flex min-w-0 items-center gap-1 overflow-hidden lg:catalog-table:col-start-4 lg:catalog-table:row-auto lg:catalog-table:flex-wrap lg:catalog-table:gap-1.5 lg:catalog-table:overflow-visible">
        <span className="sr-only">Quantizations</span>
        {entry.quantizations.map((item, quantIndex) => (
          <span key={item} className={`${quantIndex >= 3 ? "hidden lg:catalog-table:inline" : "inline"} min-w-0 truncate rounded-[5px] bg-panel2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted lg:catalog-table:shrink-0 lg:catalog-table:text-[11.5px]`}>{item}</span>
        ))}
        {entry.quantizations.length > 3 ? <span className="shrink-0 font-mono text-[10.5px] text-muted lg:catalog-table:hidden">+{entry.quantizations.length - 3}</span> : null}
      </span>
      <span className="col-start-2 row-start-2 whitespace-nowrap text-right text-[11px] text-muted lg:catalog-table:col-start-5 lg:catalog-table:row-auto lg:catalog-table:text-left lg:catalog-table:text-[13px]">
        <span className="sr-only">Last Updated · </span>
        {entry.dateLabel}
      </span>
      <span className="hidden h-9 w-9 items-center justify-center text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink lg:catalog-table:col-start-7 lg:catalog-table:flex">
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={1.8} aria-hidden="true" />
      </span>
    </Link>
  );
}

export function CatalogGroupRow({ group, index }: { group: CatalogGroup; index: number }) {
  if (!group.grouped) return <CatalogEntryRow entry={group.members[0]} index={index} />;
  const count = group.members.reduce((total, entry) => total + checkpointVariants(entry).length, 0);
  return (
    <details className="group/catalog">
      <summary className="grid min-w-0 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 hover:bg-panel lg:catalog-table:grid-cols-[240px_125px_64px_260px_150px_minmax(0,1fr)_36px] lg:catalog-table:gap-0 lg:catalog-table:px-2 lg:catalog-table:py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <FamilyLogo familyId={group.latest.family.id} familyName={group.latest.family.name} />
          <span className="min-w-0">
            <span className="block font-display text-[15px] font-semibold">{group.title}</span>
            <span className="mt-1 block text-[11px] text-muted">{count} {count === 1 ? "checkpoint" : "checkpoints"} · Options <span aria-hidden="true" className="inline-block transition-transform group-open/catalog:rotate-90">›</span></span>
          </span>
        </span>
        <span className="text-right font-mono text-[13px] font-semibold lg:catalog-table:text-left"><span className="sr-only">Parameters · </span>{group.sizes.join(" / ")}</span>
        <span className="flex min-w-0 flex-wrap gap-1 lg:catalog-table:col-start-4">
          <span className="sr-only">Quantizations</span>
          {group.quantizations.map((format) => <span key={format} className="rounded-[5px] bg-panel2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{format}</span>)}
        </span>
        <span className="text-right text-[11px] text-muted lg:catalog-table:col-start-5 lg:catalog-table:text-left lg:catalog-table:text-[13px]"><span className="sr-only">Last Updated · </span>{group.latest.dateLabel}</span>
        <span aria-hidden="true" className="hidden text-center text-muted transition-transform group-open/catalog:rotate-90 lg:catalog-table:col-start-7 lg:catalog-table:block">›</span>
      </summary>
      <div className="border-t border-linesoft bg-panel/40 pl-3 lg:catalog-table:pl-5">
        {group.members.map((entry) => (
          <CatalogEntryRow key={entry.slug} entry={entry} index={index} title={checkpointVariants(entry).join(" · ")} />
        ))}
      </div>
    </details>
  );
}
