"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLabel } from "./link-pending";

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
    <nav aria-label="Studio" className="flex gap-5 text-[13px] font-light sm:h-14 sm:items-center">
      {items.map((item) => {
        const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="group"
          >
            <NavLabel label={item.label} active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
