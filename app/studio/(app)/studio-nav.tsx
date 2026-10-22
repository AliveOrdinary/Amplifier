"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/primitives";

const items = [
  { href: "/studio/briefs", label: "Briefs" },
  { href: "/studio/library", label: "Library" },
  { href: "/studio/portfolio", label: "Portfolio" },
  { href: "/studio/settings", label: "Settings" },
] as const;

export function StudioNav() {
  return <NavLinks pathname={usePathname()} />;
}

/** The links alone: also the fallback while the current path is unknown. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Studio" className="flex gap-6 text-[15px]">
      {items.map((item) => {
        const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 pt-[18px] pb-4",
              active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
