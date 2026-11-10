"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { PortfolioMedia } from "@/lib/portfolio/types";
import { FADERS, match, mixFor, type Mix } from "@/lib/portfolio/channels";
import { useMix } from "@/lib/portfolio/mix-store";
import { Media } from "@/components/portfolio/media";
import { LABEL, PAGE } from "@/components/site/site-frame";
import { cn } from "@/components/ui/primitives";
import { SITE_COPY, type Locale } from "@/lib/i18n/site";

export type BoardPicture = { key: string; media: PortfolioMedia; slug: string; title: string; href: string };

/** How close a picture has to sit to the mix to make the board (1 = exactly there). */
const CUTOFF = 0.62;
/** How long the faders rest before the board redraws. */
const SETTLE_MS = 220;

/**
 * Under the "Mix to your taste" table on the Work page. Untouched, it shows
 * the projects (`children`, the grid). Once a fader moves, the projects give
 * way to one moodboard: every picture from every project that sits close to
 * the mix, closest first, so the work can be seen as a whole rather than
 * project by project. It redraws only when the table changes (a moment
 * after a fader stops), the pictures settling in one after another.
 * A picture sits where its project sits on the faders (lib/portfolio/channels).
 */
export function WorkBoard({ pictures, projects, locale, children }: { pictures: BoardPicture[]; projects: number; locale: Locale; children: ReactNode }) {
  // Looked up here: the copy has functions in it, which can't be handed over from the server.
  const copy = SITE_COPY[locale].works.board;
  const live = useMix();
  const [mix, setSettled] = useState<Mix>(live);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(live), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [live]);

  const touched = FADERS.some((f) => mix[f.key] !== 0);
  const ranked = touched
    ? pictures
        .map((p, i) => ({ p, i, fit: match(mix, mixFor(p.slug)) }))
        .filter((x) => x.fit >= CUTOFF)
        .sort((a, b) => b.fit - a.fit || a.i - b.i)
        .map((x) => x.p)
    : [];
  const from = new Set(ranked.map((p) => p.slug)).size;
  // A new mix deals the board again.
  const deal = FADERS.map((f) => mix[f.key]).join();

  return (
    <>
      <div className={cn(PAGE, LABEL, "mb-4 flex flex-wrap justify-between gap-3 text-muted")} aria-live="polite">
        {touched ? (
          <>
            <span>( {copy.board(ranked.length, from)} )</span>
            <span>( {copy.closest} )</span>
          </>
        ) : (
          <>
            <span>( {copy.all(projects)} )</span>
            <span className="hidden sm:inline">( {copy.hint} )</span>
          </>
        )}
      </div>

      {!touched ? (
        children
      ) : ranked.length ? (
        <ul key={deal} className="columns-2 gap-2 px-2 lg:columns-4">
          {ranked.map((p, i) => (
            <li key={p.key} className="work-board-pic mb-2 break-inside-avoid" style={{ "--i": i } as CSSProperties}>
              <Link href={p.href} className="group relative block overflow-hidden rounded-[16px] bg-panel" aria-label={p.title}>
                <Media media={p.media} sizes="(min-width: 1024px) 25vw, 50vw" />
                <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-[4px] bg-paper/70 px-2 py-1.5 text-[13px] leading-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {p.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(PAGE, "py-24 text-center text-ink-soft")}>{copy.none}</p>
      )}
    </>
  );
}
