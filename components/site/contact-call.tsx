"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { FADERS, match, mixFor } from "@/lib/portfolio/channels";
import { useMix } from "@/lib/portfolio/mix-store";
import type { ProjectCard } from "@/lib/portfolio/types";

/**
 * The closing call. One big line in two halves with the button between
 * them; the work starts as a stack of tiles behind the button and deals out
 * across the section as you scroll in, while the grey second half of the
 * line comes up to full white, like a fader being pushed. Scrolling back
 * gathers the stack again.
 */

const big = "text-[clamp(44px,8.4vw,128px)] leading-[0.92] font-medium tracking-[-0.04em]";

/** Same rounded square as the desk tiles. */
const TILE_RADIUS = "16%";

/**
 * Where tiles land, most prominent first: the first sits big and close to
 * the headline, the last small and out at the edge. As fractions of the
 * section (centre of the tile; across: phones, then wider), size as a
 * fraction of its width (phones, then wider), and tilt while stacked.
 */
const SLOTS = [
  { x: [0.78, 0.8], y: 0.2, size: [0.36, 0.22], tilt: 5 },
  { x: [0.24, 0.2], y: 0.82, size: [0.32, 0.19], tilt: 3 },
  { x: [0.2, 0.15], y: 0.24, size: [0.26, 0.14], tilt: -7 },
  { x: [0.8, 0.86], y: 0.85, size: [0.22, 0.11], tilt: -4 },
];
/** Before anyone touches the faders: the studio's order, spread evenly. */
const DEFAULT_SLOTS = [2, 0, 1, 3];

export function ContactCall({
  lead,
  tail,
  cta,
  body,
  mixed,
  href,
  projects,
}: {
  lead: string;
  tail: string;
  cta: string;
  body: string;
  /** Shown once the visitor has moved the faders: the layout follows their mix. */
  mixed: string;
  href: string;
  projects: ProjectCard[];
}) {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLAnchorElement>(null);
  const tiles = useRef<(HTMLDivElement | null)[]>([]);

  const art = projects.flatMap((p) => {
    const m = p.thumbnail ?? p.cover;
    return m ? [{ media: m, slug: p.slug }] : [];
  }).slice(0, SLOTS.length);
  const count = art.length;

  // Lay the work out by the desk's mix: the closest match gets the biggest, nearest place.
  const mix = useMix();
  const touched = FADERS.some((f) => mix[f.key] !== 0);
  const levels = art.map((a) => match(mix, mixFor(a.slug)));
  const ranked = levels.map((_, i) => i).sort((a, b) => levels[b] - levels[a]);
  const slotOf = art.map((_, i) => (touched ? ranked.indexOf(i) : DEFAULT_SLOTS[i]));
  const layout = useRef({ slotOf, levels, touched });
  useEffect(() => {
    layout.current = { slotOf, levels, touched };
  });

  useEffect(() => {
    const el = root.current;
    const rail = track.current;
    if (!el || !rail) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const draw = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const run = rail.getBoundingClientRect();
      // The section holds still while the track scrolls past: 0 when it pins, 1 when it lets go.
      const raw = -run.top / Math.max(1, run.height - window.innerHeight);
      const p = still.matches ? 1 : Math.min(1, Math.max(0, raw * 1.15));
      const ease = 1 - (1 - p) ** 3;
      el.style.setProperty("--p", String(ease));

      const b = button.current?.getBoundingClientRect();
      const fromX = b ? b.left + b.width / 2 - box.left : box.width / 2;
      const fromY = b ? b.top + b.height / 2 - box.top : box.height / 2;
      const wide = window.innerWidth >= 640;

      const { slotOf, levels, touched } = layout.current;
      tiles.current.forEach((t, i) => {
        if (!t) return;
        const s = SLOTS[slotOf[i]] ?? SLOTS[i];
        // A close match grows a little, a far one shrinks.
        const fit = touched ? 0.8 + 0.4 * levels[i] : 1;
        const size = box.width * s.size[wide ? 1 : 0] * fit;
        const x = fromX + (box.width * s.x[wide ? 1 : 0] - fromX) * ease - size / 2;
        const y = fromY + (box.height * s.y - fromY) * ease - size / 2;
        t.style.width = `${size}px`;
        t.style.transform = `translate(${x}px, ${y}px) rotate(${s.tilt * (1 - ease)}deg) scale(${0.5 + 0.5 * ease})`;
        t.style.opacity = "1";
      });
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [count]);

  // When the mix changes, glide the tiles to their new places.
  const key = slotOf.join() + levels.map((l) => l.toFixed(2)).join();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.dataset.gliding = "";
    window.dispatchEvent(new Event("resize"));
    const done = setTimeout(() => delete el.dataset.gliding, 800);
    return () => clearTimeout(done);
  }, [key]);

  return (
    // A tall track; the section inside it stays pinned to the screen while the tiles deal out.
    <div ref={track} className="relative h-[200svh] motion-reduce:h-auto">
    <div
      ref={root}
      className="sticky top-0 isolate flex h-svh min-h-[640px] flex-col items-center justify-center overflow-hidden text-center motion-reduce:relative motion-reduce:h-auto motion-reduce:py-32"
      style={{ "--p": 1 } as CSSProperties}
    >
      {Array.from({ length: count }, (_, i) => {
        const m = art[i].media;
        return (
          <div
            key={i}
            ref={(node) => {
              tiles.current[i] = node;
            }}
            aria-hidden
            className="absolute top-0 left-0 aspect-square overflow-hidden bg-panel opacity-0 will-change-transform in-data-gliding:transition-[transform,width] in-data-gliding:duration-700 in-data-gliding:ease-out"
            style={{ borderRadius: TILE_RADIUS, zIndex: -1 - i }}
          >
            {m.kind === "video" ? (
              <video src={m.url} className="size-full object-cover" autoPlay muted loop playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
            )}
          </div>
        );
      })}

      <span aria-hidden className="power-led order-first mb-8 size-2.5 rounded-full bg-signal shadow-[0_0_14px_var(--signal)]" />
      {/* The heading reads as one sentence; the button sits between its halves on screen. */}
      <h2 className="contents">
        <span className={`${big} order-1 block`}>{lead}</span>
        <span className={`${big} order-3 block`} style={{ color: "color-mix(in oklab, var(--ink) calc(var(--p) * 100%), var(--muted))" }}>
          {tail}
        </span>
      </h2>
      <a
        ref={button}
        href={href}
        className="order-2 my-6 inline-flex h-12 items-center rounded-full bg-ink px-7 font-mono text-[12px] tracking-[0.08em] text-paper uppercase transition-colors hover:bg-signal hover:text-on-signal sm:my-8"
      >
        {cta}
      </a>
      <p className="order-4 mt-10 max-w-[440px] text-[15px] leading-relaxed text-ink-soft">{body}</p>
      <p aria-live="polite" className="order-5 mt-6 h-4 font-mono text-[12px] tracking-[0.08em] text-signal uppercase">
        {touched ? `( ${mixed} )` : null}
      </p>
    </div>
    </div>
  );
}
