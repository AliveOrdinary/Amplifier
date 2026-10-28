"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/components/ui/primitives";

/**
 * A main-nav label, light and small as on the site. The section you're in
 * gets the orange light; a clicked one lights (pulsing) before its page arrives.
 */
export function NavLabel({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  const lit = active || pending;
  return (
    <span className={cn("flex items-center gap-2 pt-1 pb-3 transition-colors sm:py-0", lit ? "text-ink" : "text-muted group-hover:text-ink")}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full transition-opacity",
          lit ? "bg-signal shadow-[0_0_8px_var(--signal)]" : "bg-transparent",
          pending && "animate-pulse",
        )}
      />
      {label}
    </span>
  );
}

/** A small marker inside a tab while its page is on the way. */
export function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="ml-1.5 size-1.5 animate-pulse rounded-full bg-signal" /> : null;
}
