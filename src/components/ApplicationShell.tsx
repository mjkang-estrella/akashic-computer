"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AtlasShell } from "./atlas/AtlasShell";
import { CatalogProvider } from "./atlas/CatalogProvider";
import { AkashicMark } from "./brand/AkashicMark";
import { AccountControl, connectedWorkspaceEnabled } from "./AccountControl";
import { hasConvex } from "./AppProviders";

export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const workspace =
    pathname.startsWith("/workspace") || pathname.startsWith("/computers");
  if (!workspace)
    return (
      <CatalogProvider>
        <AtlasShell>{children}</AtlasShell>
      </CatalogProvider>
    );
  return (
    <>
      <header className="ac-app-header flex flex-wrap items-center gap-5 border-b border-line bg-paper px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-[19px] font-semibold"
        >
          <AkashicMark />
          Akashic Computer
        </Link>
        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center gap-5 text-[13px]"
        >
          {[
            ["/models", "Models"],
            ["/benchmarks", "Benchmarks"],
            ["/docs", "Docs"],
            ["/workspace", "Workspace"],
            ["/computers", "Computers"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
              className={
                pathname.startsWith(href)
                  ? "font-semibold text-ink"
                  : "text-muted"
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <AccountControl />
        </div>
      </header>
      <main>
        {hasConvex && connectedWorkspaceEnabled ? (
          children
        ) : (
          <p className="p-8">
            Account service unavailable. Your device-only workspace remains
            available on the controller.
          </p>
        )}
      </main>
    </>
  );
}
