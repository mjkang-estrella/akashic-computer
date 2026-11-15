"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, RssIcon } from "@hugeicons/core-free-icons";
import {
  latestReleases,
  recentlyUpdatedEntries,
  releaseTimeline,
  type HomeCatalogStats,
} from "@/lib/atlas/home";
import type { ModelEntry } from "@/lib/atlas/models";
import { formatParameterBillions } from "@/lib/atlas/naming";
import type { IntelligenceIndex } from "@/lib/atlas/capabilityTypes";
import type { MaterialChange } from "@/lib/atlas/types";
import { FamilyLogo } from "./FamilyLogo";
import { ReleaseTimeline, shortDate, type TimelineMetric } from "./ReleaseTimeline";

const CHANGE_COUNT = 4;
const SIZE_LABEL_COUNT = 3;

export interface CatalogHealth {
  catalogStale: boolean;
}

function relativeAge(from: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - from) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Relative sync age, rendered only in the browser so server and client markup agree. */
function SyncAge({ syncedAt, stale }: { syncedAt: number | null; stale: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  if (!syncedAt || now === null) return null;
  return (
    <span className={`font-mono text-[11px] ${stale ? "text-caution" : "text-faint"}`}>
      {stale ? "Refresh overdue · " : "Updated "}
      {relativeAge(syncedAt, now)}
    </span>
  );
}

function SectionHeader({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line">
      <h2 id={id} className="font-display text-[19px] font-semibold">
        {title}
      </h2>
      {children}
    </header>
  );
}

function CatalogField({ entries, stats }: { entries: ModelEntry[]; stats: HomeCatalogStats }) {
  const bars = useMemo(() => {
    const recent = recentlyUpdatedEntries(entries);
    const maximum = Math.max(1, ...recent.map((entry) => entry.size.paramsB));
    return recent.map((entry) => {
      const normalized = Math.log10(entry.size.paramsB + 1) / Math.log10(maximum + 1);
      const quantizations = new Set(entry.quantizations);
      const tone = quantizations.has("NVFP4")
        ? "bg-meta"
        : quantizations.has("FP8")
          ? "bg-verify"
          : quantizations.has("INT4") || quantizations.has("Native INT4")
            ? "bg-caution"
            : "bg-ink";
      return {
        id: entry.slug,
        height: 24 + normalized * 76,
        tone,
      };
    });
  }, [entries]);

  return (
    <figure
      aria-label={`${stats.modelSizes} model sizes across ${stats.families} families and ${stats.weightFormats} weight formats`}
      className="relative min-h-[248px] overflow-hidden border-y border-line py-5 lg:min-h-[296px] lg:border-y-0 lg:border-r lg:pr-10"
    >
      <figcaption className="sr-only">
        Recent catalog entries shown by parameter scale. Bar colors indicate
        available weight formats.
      </figcaption>
      <div className="pointer-events-none absolute inset-x-0 top-5 bottom-[58px] flex flex-col justify-between lg:right-10">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="block border-t border-linesoft" />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="relative flex h-[166px] items-end gap-1.5 lg:h-[212px]"
      >
        {bars.map((bar, index) => (
          <span
            key={bar.id}
            className={`catalog-field-bar min-w-1 flex-1 rounded-t-[2px] ${bar.tone}`}
            style={{
              height: `${bar.height}%`,
              animationDelay: `${index * 12}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 border-t border-line pt-3">
        <span>
          <strong className="block font-mono text-[13px] font-semibold">
            {stats.modelSizes}
          </strong>
          <span className="mt-0.5 block text-[11px] text-muted">model sizes</span>
        </span>
        <span className="border-l border-linesoft pl-4">
          <strong className="block font-mono text-[13px] font-semibold">
            {stats.families}
          </strong>
          <span className="mt-0.5 block text-[11px] text-muted">families</span>
        </span>
        <span className="border-l border-linesoft pl-4">
          <strong className="block font-mono text-[13px] font-semibold">
            {stats.weightFormats}
          </strong>
          <span className="mt-0.5 block text-[11px] text-muted">weight formats</span>
        </span>
      </div>
    </figure>
  );
}

const quietLink =
  "inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-muted hover:text-ink";

export function HomeView({
  entries,
  stats,
  materialChanges,
  syncedAt,
  loading,
  health,
  intelligence,
}: {
  /** May be a server-rendered subset; catalog-wide counts come from `stats`. */
  entries: ModelEntry[];
  stats: HomeCatalogStats;
  materialChanges: MaterialChange[];
  syncedAt: number | null;
  loading: boolean;
  health: CatalogHealth | null;
  /** Server-matched Artificial Analysis scores; null leaves the size axis only. */
  intelligence: IntelligenceIndex | null;
}) {
  const [pointedKey, setPointedKey] = useState<string | null>(null);
  const [chosenMetric, setChosenMetric] = useState<TimelineMetric | null>(null);
  const timeline = useMemo(() => releaseTimeline(entries, intelligence?.scores), [entries, intelligence]);
  const hasScores = timeline.releases.some((release) => release.score !== null);
  // Capability leads when any release in the window has a score.
  const metric: TimelineMetric = hasScores ? chosenMetric ?? "intelligence" : "size";
  const latest = useMemo(() => latestReleases(entries), [entries]);
  const changes = useMemo(() => {
    const known = new Set(entries.map((entry) => entry.slug));
    const seen = new Set<string>();
    return materialChanges
      .filter((change) => {
        const key = `${change.modelSlug}:${change.title}`;
        if (!known.has(change.modelSlug) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, CHANGE_COUNT);
  }, [entries, materialChanges]);

  const waiting = loading && entries.length === 0;
  // At rest, label the newest release that has a value on the current axis.
  const restingKey = (metric === "intelligence"
    ? timeline.releases.find((release) => release.score !== null)
    : timeline.releases[0])?.key ?? "";
  const activeKey = pointedKey ?? restingKey;

  return (
    <section className="pb-16 pt-10 sm:pt-16">
      <header className="grid gap-8 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12">
        <div className="order-2 lg:order-1">
          <CatalogField entries={entries} stats={stats} />
        </div>
        <div className="order-1 lg:order-2 lg:pl-2">
          <h1 className="max-w-[16ch] text-balance font-display text-[36px] font-semibold leading-[1.04] tracking-[-0.01em] sm:text-[48px] lg:text-[52px]">
            Open models you can run yourself.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted sm:text-[16px]">
            New open-weight releases, their quantized builds, and how they compare.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-3">
            <Link
              href="/models"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[7px] bg-ink px-4 text-[13px] font-semibold text-paper hover:bg-ink/85"
            >
              {stats.modelSizes > 0 ? `Browse ${stats.modelSizes} models` : "Browse models"}
              <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link
              href="/benchmarks"
              className="inline-flex min-h-11 items-center rounded-[7px] border border-line bg-panel px-4 text-[13px] font-semibold text-ink hover:border-ink/40"
            >
              Compare benchmarks
            </Link>
            <span className="sm:ml-3">
              <SyncAge syncedAt={syncedAt} stale={Boolean(health?.catalogStale)} />
            </span>
          </div>
        </div>
      </header>

      <div className="mt-12 sm:mt-16">
        {waiting ? (
          <div aria-hidden="true" className="catalog-skeleton h-[240px] rounded-[4px] sm:h-[320px]" />
        ) : timeline.releases.length > 0 ? (
          <ReleaseTimeline
            timeline={timeline}
            activeKey={activeKey}
            onActivate={setPointedKey}
            metric={metric}
            onMetricChange={hasScores ? setChosenMetric : undefined}
            intelligenceSource={intelligence}
          />
        ) : null}
        {waiting ? (
          <p className="sr-only" role="status">
            Loading recent releases
          </p>
        ) : null}
      </div>

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
        <section aria-labelledby="latest-releases-title" className="min-w-0">
          <SectionHeader id="latest-releases-title" title="Latest releases">
            <Link href="/models" className={quietLink}>
              All models
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} aria-hidden="true" />
            </Link>
          </SectionHeader>
          {waiting ? (
            <div aria-hidden="true" className="divide-y divide-linesoft">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex min-h-14 items-center gap-4">
                  <span className="catalog-skeleton h-3 w-12 rounded-[3px]" />
                  <span className="catalog-skeleton h-4 w-1/2 rounded-[3px]" />
                </div>
              ))}
            </div>
          ) : latest.length === 0 ? (
            <p className="py-8 text-[13px] text-muted">Releases appear here after the first catalog sync.</p>
          ) : (
            <ol className="divide-y divide-linesoft">
              {latest.map((release) => {
                const shown = release.sizes.slice(0, SIZE_LABEL_COUNT);
                const hidden = release.sizes.length - shown.length;
                return (
                  <li key={release.key}>
                    <Link
                      href={`/models/${release.sizes[0].slug}`}
                      prefetch={false}
                      onPointerEnter={() => setPointedKey(release.key)}
                      onPointerLeave={() => setPointedKey(null)}
                      onFocus={() => setPointedKey(release.key)}
                      onBlur={() => setPointedKey(null)}
                      aria-label={`Open ${release.name}, released ${shortDate(release.releasedAt)}`}
                      className={`group grid min-h-14 grid-cols-[52px_24px_minmax(0,1fr)_auto] items-center gap-x-3 py-2 transition-colors ${
                        release.key === activeKey && pointedKey ? "bg-panel" : ""
                      }`}
                    >
                      <span className="font-mono text-[11px] text-faint tabular-nums">
                        {shortDate(release.releasedAt)}
                      </span>
                      <FamilyLogo familyId={release.familyId} familyName={release.familyName} size={22} />
                      <span className="truncate font-display text-[15px] font-semibold group-hover:underline group-hover:underline-offset-4">
                        {release.name}
                      </span>
                      <span className="whitespace-nowrap pr-1 text-right font-mono text-[11px] text-muted tabular-nums">
                        {shown.map((size) => formatParameterBillions(size.paramsB)).join(" · ")}
                        {hidden > 0 ? <span className="text-faint"> +{hidden}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {changes.length > 0 ? (
          <section aria-labelledby="recent-updates-title" className="min-w-0">
            <SectionHeader id="recent-updates-title" title="Updates">
              <a href="/feed.xml" className={quietLink}>
                <HugeiconsIcon icon={RssIcon} size={14} strokeWidth={2} aria-hidden="true" />
                RSS
                <span className="sr-only"> feed of model updates</span>
              </a>
            </SectionHeader>
            <ol className="divide-y divide-linesoft">
              {changes.map((change) => (
                <li key={change.id}>
                  <Link
                    href={`/models/${change.modelSlug}`}
                    prefetch={false}
                    className="group grid min-h-14 grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3 py-2"
                  >
                    <span className="font-mono text-[11px] text-faint tabular-nums">
                      {shortDate(change.occurredAt)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold group-hover:underline group-hover:underline-offset-4">
                        {change.modelName}
                      </span>
                      <span className="block truncate text-[12px] text-muted">{change.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </section>
  );
}
