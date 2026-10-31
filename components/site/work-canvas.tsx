"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PortfolioMedia } from "@/lib/portfolio/types";
import { COLUMNS, LABEL, PAGE } from "@/components/site/site-frame";
import { cn } from "@/components/ui/primitives";

export type WorkTile = { key: string; href: string; title: string; meta: string; media: PortfolioMedia };
export type WorkRow = { key: string; number: string; href: string; title: string; meta: string; media: PortfolioMedia | null };
type Copy = { title: string; intro: string; hint: string; canvas: string; index: string; views: string; empty: string; count: string };
type View = "canvas" | "index";

/* ------------------------------------------------------------------ layout */

/**
 * One tile of the endless canvas, 2900 × 2350: twelve places, portrait (P)
 * or landscape (L), some passing over the big word and some under it.
 * More than twelve pictures add more tiles' worth of rows below.
 */
const TILE_W = 2900;
const TILE_H = 2350;
const SLOTS: [x: number, y: number, shape: "P" | "L", over: boolean][] = [
  [72, 48, "L", false],
  [864, 276, "P", true],
  [1536, 24, "L", false],
  [2328, 312, "P", true],
  [156, 828, "P", true],
  [840, 1056, "L", true],
  [1632, 792, "P", false],
  [2232, 1152, "L", false],
  [72, 1680, "L", false],
  [912, 1752, "P", false],
  [1560, 1596, "L", true],
  [2352, 1824, "P", true],
];
const SIZE = { P: [370, 493], L: [490, 368] } as const;

/** Repeats the pictures until every place has one (five projects still fill the canvas). */
function deal(tiles: WorkTile[]) {
  const count = Math.max(SLOTS.length, Math.ceil(tiles.length / SLOTS.length) * SLOTS.length);
  return Array.from({ length: count }, (_, i) => {
    const [x, y, shape, over] = SLOTS[i % SLOTS.length];
    return { tile: tiles[i % tiles.length], x, y: y + Math.floor(i / SLOTS.length) * TILE_H, shape, over, n: i };
  });
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/* ------------------------------------------------------------------ view */

export function WorkCanvas({ tiles, rows, copy, footer }: { tiles: WorkTile[]; rows: WorkRow[]; copy: Copy; footer?: ReactNode }) {
  const [view, setView] = useState<View>("canvas");
  const hasCanvas = tiles.length > 0;

  const choose = (v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  };

  const showCanvas = hasCanvas && view === "canvas";

  return (
    <>
      {showCanvas ? <Canvas tiles={tiles} copy={copy} /> : null}

      {/* The index: the only view on phones, the other view from tablets up. */}
      <div className={cn(showCanvas && "min-[700px]:hidden")}>
      <main className={cn(PAGE, "pt-12")}>
        <section className={cn(COLUMNS, "pt-20 pb-14 sm:pt-28 sm:pb-20")}>
          <div className={cn(LABEL, "pt-3 text-muted")}>{copy.count}</div>
          <div className="min-w-0">
            <h1 className="text-[clamp(44px,5.6vw,80px)] leading-[1.05] font-normal tracking-[-0.02em]">{copy.title}</h1>
            <p className="mt-8 max-w-[740px] text-[19px] leading-[1.65] text-ink-soft">{copy.intro}</p>
          </div>
        </section>

        {rows.length ? (
          <ul className="group/list border-b border-rule">
            {rows.map((row, i) => (
              <li key={row.key} className="border-t border-rule">
                <Link
                  href={row.href}
                  className="group/row relative grid grid-cols-1 gap-y-1.5 py-6 min-[700px]:grid-cols-[200px_minmax(0,1fr)_minmax(0,200px)_24px] min-[700px]:items-center min-[700px]:gap-x-10 min-[700px]:py-7"
                >
                  <span className={cn(LABEL, "text-muted")}>{row.number}</span>
                  <div className="min-w-0">
                    {/* Phones: the picture above the name. */}
                    <div className="mt-3 mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-panel min-[700px]:hidden">
                      {row.media ? <Picture media={row.media} eager={i < 2} /> : null}
                    </div>
                    <h2 className="text-[34px] leading-[1.1] tracking-[-0.01em] transition-colors duration-150 min-[700px]:text-[clamp(40px,4vw,56px)] min-[700px]:group-hover/list:text-muted min-[700px]:group-hover/row:!text-ink">
                      {row.title}
                    </h2>
                  </div>
                  <span className="text-[15px] leading-[1.5] text-ink-soft">{row.meta}</span>
                  <span aria-hidden className="hidden text-right text-[22px] text-muted transition-transform duration-200 group-hover/row:translate-x-1 min-[700px]:block">
                    →
                  </span>
                  {/* Larger screens: the picture comes up beside the name on hover. */}
                  {row.media ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 right-[250px] z-10 hidden aspect-[4/3] w-[240px] -translate-y-1/2 scale-90 -rotate-3 overflow-hidden rounded-[10px] opacity-0 shadow-[0_30px_60px_rgba(0,0,0,.6)] transition duration-200 group-hover/row:scale-100 group-hover/row:opacity-100 min-[1000px]:block"
                    >
                      <Picture media={row.media} />
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft">{copy.empty}</p>
        )}
      </main>
      {footer}
      </div>

      {/* The switch between the two views (tablets up). */}
      {hasCanvas ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden min-[700px]:block">
          <div className={cn(PAGE, "flex items-center justify-between pb-6")}>
            <span className={cn(LABEL, "text-[11px] text-muted", !showCanvas && "invisible")}>{copy.count}</span>
            <div role="group" aria-label={copy.views} className="pointer-events-auto flex gap-1 rounded-full border border-rule bg-panel/85 p-1 backdrop-blur-md">
              {(["canvas", "index"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => choose(v)}
                  className={cn(
                    LABEL,
                    "rounded-full px-3.5 py-2 text-[11px] transition-colors",
                    view === v ? "bg-ink text-paper" : "text-muted hover:text-ink",
                  )}
                >
                  {copy[v]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ canvas */

function Canvas({ tiles, copy }: { tiles: WorkTile[]; copy: Copy }) {
  const stage = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  const placed = deal(tiles);

  // The page itself doesn't scroll while the canvas is up (tablets and larger).
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 700px)");
    const lock = () => {
      document.documentElement.style.overflow = wide.matches ? "hidden" : "";
    };
    lock();
    wide.addEventListener("change", lock);
    return () => {
      wide.removeEventListener("change", lock);
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rows = Math.ceil(placed.length / SLOTS.length);

    // Where the canvas is (x, y) and where it's heading (tx, ty); it eases there.
    let x = -400, y = -560, tx = x, ty = y;
    let drag: { px: number; py: number; tx: number; ty: number } | null = null;
    let moved = 0;
    let frame = 0;

    const place = () => {
      const W = window.innerWidth, H = window.innerHeight;
      // Wide screens stretch the layout so a picture never shows twice at once.
      const sx = Math.max(1, (W + 900) / TILE_W);
      const sy = Math.max(1, (H + 900) / (TILE_H * rows));
      const tw = TILE_W * sx, th = TILE_H * rows * sy;
      const mx = (tw - W) / 2, my = (th - H) / 2;
      placed.forEach((p, i) => {
        const card = cards.current[i];
        if (!card) return;
        const left = mod(p.x * sx + x + mx, tw) - mx;
        const top = mod(p.y * sy + y + my, th) - my;
        card.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      });
    };
    const tick = () => {
      const ease = still ? 1 : 0.09;
      x += (tx - x) * ease;
      y += (ty - y) * ease;
      place();
      frame = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      tx -= e.deltaX * 0.9;
      ty -= e.deltaY * 0.9;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { px: e.clientX, py: e.clientY, tx, ty };
      moved = 0;
      cursor.current?.setAttribute("data-state", "grab");
    };
    const onMove = (e: PointerEvent) => {
      const c = cursor.current;
      if (c) c.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (drag) {
        const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
        moved = Math.max(moved, Math.hypot(dx, dy));
        tx = drag.tx + dx * 1.4;
        ty = drag.ty + dy * 1.4;
      } else {
        const over = e.target instanceof Element && e.target.closest("[data-card]");
        c?.setAttribute("data-state", over ? "open" : "");
      }
    };
    const onUp = () => {
      drag = null;
      cursor.current?.setAttribute("data-state", "");
    };
    // A drag that ends on a picture isn't a click on it.
    const onClick = (e: MouseEvent) => {
      if (moved > 6) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const step = { ArrowLeft: [240, 0], ArrowRight: [-240, 0], ArrowUp: [0, 240], ArrowDown: [0, -240] }[e.key];
      if (!step) return;
      e.preventDefault();
      tx += step[0];
      ty += step[1];
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("click", onClick, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    place();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("click", onClick, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [placed.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={stage}
      className="work-stage fixed inset-0 z-0 hidden touch-none overflow-hidden select-none min-[700px]:block"
      aria-label={copy.title}
    >
      <h1 className="pointer-events-none absolute top-1/2 left-1/2 z-[5] -translate-x-1/2 -translate-y-[56%] text-[clamp(140px,17vw,260px)] leading-[0.9] font-bold tracking-[-0.055em] whitespace-nowrap text-ink">
        {copy.title}
      </h1>
      <p className="pointer-events-none absolute top-1/2 left-1/2 z-[5] translate-x-[calc(-50%+9vw)] translate-y-[calc(9vw-2%)] text-[22px] text-ink-soft">
        {copy.hint}
      </p>

      {placed.map((p, i) => {
        const [w, h] = SIZE[p.shape];
        return (
          <Link
            key={`${p.tile.key}-${p.n}`}
            ref={(node) => {
              cards.current[i] = node;
            }}
            href={p.tile.href}
            draggable={false}
            data-card
            // Repeats are for the eye only; each project is reachable once by keyboard and screen reader.
            tabIndex={i < tiles.length ? undefined : -1}
            aria-hidden={i < tiles.length ? undefined : true}
            className={cn(
              "group/card absolute top-0 left-0 block overflow-hidden rounded-md bg-panel will-change-transform",
              p.over ? "z-[8]" : "z-[2]",
            )}
            style={{ width: w, height: h }}
          >
            <Picture media={p.tile.media} eager={i < 6} className="transition-transform duration-700 ease-[cubic-bezier(.2,.7,.2,1)] group-hover/card:scale-[1.04]" />
            <span aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent from-35% to-black/70 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100" />
            <span className="absolute inset-x-5 bottom-5 translate-y-2.5 text-white opacity-0 transition duration-300 group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-visible/card:translate-y-0 group-focus-visible/card:opacity-100">
              <span className="block text-[40px] leading-[1.02] font-medium tracking-[-0.02em] text-balance">{p.tile.title}</span>
              {p.tile.meta ? <span className={cn(LABEL, "mt-2 block text-[11px] text-white/80")}>{p.tile.meta}</span> : null}
            </span>
          </Link>
        );
      })}

      {/* Keeps the header readable over the pictures. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[9] h-28 bg-linear-to-b from-paper to-transparent" />

      <div ref={cursor} aria-hidden data-state="" className="work-cursor">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </div>
  );
}

/** A picture filling its frame, cropped to fit. Videos play silently on a loop. */
function Picture({ media, eager, className }: { media: PortfolioMedia; eager?: boolean; className?: string }) {
  const cls = cn("pointer-events-none block size-full object-cover", className);
  if (media.kind === "video") {
    return <video src={media.url} className={cls} autoPlay muted loop playsInline preload="metadata" aria-label={media.alt || undefined} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.url} alt={media.alt} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} className={cls} />;
}
