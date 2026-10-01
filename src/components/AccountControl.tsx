"use client";
import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { hasConvex } from "./AppProviders";
export const connectedWorkspaceEnabled =
  process.env.NEXT_PUBLIC_CONNECTED_WORKSPACE === "true";
export function AccountControl() {
  return hasConvex && connectedWorkspaceEnabled ? <AccountButton /> : null;
}
function AccountButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  return isAuthenticated ? (
    <button className="text-[13px] text-muted" onClick={() => void signOut()}>
      Sign out
    </button>
  ) : (
    <Link className="text-[13px] text-muted" href="/workspace">
      Sign in
    </Link>
  );
}
