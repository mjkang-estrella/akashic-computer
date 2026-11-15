"use client";

import { useMemo, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReleaseTimeline as Timeline, TimelineRelease } from "@/lib/atlas/home";
import { formatParameterBillions } from "@/lib/atlas/naming";

const PICK_RADIUS_PX = 56;
/** Keeps a score of 0 off the bottom frame. */
const SCORED_FLOOR_Y = 0.04;

export type TimelineMetric = "intelligence" | "size";

interface Dot {
  release: TimelineRelease;
  slug: string;
  label: string;
  isMoe: boolean;
  /** 0–1 from the left edge. */
  x: number;
  /** 0–1 from the bottom edge. */
  y: number;
}

interface Tick {
  label: string;
  y: number;
}

export function shortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(timestamp);
}

function decadeLabel(paramsB: number): string {
  if (paramsB >= 1000) return `${paramsB / 1000}T`;
  if (paramsB >= 1) return `${paramsB}B`;
  return `${Math.round(paramsB * 1000)}M`;
}

function sizeRange(release: TimelineRelease): string {
  const largest = release.sizes[0];
  const smallest = release.sizes[release.sizes.length - 1];
  if (!largest) return "";
  if (release.sizes.length === 1) return formatParameterBillions(largest.paramsB);
  return `${formatParameterBillions(smallest.paramsB)}–${formatParameterBillions(largest.paramsB)} · ${release.sizes.length} sizes`;
}

function releaseDetail(release: TimelineRelease, metric: TimelineMetric): string {
  if (metric === "size") return sizeRange(release);
  if (release.score === null) return "Not scored";
  const scored = release.sizes.filter((size) => size.score !== null);
  return scored.length > 1
    ? `Index ${release.score.toFixed(1)}, best of ${scored.length}`
    : `Index ${release.score.toFixed(1)}`;
}

function layout(timeline: Timeline, metric: TimelineMetric) {
  const span = Math.max(1, timeline.end - timeline.start);
  // A little space after the newest release keeps its dot off the right edge.
  const xEnd = timeline.end + span * 0.025;
  const x = (time: number) => (time - timeline.start) / (xEnd - timeline.start);
  const ordered = timeline.releases
    .slice()
    .sort((a, b) => a.releasedAt - b.releasedAt || a.key.localeCompare(b.key));

  let dots: Dot[];
  let ticks: Tick[];
  let frontierPath: string | null = null;
  if (metric === "size") {
    const params = timeline.releases.flatMap((release) => release.sizes.map((size) => size.paramsB));
    const low = Math.floor(Math.log10(Math.min(...params, 1)));
    let high = Math.ceil(Math.log10(Math.max(...params, 10)));
    if (high - low < 2) high = low + 2;
    // Breathing room so the edge decades do not sit on the frame.
    const yMin = low - 0.15;
    const yMax = high + 0.15;
    const y = (paramsB: number) => (Math.log10(paramsB) - yMin) / (yMax - yMin);
    dots = ordered.flatMap((release) =>
      release.sizes.map((size) => ({
        release, slug: size.slug, label: size.label, isMoe: size.isMoe,
        x: x(release.releasedAt), y: y(size.paramsB),
      })),
    );
    ticks = Array.from({ length: high - low + 1 }, (_, index) => {
      const value = 10 ** (low + index);
      return { label: decadeLabel(value), y: y(value) };
    });
  } else {
    const best = Math.max(
      10,
      ...timeline.releases.flatMap((release) => release.score ?? []),
      ...timeline.frontier.map((step) => step.score),
    );
    const top = Math.ceil(best / 10) * 10;
    const step = top > 60 ? 20 : 10;
    const y = (score: number) => SCORED_FLOOR_Y + (score / top) * (0.96 - SCORED_FLOOR_Y);
    // Only evaluated sizes are drawn; the summary line says how many releases that leaves.
    dots = ordered.flatMap((release) =>
      release.sizes
        .filter((size) => size.score !== null)
        .map((size) => ({
          release, slug: size.slug, label: size.label, isMoe: size.isMoe,
          x: x(release.releasedAt), y: y(size.score as number),
        })),
    );
    ticks = Array.from({ length: top / step + 1 }, (_, index) => ({
      label: String(index * step),
      y: y(index * step),
    }));
    // Step line in a 0–100 box: flat until a release sets a new high, then up, out to the edge.
    if (timeline.frontier.length) {
      const px = (time: number) => Math.max(0, x(time)) * 100;
      const py = (score: number) => (1 - y(score)) * 100;
      const [first, ...rest] = timeline.frontier;
      frontierPath = `M ${px(first.releasedAt)} ${py(first.score)}${rest
        .map((record) => ` H ${px(record.releasedAt)} V ${py(record.score)}`)
        .join("")} H 100`;
    }
  }

  const months: { label: string; x: number }[] = [];
  const cursor = new Date(timeline.start);
  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.getTime() <= xEnd) {
    const month = cursor.getUTCMonth();
    months.push({
      label: month === 0
        ? String(cursor.getUTCFullYear())
        : new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(cursor),
      x: x(cursor.getTime()),
    });
    cursor.setUTCMonth(month + 1);
  }
  return { dots, ticks, months, frontierPath };
}

const segment =
  "inline-flex min-h-9 items-center rounded-[5px] px-3 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-meta";

export function ReleaseTimeline({
  timeline,
  activeKey,
  onActivate,
  metric,
  onMetricChange,
  intelligenceSource,
}: {
  timeline: Timeline;
  /** The release drawn in ink and labelled; the newest one when nothing is pointed at. */
  activeKey: string;
  onActivate: (key: string | null) => void;
  metric: TimelineMetric;
  /** Omitted when no release has a score, which leaves the size view only. */
  onMetricChange?: (metric: TimelineMetric) => void;
  intelligenceSource: { version: string; retrievedAt: string } | null;
}) {
  const router = useRouter();
  const plot = useRef<HTMLDivElement>(null);
  const { dots, ticks, months, frontierPath } = useMemo(() => layout(timeline, metric), [timeline, metric]);
  const frontierHolder = timeline.frontier[timeline.frontier.length - 1];
  const active = timeline.releases.find((release) => release.key === activeKey) ?? timeline.releases[0];
  const activeDots = dots.filter((dot) => dot.release.key === active?.key);
  const top = activeDots.reduce<Dot | null>((best, dot) => (!best || dot.y > best.y ? dot : best), null);
  const bottom = activeDots.reduce<Dot | null>((best, dot) => (!best || dot.y < best.y ? dot : best), null);
  const dotsByRelease = useMemo(() => {
    const groups = new Map<string, Dot[]>();
    for (const dot of dots) groups.set(dot.release.key, [...(groups.get(dot.release.key) ?? []), dot]);
    for (const group of groups.values()) group.sort((a, b) => b.y - a.y);
    return [...groups.values()];
  }, [dots]);
  const scoredCount = timeline.releases.filter((release) => release.score !== null).length;

  function nearest(event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>): Dot | null {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best: Dot | null = null;
    let bestDistance = PICK_RADIUS_PX;
    for (const dot of dots) {
      const distance = Math.hypot(dot.x * rect.width - px, (1 - dot.y) * rect.height - py);
      if (distance < bestDistance) {
        best = dot;
        bestDistance = distance;
      }
    }
    return best;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const dot = nearest(event);
    if (plot.current) plot.current.style.cursor = dot ? "pointer" : "default";
    if (dot && dot.release.key !== activeKey) onActivate(dot.release.key);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) return;
    const dot = nearest(event);
    if (dot) router.push(`/models/${dot.slug}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>, dot: Dot) {
    const releaseIndex = dotsByRelease.findIndex((group) => group[0]?.release.key === dot.release.key);
    const group = dotsByRelease[releaseIndex] ?? [];
    const dotIndex = group.indexOf(dot);
    let target: Dot | undefined;
    if (event.key === "ArrowRight") target = dotsByRelease[releaseIndex + 1]?.[0];
    else if (event.key === "ArrowLeft") target = dotsByRelease[releaseIndex - 1]?.[0];
    else if (event.key === "ArrowUp") target = group[dotIndex - 1];
    else if (event.key === "ArrowDown") target = group[dotIndex + 1];
    else if (event.key === "Home") target = dotsByRelease[0]?.[0];
    else if (event.key === "End") target = dotsByRelease[dotsByRelease.length - 1]?.[0];
    else return;
    event.preventDefault();
    if (target) {
      plot.current?.querySelector<HTMLAnchorElement>(`a[data-slug="${CSS.escape(target.slug)}"]`)?.focus();
    }
  }

  const labelOnLeft = (top?.x ?? 0) > 0.58;
  // Keep the label inside the plot even when the release sits on its top or bottom edge.
  const labelY = Math.min(0.86, Math.max(0.14, top?.y ?? 0.5));
  const isIntelligence = metric === "intelligence";

  return (
    <figure className="m-0">
      <div className="mb-4 flex justify-end">
        {onMetricChange ? (
          <div role="group" aria-label="Vertical axis: Artificial Analysis Intelligence Index or parameter count" className="inline-flex rounded-[7px] border border-line bg-panel p-0.5">
            {([
              ["intelligence", "Intelligence"],
              ["size", "Size"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={metric === value}
                onClick={() => onMetricChange(value)}
                className={`${segment} ${metric === value ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <figcaption className="sr-only">
        {isIntelligence
          ? `${scoredCount} of ${timeline.releases.length} open-weight releases from ${shortDate(timeline.start)} to ${shortDate(timeline.end)} have an Artificial Analysis Intelligence Index score and are plotted by release date and score.`
          : `${timeline.releases.length} open-weight releases from ${shortDate(timeline.start)} to ${shortDate(timeline.end)}, plotted by release date and parameter count.`}
        {frontierPath && frontierHolder
          ? ` The open-weight frontier, the best score to date, stands at ${frontierHolder.score.toFixed(1)}, set by ${frontierHolder.name}.`
          : ""}
        Use the arrow keys to move between releases and sizes.
      </figcaption>
      <div className="grid grid-cols-[34px_minmax(0,1fr)] sm:grid-cols-[44px_minmax(0,1fr)]">
        <div aria-hidden="true" className="relative">
          {ticks.map((tick) => (
            <span
              key={tick.label}
              className="absolute right-2 translate-y-1/2 font-mono text-[11px] text-faint tabular-nums sm:right-3"
              style={{ bottom: `${tick.y * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
        <div
          ref={plot}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => onActivate(null)}
          onClick={handleClick}
          className="relative h-[260px] border-b border-l border-line sm:h-[340px]"
        >
          {ticks.map((tick) => (
            <span
              key={tick.label}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t border-linesoft"
              style={{ bottom: `${tick.y * 100}%` }}
            />
          ))}

          {frontierPath ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="frontier-line pointer-events-none absolute inset-0 size-full overflow-visible"
            >
              <path
                d={frontierPath}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}

          {top && bottom && top !== bottom ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute w-px -translate-x-1/2 bg-ink transition-[left,bottom,height] duration-300 ease-out motion-reduce:transition-none"
              style={{
                left: `${top.x * 100}%`,
                bottom: `${bottom.y * 100}%`,
                height: `${(top.y - bottom.y) * 100}%`,
              }}
            />
          ) : null}

          {dots.map((dot) => {
            const isActive = dot.release.key === active?.key;
            return (
              <Link
                key={dot.slug}
                href={`/models/${dot.slug}`}
                prefetch={false}
                data-slug={dot.slug}
                tabIndex={isActive && dot === top ? 0 : -1}
                aria-label={`${dot.release.name} ${dot.label}${dot.isMoe ? ", mixture of experts" : ""}, released ${shortDate(dot.release.releasedAt)}${
                  isIntelligence ? `, ${releaseDetail(dot.release, metric)}` : ""
                }`}
                onFocus={() => onActivate(dot.release.key)}
                onKeyDown={(event) => handleKeyDown(event, dot)}
                className="timeline-dot absolute -translate-x-1/2 translate-y-1/2 rounded-full p-1 transition-[bottom] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-meta motion-reduce:transition-none"
                style={{
                  left: `${dot.x * 100}%`,
                  bottom: `${dot.y * 100}%`,
                  animationDelay: `${Math.round(dot.x * 520)}ms`,
                  zIndex: isActive ? 2 : 1,
                }}
              >
                <span
                  aria-hidden="true"
                  className={`block rounded-full transition-[width,height,background-color,border-color] duration-150 ease-out ${
                    isActive ? "size-[11px]" : "size-[7px]"
                  } ${
                    dot.isMoe
                      ? `border-[1.5px] bg-paper ${isActive ? "border-ink" : "border-faint"}`
                      : isActive
                        ? "bg-ink"
                        : "bg-faint"
                  }`}
                />
              </Link>
            );
          })}

          {active && top ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-10 w-max max-w-[min(300px,62%)] rounded-[4px] bg-paper px-2 py-1 transition-[left,right,bottom] duration-300 ease-out motion-reduce:transition-none"
              style={{
                bottom: `${labelY * 100}%`,
                ...(labelOnLeft
                  ? { right: `calc(${(1 - top.x) * 100}% + 14px)`, textAlign: "right" as const }
                  : { left: `calc(${top.x * 100}% + 14px)` }),
                transform: "translateY(50%)",
              }}
            >
              <span className="block font-display text-[15px] font-semibold leading-tight text-ink">
                {active.name}
              </span>
              <span className="mt-0.5 block font-mono text-[11px] text-muted tabular-nums">
                {releaseDetail(active, metric)} · {shortDate(active.releasedAt)}
              </span>
            </div>
          ) : null}
        </div>

        <span aria-hidden="true" />
        <div aria-hidden="true" className="relative h-7">
          {months.map((month) => (
            <span
              key={`${month.label}-${month.x}`}
              className="absolute top-2 -translate-x-1/2 font-mono text-[11px] text-faint"
              style={{ left: `${month.x * 100}%` }}
            >
              {month.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 pl-[34px] text-[11px] text-muted sm:pl-[44px]">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-[7px] rounded-full bg-faint" />
            Dense
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-[7px] rounded-full border-[1.5px] border-faint" />
            MoE
          </span>
          {frontierPath && frontierHolder ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-[1.5px] w-3.5 bg-ink" />
              Frontier
            </span>
          ) : null}
          {isIntelligence && intelligenceSource ? (
            <a
              href="https://artificialanalysis.ai/"
              target="_blank"
              rel="noreferrer"
              title={`Intelligence Index v${intelligenceSource.version}, ${intelligenceSource.retrievedAt}`}
              className="text-meta hover:text-ink hover:underline"
            >
              Artificial Analysis
              <span className="sr-only">
                {" "}Intelligence Index v{intelligenceSource.version}, {intelligenceSource.retrievedAt} (opens in a new tab)
              </span>
            </a>
          ) : null}
        </span>
      </div>
    </figure>
  );
}
