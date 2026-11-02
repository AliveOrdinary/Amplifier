"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScoringProgress } from "@/lib/library/score-queue";
import { NavLabel, type NavCount } from "./link-pending";

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
  /** When you were last in the library (entering or leaving it). */
  const libraryVisit = useRef(0);
  useEffect(() => {
    if (!inLibrary) return;
    libraryVisit.current = Date.now();
    return () => {
      libraryVisit.current = Date.now();
    };
  }, [inLibrary]);
  useEffect(() => {
    inLibraryRef.current = inLibrary;
  }, [inLibrary]);

  /** Take in a fresh answer. Batches read back while you're in the library (or before
   *  this was first used) count as seen. */
  const take = useCallback((p: ScoringProgress | null) => {
    if (!p) return;
    setProgress(p);
    const stored = readSeen();
    // Seen: anything back before you were last in the library (you got the notice there).
    const seenThere = p.finished.filter((b) => Date.parse(b.at) <= libraryVisit.current).map((b) => b.id);
    const next =
      inLibraryRef.current || stored === null
        ? [...new Set([...p.finished.map((b) => b.id), ...(stored ?? [])])]
        : [...new Set([...seenThere, ...stored])];
    if (next !== stored) writeSeen(next);
    setSeen(next);
  }, []);

  // Once a minute while something is being scored, every 5 minutes otherwise; not at
  // all in the library, which keeps its own watch. The database is small.
  const scoringRef = useRef(false);
  useEffect(() => {
    if (inLibrary) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible" && Date.now() - last.current >= 20_000) {
        last.current = Date.now();
        const p = await scoringPulse();
        take(p);
        scoringRef.current = Boolean(p && (p.waiting || p.packing || p.batches.length));
      }
      if (!stopped) timer = setTimeout(check, scoringRef.current ? 60_000 : 5 * 60_000);
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [take, inLibrary]);

  // In the library its own bar shows scoring; the menu count is for elsewhere.
  if (!progress || inLibrary) return { scoring: 0, scored: 0 };
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
  const countFor = (href: string): NavCount | null => {
    if (href === "/studio/briefs" && unseen) return { value: unseen, tone: "new", label: `${unseen} new from the site` };
    if (href !== "/studio/library" || !library) return null;
    if (library.scoring) return { value: library.scoring, tone: "busy", label: `Scoring ${library.scoring} ${library.scoring === 1 ? "image" : "images"}` };
    if (library.scored) return { value: library.scored, tone: "new", label: `${library.scored} scored since you last looked` };
    return null;
  };

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
            <NavLabel label={item.label} active={active} count={countFor(item.href)} />
          </Link>
        );
      })}
    </nav>
  );
}
