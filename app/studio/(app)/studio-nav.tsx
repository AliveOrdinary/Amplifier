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

export function StudioNav({ unseen }: { unseen?: number }) {
  return <NavLinks pathname={usePathname()} unseen={unseen} />;
}

/** The links alone: also the fallback while the current path is unknown. */
export function NavLinks({ pathname, unseen = 0 }: { pathname: string | null; /** Site briefs no one has opened. */ unseen?: number }) {
  return (
    <nav aria-label="Studio" className="flex gap-5 text-[13px] font-light sm:h-14 sm:items-center">
      {items.map((item) => {
        const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="group inline-flex items-center"
          >
            <NavLabel label={item.label} active={active} />
            {item.href === "/studio/briefs" && unseen > 0 ? (
              <span
                aria-label={`${unseen} new from the site`}
                className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-signal px-1 font-mono text-[10px] text-on-signal"
              >
                {unseen}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
