"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/components/ui/primitives";

/** A main-nav label: underlined as soon as it's clicked, before the page arrives. */
export function NavLabel({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "block border-b-2 pt-[18px] pb-4 transition-colors",
        active || pending ? "border-ink text-ink" : "border-transparent text-muted group-hover:text-ink",
        pending && "border-ink/50",
      )}
    >
      {label}
    </span>
  );
}

/** A small marker inside a tab while its page is on the way. */
export function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="ml-1.5 size-1.5 animate-pulse rounded-full bg-signal" /> : null;
}
