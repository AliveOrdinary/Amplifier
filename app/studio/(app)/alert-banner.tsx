"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/** Dismissed per browser, until next month or until the limit changes. */
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function read(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function AlertBanner({ storageKey, total, limit }: { storageKey: string; total: number; limit: number }) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => true,
  );
  if (dismissed) return null;

  return (
    <div role="status" className="border-b border-ink bg-signal/15">
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 text-[15px] sm:px-10">
        <p className="flex-1">
          This month&rsquo;s AI spending is about <span className="font-medium">${total.toFixed(2)}</span>, past the $
          {limit.toFixed(2)} alert.{" "}
          <Link href="/studio/settings#spending" className="underline underline-offset-4">
            See the breakdown
          </Link>
        </p>
        <button
          type="button"
          className="text-sm text-ink-soft hover:text-ink"
          onClick={() => {
            try {
              localStorage.setItem(storageKey, "1");
            } catch {}
            listeners.forEach((fn) => fn());
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
