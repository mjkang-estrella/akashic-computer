"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { learnTermById } from "@/lib/atlas/learn";

export function hintPosition(rect: { left: number; top: number; bottom: number }, viewportWidth: number, viewportHeight: number, height: number) {
  const width = Math.max(0, Math.min(288, viewportWidth - 24));
  return {
    width,
    left: Math.max(12, Math.min(rect.left, viewportWidth - width - 12)),
    top: rect.bottom + 8 + height > viewportHeight
      ? Math.max(12, rect.top - height - 8)
      : rect.bottom + 8,
  };
}

export function LexiconHint({
  term,
  onLearn,
  children,
  className = "text-faint",
}: {
  term: string;
  onLearn?: (term?: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const definition = learnTermById(term);
  const triggerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<ReturnType<typeof hintPosition> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const open = () => {
    cancelClose();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition(hintPosition(rect, window.innerWidth, window.innerHeight, panelRef.current?.offsetHeight ?? 180));
  };
  const scheduleClose = () => {
    cancelClose();
    // Bridge the small visual gap between the trigger and the portalled panel.
    closeTimer.current = setTimeout(() => {
      if (!triggerRef.current?.contains(document.activeElement) && !panelRef.current?.contains(document.activeElement)) setPosition(null);
    }, 180);
  };

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const isOpen = position !== null;
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition(hintPosition(rect, window.innerWidth, window.innerHeight, panelRef.current?.offsetHeight ?? 180));
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPosition(null);
    };
    const observer = new ResizeObserver(update);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [isOpen]);

  if (!definition) return <>{children}</>;

  const triggerClass = `underline decoration-dotted underline-offset-4 hover:text-ink focus-visible:text-ink ${className}`;
  const events = {
    onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType === "mouse") open(); },
    onPointerLeave: (event: React.PointerEvent) => { if (event.pointerType === "mouse") scheduleClose(); },
    onPointerDown: (event: React.PointerEvent) => {
      touchRef.current = event.pointerType !== "mouse";
      if (touchRef.current) open();
    },
    onFocus: open,
    onBlur: (event: React.FocusEvent) => {
      if (!panelRef.current?.contains(event.relatedTarget as Node)) scheduleClose();
    },
  };

  return (
    <>
      {onLearn ? (
        <button ref={(node) => { triggerRef.current = node; }} type="button"
          aria-describedby={position ? `${tooltipId}-definition` : undefined}
          aria-expanded={!!position} aria-controls={position ? tooltipId : undefined}
          onClick={(event) => {
            if (touchRef.current && event.detail !== 0) { open(); return; }
            onLearn(term);
          }} className={triggerClass} {...events}>
          {children}
        </button>
      ) : (
        <span ref={(node) => { triggerRef.current = node; }} tabIndex={0}
          aria-describedby={position ? `${tooltipId}-definition` : undefined}
          className={triggerClass} {...events}>{children}</span>
      )}
      {position ? createPortal(
        <div ref={panelRef} id={tooltipId}
          role={onLearn ? "group" : "tooltip"} aria-label={onLearn ? definition.term : undefined}
          onPointerEnter={cancelClose} onPointerLeave={scheduleClose} onFocus={cancelClose}
          onBlur={(event) => {
            if (!panelRef.current?.contains(event.relatedTarget as Node) && !triggerRef.current?.contains(event.relatedTarget as Node)) scheduleClose();
          }}
          className="fixed z-[70] rounded-[7px] border border-ink bg-ink px-3 py-2.5 text-left text-paper"
          style={position}>
          <div id={`${tooltipId}-definition`}>
            <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-paper/65">{definition.term}</span>
            <span className="mt-1 block text-[12.5px] font-semibold leading-snug">{definition.short}</span>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-paper/75">{definition.definition}</span>
          </div>
          {onLearn ? <button type="button" className="mt-2 min-h-8 text-[12px] font-semibold underline underline-offset-4" onClick={() => onLearn(term)}>Open in lexicon</button> : null}
        </div>, document.body,
      ) : null}
    </>
  );
}
