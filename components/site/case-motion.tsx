"use client";

import { useEffect } from "react";

/**
 * How the site scrolls, after the case studies (mubien.com, which uses Lenis);
 * on every page: Home, Work, the case studies and Start a brief.
 * - The wheel scrolls smoothly: each turn moves a target and the page eases
 *   toward it (a tenth of the way each frame). Touch, keys and the
 *   scrollbar keep the browser's own scrolling.
 * - Each picture (`.case-tile`) waits as a plain tile and fades in as it
 *   comes up the screen.
 * Reduced motion: no easing, pictures show at once.
 */
export function CaseMotion() {
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Pictures fade in as they arrive.
    const tiles = document.querySelectorAll<HTMLElement>(".case-tile");
    const seen = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.setAttribute("data-in", "");
          seen.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -10% 0px" },
    );
    tiles.forEach((t) => (still ? t.setAttribute("data-in", "") : seen.observe(t)));

    // Smooth wheel scrolling, on a mouse or trackpad only.
    if (still || !window.matchMedia("(pointer: fine)").matches) return () => seen.disconnect();
    const root = document.documentElement;
    root.classList.add("case-smooth");
    let target = window.scrollY;
    let current = window.scrollY;
    let running = false;
    let frame = 0;
    const max = () => root.scrollHeight - window.innerHeight;
    const step = () => {
      current += (target - current) * 0.1;
      if (Math.abs(target - current) < 0.5) {
        current = target;
        running = false;
      }
      window.scrollTo(0, current);
      frame = running ? requestAnimationFrame(step) : 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.defaultPrevented) return;
      // Leave scrollable boxes inside the page to themselves.
      const inner = (e.target as Element | null)?.closest?.("[data-scroll-inside]");
      if (inner) return;
      e.preventDefault();
      if (!running) target = current = window.scrollY;
      const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = Math.max(0, Math.min(max(), target + e.deltaY * lines));
      if (!running) {
        running = true;
        frame = requestAnimationFrame(step);
      }
    };
    // Any other scrolling (keys, scrollbar, a link to #brief) takes over where it lands.
    const onScroll = () => {
      if (!running) target = current = window.scrollY;
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      seen.disconnect();
      cancelAnimationFrame(frame);
      root.classList.remove("case-smooth");
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
