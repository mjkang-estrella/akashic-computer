"use client";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { connectedWorkspaceEnabled } from "../AccountControl";
export function RunningModelLink({ repo }: { repo: string }) {
  const { isAuthenticated } = useConvexAuth();
  const result = useQuery(
    api.workspace.runningDeployment,
    isAuthenticated && connectedWorkspaceEnabled ? { repo } : "skip",
  );
  return result ? (
    <Link
      href={`/workspace?deployment=${result.id}`}
      className="inline-block rounded-[7px] border border-line px-3 py-2 text-[13px] font-semibold"
    >
      Use running model
    </Link>
  ) : null;
}
