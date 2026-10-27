"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * After atmos.gallery: a picture starts as a rounded frame a little narrower
 * than the screen and opens out to its full width as you scroll, while the
 * picture inside drifts a little slower than the frame (a light parallax).
 * Used for the cover and every image block of a case study. Two or three
 * pictures side by side (`split`) grow together, each with its own rounded
 * corners, without the parallax. Reduced motion: full width, still.
 */
export function GrowingCover({ children, split = false }: { children: ReactNode; split?: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = frame.current;
    const pic = inner.current;
    if (!el || !pic) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    const draw = () => {
      raf = 0;
      const vh = window.innerHeight;
      const vw = document.documentElement.clientWidth;
      const top = el.getBoundingClientRect().top;
      // Small while its top is in the lower part of the screen; full width once it has risen most of a screen.
      const raw = (vh * 0.8 - top) / (vh * 0.85);
      const p = still.matches ? 1 : Math.min(1, Math.max(0, raw));
      const ease = 1 - (1 - p) ** 2;
      // From 1280px the side scale sits in the right margin: stop short of it on both sides.
      const gutter = vw >= 1280 ? 176 : vw >= 640 ? 24 : 16;
      const full = vw - 2 * gutter;
      const start = Math.min(vw * (vw >= 1024 ? 0.8 : vw >= 640 ? 0.84 : 0.86), full * 0.82);
      const width = start + (full - start) * ease;
      el.style.width = `${width}px`;
      if (!split) pic.style.transform = `translateY(${(0.5 - p) * 6}%) scale(1.08)`;
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [split]);

  return (
    // Breaks out of the page column so it can reach the screen's edges.
    <div className="relative left-1/2 flex w-screen -translate-x-1/2 justify-center">
      <div
        ref={frame}
        className={
          split
            ? "w-[86vw] sm:w-[84vw] lg:w-[80vw]"
            : "w-[86vw] overflow-hidden rounded-[16px] bg-panel [clip-path:inset(0_round_16px)] sm:w-[84vw] lg:w-[80vw]"
        }
      >
        <div ref={inner}>
          {children}
        </div>
      </div>
    </div>
  );
}
