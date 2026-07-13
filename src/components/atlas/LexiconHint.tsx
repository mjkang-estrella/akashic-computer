"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { learnTermById } from "@/lib/atlas/learn";

interface TooltipPosition {
  left: number;
  top: number;
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
  const tooltipId = useId();
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const open = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(288, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - width - 12),
    );
    const estimatedHeight = 112;
    const below = rect.bottom + 8;
    const top =
      below + estimatedHeight > window.innerHeight
        ? Math.max(12, rect.top - estimatedHeight - 8)
        : below;

    setPosition({ left, top });
  };

  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [position]);

  if (!definition) return <>{children}</>;

  const triggerClass = `underline decoration-dotted underline-offset-4 hover:text-ink focus-visible:text-ink ${className}`;
  const events = {
    onMouseEnter: open,
    onMouseLeave: () => setPosition(null),
    onFocus: open,
    onBlur: () => setPosition(null),
  };

  return (
    <>
      {onLearn ? (
        <button
          ref={(node) => {
            triggerRef.current = node;
          }}
          type="button"
          aria-describedby={position ? tooltipId : undefined}
          onClick={() => onLearn(term)}
          className={triggerClass}
          {...events}
        >
          {children}
        </button>
      ) : (
        <span
          ref={(node) => {
            triggerRef.current = node;
          }}
          tabIndex={0}
          aria-describedby={position ? tooltipId : undefined}
          className={triggerClass}
          {...events}
        >
          {children}
        </span>
      )}

      {position
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[70] w-72 rounded-[7px] border border-ink bg-ink px-3 py-2.5 text-left text-paper shadow-lg"
              style={{ left: position.left, top: position.top }}
            >
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-paper/65">
                {definition.term}
              </span>
              <span className="mt-1 block text-[12.5px] font-semibold leading-snug">
                {definition.short}
              </span>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-paper/75">
                {definition.definition}
              </span>
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
