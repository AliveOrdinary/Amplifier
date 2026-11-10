"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PortfolioMedia } from "@/lib/portfolio/types";
import { FADERS, FLAT_MIX, match, mixFor, type FaderKey, type Mix } from "@/lib/portfolio/channels";
import { setMix, useMix } from "@/lib/portfolio/mix-store";
import { WorkCursor, useWorkHover } from "@/components/site/work-grid";
import { LABEL, PAGE } from "@/components/site/site-frame";
import { cn } from "@/components/ui/primitives";
import { HOME_COPY } from "@/lib/i18n/home";
import { SITE_COPY, type Locale } from "@/lib/i18n/site";

export type BoardPicture = { key: string; media: PortfolioMedia; slug: string; title: string; href: string };

/** How close a picture has to sit to the mix to make the board (1 = exactly there). */
const CUTOFF = 0.62;
/** How long the mix rests before the board redraws. */
const SETTLE_MS = 220;
/** Each word's three choices: one end, either, the other end. */
const STEPS = [-2, 0, 2] as const;

const rank = (pictures: BoardPicture[], mix: Mix) =>
  pictures
    .map((p, i) => ({ p, i, fit: match(mix, mixFor(p.slug)) }))
    .filter((x) => x.fit >= CUTOFF)
    .sort((a, b) => b.fit - a.fit || a.i - b.i)
    .map((x) => x.p);

/**
 * The Work page under its heading. Untouched, it shows the projects
 * (`children`, the grid). A line floats at the bottom of the screen, after
 * Pentagram's "We design Everything for Everyone": "Show me work that's
 * Minimal or rich, Quiet or loud, Serious or playful and Organic or
 * geometric". Each word opens upward to its three choices; picking one end
 * turns the projects into one moodboard of every picture close to the mix,
 * closest first. A choice that would leave the board empty is greyed out.
 * A picture sits where its project sits on the faders (lib/portfolio/channels).
 */
export function WorkBoard({ pictures, locale, children }: { pictures: BoardPicture[]; locale: Locale; children: ReactNode }) {
  // Looked up here: the copy has functions in it, which can't be handed over from the server.
  const copy = SITE_COPY[locale].works.board;
  const live = useMix();
  const [mix, setSettled] = useState<Mix>(live);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(live), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [live]);

  const touched = FADERS.some((f) => mix[f.key] !== 0);
  const ranked = touched ? rank(pictures, mix) : [];
  const from = new Set(ranked.map((p) => p.slug)).size;
  // A new mix deals the board again.
  const deal = FADERS.map((f) => mix[f.key]).join();

  return (
    <>
      {touched ? (
        <div className={cn(PAGE, LABEL, "mb-4 flex flex-wrap justify-between gap-3 text-muted")} aria-live="polite">
          <span>( {copy.board(ranked.length, from)} )</span>
          <span>( {copy.closest} )</span>
        </div>
      ) : null}

      {!touched ? (
        children
      ) : ranked.length ? (
        <Board key={deal} pictures={ranked} />
      ) : (
        <p className={cn(PAGE, "py-24 text-center text-ink-soft")}>{copy.none}</p>
      )}

      <MixLine pictures={pictures} locale={locale} />
    </>
  );
}

/**
 * The moodboard: the pictures in four columns (two on phones), each at its own
 * proportions, with the Work grid's hover: they wipe up into view, the pointer
 * is the dot that grows into an arrow, and a picture's top trims in.
 */
function Board({ pictures }: { pictures: BoardPicture[] }) {
  const area = useRef<HTMLUListElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  useWorkHover(area, cursor, pictures.length);
  return (
    <>
      <ul ref={area} className="work-grid columns-2 gap-2 px-2 lg:columns-4">
        {pictures.map((p, i) => (
          <li key={p.key} className="mb-2 break-inside-avoid">
            <Link href={p.href} data-work-card className="work-card group block" style={{ "--delay": `${(i % 4) * 120}ms` } as CSSProperties} aria-label={p.title}>
              <div data-work-media className="work-media relative overflow-hidden bg-panel" style={{ aspectRatio: ratioOf(p.media) }}>
                {p.media.kind === "video" ? (
                  <video src={p.media.url} className="work-cover" autoPlay muted loop playsInline preload="metadata" aria-label={p.media.alt || undefined} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.media.url} alt={p.media.alt} loading={i < 8 ? "eager" : "lazy"} decoding="async" className="work-cover" />
                )}
                <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-[4px] bg-paper/70 px-2 py-1.5 text-[13px] leading-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {p.title}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <WorkCursor ref={cursor} />
    </>
  );
}

/** A picture's proportions; 4:3 until the file's size is known. */
const ratioOf = (m: PortfolioMedia) => (m.width && m.height ? m.width / m.height : 4 / 3);

/** The floating line: the four faders as words, each opening upward to its choices. */
function MixLine({ pictures, locale }: { pictures: BoardPicture[]; locale: Locale }) {
  const copy = SITE_COPY[locale].works.board;
  const faders = HOME_COPY[locale].desk.faders;
  const mix = useMix();
  const [open, setOpen] = useState<FaderKey | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const touched = FADERS.some((f) => mix[f.key] !== 0);

  // Escape or a click outside closes the choices.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const wordFor = (key: FaderKey, v: number) =>
    v < 0 ? faders[key].left : v > 0 ? faders[key].right : `${faders[key].left} ${copy.or} ${faders[key].right.toLowerCase()}`;

  const word = (key: FaderKey) => (
    <button
      type="button"
      aria-expanded={open === key}
      aria-label={`${faders[key].name}: ${wordFor(key, mix[key])}`}
      onClick={() => setOpen((o) => (o === key ? null : key))}
      className={cn("mix-word inline-flex items-center gap-1 px-0.5", mix[key] !== 0 ? "text-signal" : "text-ink")}
      data-open={open === key ? "" : undefined}
    >
      {wordFor(key, mix[key])}
    </button>
  );
  const [a, b, c, d] = FADERS.map((f) => f.key);

  return (
    <>
      <div
        aria-hidden
        className={cn("fixed inset-0 z-[34] bg-paper/55 transition-opacity duration-400", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <div ref={box} className="fixed bottom-4 left-1/2 z-[35] w-max max-w-[calc(100vw-32px)] -translate-x-1/2 sm:bottom-6">
        <div className="overflow-hidden rounded-[16px] bg-[#1d1c1a] shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
          <div className="mix-panel grid" data-open={open ? "" : undefined}>
            <div className="overflow-hidden">
              {open ? (
                <div className="mix-chips flex max-w-[640px] flex-wrap justify-center gap-1.5 px-5 pt-5 pb-1">
                  <span className={cn(LABEL, "mb-2 w-full text-center text-muted")}>
                    ( {String(FADERS.findIndex((f) => f.key === open) + 1).padStart(2, "0")} ✺ {faders[open].name} )
                  </span>
                  {STEPS.map((v) => {
                    // A choice that would leave the board empty can't be picked.
                    const empty = v !== 0 && !rank(pictures, { ...mix, [open]: v }).length;
                    const on = Math.sign(mix[open]) === Math.sign(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={empty}
                        onClick={() => {
                          setMix((m) => ({ ...m, [open]: v }));
                          setOpen(null);
                        }}
                        className={cn(
                          "rounded-[6px] px-2.5 py-2 text-[13px] leading-none font-light sm:text-[15px]",
                          on ? "bg-ink text-paper" : "bg-[#2a2926] text-ink hover:bg-[#383632]",
                          "disabled:bg-[#222120] disabled:text-[#5a5852]",
                        )}
                      >
                        {wordFor(open, v)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <p className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 px-3.5 py-3 text-[13px] font-light sm:px-[18px] sm:py-3.5 sm:text-[15px] sm:whitespace-nowrap">
            <span className="text-muted">{copy.lead}</span>
            <span>
              {word(a)}
              <span className="text-muted">,</span>
            </span>
            <span>
              {word(b)}
              <span className="text-muted">,</span>
            </span>
            {word(c)}
            <span className="text-muted">{copy.and}</span>
            {word(d)}
            {touched ? (
              <button type="button" onClick={() => setMix(FLAT_MIX)} className={cn(LABEL, "ml-2 text-muted hover:text-ink")}>
                {copy.reset}
              </button>
            ) : null}
          </p>
        </div>
      </div>
    </>
  );
}
