"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { connectedWorkspaceEnabled } from "../AccountControl";
const CONNECTOR_FRESHNESS_MS = 60_000;

export function RunningModelLink({ repo }: { repo: string }) {
  const { isAuthenticated } = useConvexAuth();
  const result = useQuery(
    api.workspace.runningDeployment,
    isAuthenticated && connectedWorkspaceEnabled ? { repo } : "skip",
  );
  const [now, setNow] = useState(() => Date.now());
  const hasResult = !!result;
  useEffect(() => {
    if (!hasResult) return;
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [hasResult]);
  return result && now - result.lastSeenAt < CONNECTOR_FRESHNESS_MS ? (
    <Link
      href={`/workspace?deployment=${result.id}`}
      className="inline-block rounded-[7px] border border-line px-3 py-2 text-[13px] font-semibold"
    >
      Use running model
    </Link>
  ) : null;
}
