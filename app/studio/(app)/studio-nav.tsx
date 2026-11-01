"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScoringProgress } from "@/lib/library/score-queue";
import { NavLabel } from "./link-pending";

/** Where batch scoring is up to (see scoring-progress/route.ts). */
async function scoringPulse(): Promise<ScoringProgress | null> {
  try {
    const response = await fetch("/studio/scoring-progress", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { ok: boolean; progress?: ScoringProgress };
    return body.ok && body.progress ? body.progress : null;
  } catch {
    return null;
  }
}

const items = [
  { href: "/studio/briefs", label: "Briefs" },
  { href: "/studio/library", label: "Library" },
  { href: "/studio/portfolio", label: "Portfolio" },
  { href: "/studio/settings", label: "Settings" },
] as const;

export function StudioNav({ unseen }: { unseen?: number }) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} unseen={unseen} library={useScoringPulse(pathname)} />;
}

type LibraryPulse = { scoring: number; scored: number };

const SEEN_KEY = "amp-scored-seen";
const readSeen = (): string[] | null => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};
const writeSeen = (ids: string[]) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(0, 30)));
  } catch {
    // Private windows: the count just shows again next time.
  }
};

/**
 * Batch scoring as seen from any studio page: how many images are with
 * Claude, and how many came back since you last opened the library. Asking
 * also reads back finished batches (scoring-actions.ts).
 */
function useScoringPulse(pathname: string | null): LibraryPulse {
  const [progress, setProgress] = useState<ScoringProgress | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const last = useRef(0);
  const inLibrary = pathname?.startsWith("/studio/library") ?? false;
  const inLibraryRef = useRef(inLibrary);
  useEffect(() => {
    inLibraryRef.current = inLibrary;
  }, [inLibrary]);

  /** Take in a fresh answer. Batches read back while you're in the library (or before
   *  this was first used) count as seen. */
  const take = useCallback((p: ScoringProgress | null) => {
    if (!p) return;
    setProgress(p);
    const stored = readSeen();
    const next = inLibraryRef.current || stored === null ? [...new Set([...p.finished.map((b) => b.id), ...(stored ?? [])])] : stored;
    if (next !== stored) writeSeen(next);
    setSeen(next);
  }, []);

  useEffect(() => {
    const check = async (force = false) => {
      if (document.visibilityState !== "visible") return;
      if (!force && Date.now() - last.current < 20_000) return;
      last.current = Date.now();
      take(await scoringPulse());
    };
    void check(true);
    const timer = setInterval(() => void check(true), 60_000);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [take]);

  // A quick look on every page change too (at most every 20 seconds).
  useEffect(() => {
    if (!last.current || Date.now() - last.current < 20_000) return;
    last.current = Date.now();
    void scoringPulse().then(take);
  }, [pathname, take]);

  if (!progress) return { scoring: 0, scored: 0 };
  const scoring = progress.waiting + (progress.packing ?? 0) + progress.batches.reduce((sum, b) => sum + b.count, 0);
  // In the library itself the notice and the tabs say it; the count is for elsewhere.
  const scored = inLibrary ? 0 : progress.finished.filter((b) => !seen.includes(b.id)).reduce((sum, b) => sum + b.count, 0);
  return { scoring, scored };
}

/** The links alone: also the fallback while the current path is unknown. */
export function NavLinks({
  pathname,
  unseen = 0,
  library,
}: {
  pathname: string | null;
  /** Site briefs no one has opened. */
  unseen?: number;
  /** Images with Claude now, and images scored since you last opened the library. */
  library?: LibraryPulse;
}) {
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
            {item.href === "/studio/library" && library?.scoring ? (
              <span
                title={`Scoring ${library.scoring} ${library.scoring === 1 ? "image" : "images"}`}
                aria-label="scoring"
                className="ml-1.5 inline-flex size-1.5 animate-pulse rounded-full bg-signal"
              />
            ) : item.href === "/studio/library" && library?.scored ? (
              <span
                title={`${library.scored} ${library.scored === 1 ? "image" : "images"} scored since you last looked`}
                aria-label={`${library.scored} scored`}
                className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-signal px-1 font-mono text-[10px] text-signal"
              >
                {library.scored}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
