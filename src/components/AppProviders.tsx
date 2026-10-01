"use client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const client =
  url && /^https?:\/\//.test(url) ? new ConvexReactClient(url) : null;
export const hasConvex = !!client;
export function AppProviders({ children }: { children: ReactNode }) {
  return client ? (
    <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>
  ) : (
    children
  );
}
