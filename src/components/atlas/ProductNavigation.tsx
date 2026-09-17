import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { BookOpen02Icon, ChartColumnIcon, CubeIcon, GitCompareArrowsIcon } from "@hugeicons/core-free-icons";

export const PRODUCT_DESTINATIONS = {
  discover: { id: "discover", href: "/models", label: "Discover", icon: CubeIcon },
  compare: { id: "compare", href: "/compare", label: "Compare", icon: GitCompareArrowsIcon },
  benchmarks: { id: "benchmarks", href: "/benchmarks", label: "Benchmarks", icon: ChartColumnIcon },
  learn: { id: "learn", href: "/docs", label: "Learn", icon: BookOpen02Icon },
} as const;

// Shared appearance; route links and preview tabs retain their own semantics.
export function productTabClassName(active: boolean) {
  return `flex min-h-16 items-center justify-center gap-2 border-b-2 px-2 text-[13px] font-semibold transition-colors motion-reduce:transition-none ${active ? "border-ink text-ink" : "border-transparent text-muted hover:border-line hover:text-ink"}`;
}

export function ProductNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav aria-label="Primary" className="grid w-full grid-cols-[1fr_1fr_1.3fr_0.8fr] sm:grid-cols-4 md:flex md:w-auto md:gap-1">
      {Object.values(PRODUCT_DESTINATIONS).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.id} href={item.href} onNavigate={onNavigate} aria-current={active ? "page" : undefined} className={`${productTabClassName(active)} max-sm:flex-col max-sm:gap-1 sm:px-5`}>
            <HugeiconsIcon icon={item.icon} size={17} strokeWidth={1.7} aria-hidden="true" className="flex-none" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
