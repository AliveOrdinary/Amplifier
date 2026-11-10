"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PortfolioMedia } from "@/lib/portfolio/types";
import { LABEL, PAGE } from "@/components/site/site-frame";
import { cn } from "@/components/ui/primitives";

/** How long each picture shows before the next cuts in (as on studio1030.at). */
const STEP_MS = 420;

/**
 * Home, after studio1030.at: the work fills the screen, cutting from one
 * picture to the next on its own (no fade). Scrolling moves the whole
 * slideshow up with the page, pixel for pixel, uncovering what sits
 * still underneath (`children`: the closing call, footer at the bottom).
 * One screen of scroll and it's gone; that's the end of the page. Stopping
 * partway settles on the nearer end. The seal (BriefSeal) reads
 * [data-seal-lift] to ride from the bottom of the screen into its spot.
 */
export function HomeWorks({ pictures, hint, children }: { pictures: PortfolioMedia[]; hint: string; children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  // The cut: one picture after another, looping. Stays on the first for reduced motion.
  useEffect(() => {
    if (pictures.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setShown((n) => (n + 1) % pictures.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [pictures.length]);

  // The lift follows the scroll; a scroll that stops partway settles.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let frame = 0;
    let settle = 0;
    const draw = () => {
      frame = 0;
      const y = Math.min(Math.max(window.scrollY, 0), window.innerHeight);
      el.style.transform = `translate3d(0, ${-y}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        const vh = window.innerHeight;
        const y = window.scrollY;
        if (y > 0 && y < vh - 1) window.scrollTo({ top: y > vh * 0.25 ? vh : 0, behavior: "smooth" });
      }, 140);
    };
    draw();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", draw);
    };
  }, []);

  return (
    <>
      <div ref={stage} data-seal-lift className="fixed inset-0 z-30 overflow-hidden bg-black will-change-transform">
        {pictures.map((media, i) => (
          <div key={`${media.id}-${i}`} className={cn("absolute inset-0", i === shown ? "visible" : "invisible")}>
            {media.kind === "video" ? (
              <video src={media.url} className="size-full object-cover" autoPlay muted loop playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt={media.alt} className="size-full object-cover" loading={i < 2 ? "eager" : "lazy"} decoding="async" />
            )}
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-5 text-white mix-blend-difference">
          <div className={cn(PAGE, LABEL, "text-[11px]")}>{hint}</div>
        </div>
      </div>

      {/* One extra screen of scroll: the call stays put underneath while the work lifts away. */}
      <div className="relative h-[200vh]">
        <div className="sticky top-0 h-screen">{children}</div>
      </div>
    </>
  );
}
