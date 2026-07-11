import { Check, TriangleAlert, X } from "lucide-react";

import type { Confidence, FitVerdict, Trust } from "@/lib/atlas/types";

/** Small mono chip for model properties: quant, uploader, variant, active params. */
export function PropertyChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "meta";
}) {
  const styles =
    tone === "meta" ? "bg-metasoft text-meta" : "bg-panel2 text-muted";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[5px] px-1.5 py-px font-mono text-[11.5px] font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

export function TrustBadge({ trust }: { trust: Trust }) {
  if (trust === "official") {
    return (
      <span className="inline-flex items-center rounded-[5px] bg-verifysoft px-1.5 py-px text-[11.5px] font-semibold text-verify">
        Official
      </span>
    );
  }
  if (trust === "vendor") {
    return (
      <span className="inline-flex items-center rounded-[5px] bg-metasoft px-1.5 py-px text-[11.5px] font-semibold text-meta">
        Vendor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[5px] bg-panel2 px-1.5 py-px text-[11.5px] font-semibold text-muted">
      Community
    </span>
  );
}

const CONFIDENCE_COPY: Record<Confidence, { dot: string; label: string }> = {
  verified: { dot: "bg-verify", label: "Verified" },
  inferred: { dot: "bg-caution", label: "Inferred from repo name" },
  needs_review: { dot: "bg-alert", label: "Needs review" },
};

export function ConfidenceNote({ confidence }: { confidence: Confidence }) {
  if (confidence === "inferred") return null;

  const { dot, label } = CONFIDENCE_COPY[confidence];
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
      <span className={`h-[7px] w-[7px] flex-none rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function FitBadge({ fit }: { fit: FitVerdict }) {
  const styles =
    fit.level === "runs"
      ? "bg-verifysoft text-verify"
      : fit.level === "tight"
        ? "bg-cautionsoft text-caution"
        : "bg-alertsoft text-alert";
  const Icon =
    fit.level === "runs" ? Check : fit.level === "tight" ? TriangleAlert : X;

  return (
    <span
      aria-label={fit.text}
      role="img"
      title={fit.text}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-[5px] ${styles}`}
    >
      <Icon aria-hidden="true" size={12} strokeWidth={2.5} />
    </span>
  );
}

export function DeltaChip({
  delta,
  measured,
}: {
  delta: number | null;
  measured: boolean;
}) {
  if (delta === null) {
    return (
      <span
        className="rounded bg-panel2 px-1.5 py-px font-mono text-[11.5px] text-faint"
        title="No measured data"
      >
        n/a
      </span>
    );
  }
  const styles =
    delta >= -0.5
      ? "bg-verifysoft text-verify"
      : delta >= -2
        ? "bg-cautionsoft text-caution"
        : "bg-alertsoft text-alert";
  return (
    <span
      className={`rounded px-1.5 py-px font-mono text-[11.5px] tabular-nums ${styles}`}
      title={measured ? "Measured vs BF16 reference" : "Estimated, not measured"}
    >
      {delta === 0 ? "ref" : `${delta.toFixed(1)}${measured ? "" : "*"}`}
    </span>
  );
}

export function ScoreMeter({ value, best }: { value: number; best: boolean }) {
  return (
    <span className="inline-block">
      <span
        className={`font-mono text-[13px] tabular-nums ${best ? "font-bold" : ""}`}
      >
        {value.toFixed(1)}
      </span>
      <span className="mt-1 block h-1 w-[58px] overflow-hidden rounded-sm bg-track">
        <span
          className="block h-full rounded-sm bg-meta"
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </span>
    </span>
  );
}
