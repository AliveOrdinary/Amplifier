"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/primitives";
import { PendingDot } from "../link-pending";

const tabs = [
  { href: "/studio/settings", label: "General" },
  { href: "/studio/settings/rubric", label: "Rubric" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="mt-4 flex gap-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-8 items-center rounded-full px-3.5 text-sm", active ? "bg-ink text-paper" : "text-muted hover:text-ink")}
          >
            {tab.label}
            <PendingDot />
          </Link>
        );
      })}
    </nav>
  );
}
