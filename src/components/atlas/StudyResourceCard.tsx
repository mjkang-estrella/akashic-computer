import type { StudyResource } from "@/lib/atlas/study";

export function StudyResourceCard({ resource, read, onToggleRead, focus, ready }: {
  resource: StudyResource; read: boolean; onToggleRead: () => void; focus?: string; ready: boolean;
}) {
  return (
    <article className="min-w-0 rounded-[8px] border border-line bg-panel p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{resource.kind} · {resource.level}</p>
      <h3 className="mt-2 font-display text-[21px] font-semibold leading-snug">
        <a href={resource.href} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{resource.title} <span aria-hidden="true" className="text-faint">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
      </h3>
      <p className="mt-1 text-[11px] text-faint">{resource.publisher}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{resource.description}</p>
      {focus ? <div className="mt-4 border-t border-linesoft pt-3"><p className="text-[11px] font-semibold">Read with this question</p><p className="mt-1 text-[13px] leading-relaxed">{focus}</p></div> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[10px] text-faint">{resource.topics.join(" · ")}</span>
        <button type="button" disabled={!ready} aria-pressed={read} aria-label={`Mark ${resource.title} as ${read ? "unread" : "read"}`} onClick={onToggleRead} className={`min-h-11 flex-none rounded-[6px] border px-3 text-[11px] font-semibold disabled:opacity-50 ${read ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>{read ? "Read ✓" : "Mark as read"}</button>
      </div>
    </article>
  );
}
