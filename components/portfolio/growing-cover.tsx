"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * After atmos.gallery: the cover starts as a smaller rounded frame under the
 * title and opens out to the full width of the screen as you scroll, while
 * the picture inside drifts a little slower than the frame (a light
 * parallax). Reduced motion: shown full width, still.
 */
export function GrowingCover({ children }: { children: ReactNode }) {
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
      const gutter = vw >= 640 ? 24 : 16;
      const from = vw >= 1024 ? 0.8 : vw >= 640 ? 0.84 : 0.86;
      const width = vw * from + (vw - 2 * gutter - vw * from) * ease;
      el.style.width = `${width}px`;
      pic.style.transform = `translateY(${(0.5 - p) * 6}%) scale(1.08)`;
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
  }, []);

  return (
    // Breaks out of the page column so it can reach the screen's edges.
    <div className="relative left-1/2 flex w-screen -translate-x-1/2 justify-center">
      <div ref={frame} className="w-[86vw] overflow-hidden rounded-[24px] bg-panel [clip-path:inset(0_round_24px)] sm:w-[84vw] lg:w-[80vw]">
        <div ref={inner}>
          {children}
        </div>
      </div>
    </div>
  );
}
