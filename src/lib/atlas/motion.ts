import { flushSync } from "react-dom";

interface ViewTransitionHandle {
  finished: Promise<void>;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionHandle;
};

export function motionReduced(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function runViewTransition(update: () => void): void {
  if (typeof document === "undefined" || motionReduced()) {
    update();
    return;
  }
  const transitionDocument = document as ViewTransitionDocument;
  if (!transitionDocument.startViewTransition) {
    update();
    return;
  }
  try {
    transitionDocument.startViewTransition(() => flushSync(update));
  } catch {
    update();
  }
}

export function modelTransitionName(slug: string): string {
  return `model-${slug.replace(/[^a-z0-9-]/gi, "-")}`;
}
