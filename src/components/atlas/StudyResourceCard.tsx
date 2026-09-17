import type { StudyResource } from "@/lib/atlas/study";

export function StudyResourceCard({ resource, read, onToggleRead, focus, ready }: {
  resource: StudyResource; read: boolean; onToggleRead: () => void; focus?: string; ready: boolean;
}) {
  return (
    <article className="min-w-0 rounded-[8px] border border-line bg-panel p-5">
      <p className="font-mono text-[10px] text-muted">{resource.kind} · {resource.level} · {resource.publisher}</p>
      <h3 className="mt-2 font-display text-[21px] font-semibold leading-snug">
        <a href={resource.href} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{resource.title} <span aria-hidden="true" className="text-faint">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
      </h3>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{resource.description}</p>
      {focus ? <p className="mt-4 border-t border-linesoft pt-3 text-[13px] leading-relaxed">{focus}</p> : null}
      <div className="mt-4 flex justify-end">
        <button type="button" disabled={!ready} aria-pressed={read} aria-label={`Mark ${resource.title} as ${read ? "unread" : "read"}`} onClick={onToggleRead} className={`min-h-11 flex-none rounded-[6px] border px-3 text-[11px] font-semibold disabled:opacity-50 ${read ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>{read ? "Read ✓" : "Mark as read"}</button>
      </div>
    </article>
  );
}
