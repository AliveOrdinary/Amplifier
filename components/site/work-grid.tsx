"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import type { PortfolioMedia } from "@/lib/portfolio/types";
import { LABEL } from "@/components/site/site-frame";
import { cn } from "@/components/ui/primitives";

export type WorkItem = { key: string; href: string; title: string; meta: string; media: PortfolioMedia | null };

/**
 * The Work page's grid, after brand-nw.com/work: tall 3:4 covers edge to
 * edge, three across (two on tablets, one on phones), in the studio's curve
 * (--curve), the name and services under each.
 * Covers wipe up into view as they scroll in, a row's covers one after
 * another. Over the grid the pointer is a small dot that grows into an
 * arrow on a cover; the cover's top trims in and its colour comes up.
 */
export function WorkGrid({ items, empty }: { items: WorkItem[]; empty: string }) {
  const grid = useRef<HTMLUListElement>(null);
  const cursor = useRef<HTMLDivElement>(null);

  // Reveal each cover once, as it comes into view.
  useEffect(() => {
    const cards = grid.current?.querySelectorAll<HTMLElement>("[data-work-card]");
    if (!cards?.length) return;
    if (!("IntersectionObserver" in window)) {
      cards.forEach((c) => c.setAttribute("data-in", ""));
      return;
    }
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          seen.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    cards.forEach((c) => seen.observe(c));
    return () => seen.disconnect();
  }, [items.length]);

  // The dot pointer over the grid.
  useEffect(() => {
    const area = grid.current;
    const dot = cursor.current;
    if (!area || !dot || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const over = e.target instanceof Element && e.target.closest("[data-work-media]");
      dot.setAttribute("data-state", over ? "open" : "");
    };
    const enter = () => dot.setAttribute("data-on", "");
    const leave = () => dot.removeAttribute("data-on");
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerenter", enter);
    area.addEventListener("pointerleave", leave);
    return () => {
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerenter", enter);
      area.removeEventListener("pointerleave", leave);
    };
  }, []);

  if (!items.length) return <p className="text-ink-soft">{empty}</p>;

  return (
    <>
      <ul ref={grid} className="work-grid grid grid-cols-1 gap-x-3 gap-y-14 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-[76px] lg:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.key}>
            <Link href={item.href} data-work-card className="work-card group block" style={{ "--delay": `${(i % 3) * 120}ms` } as CSSProperties}>
              <div data-work-media className="work-media relative aspect-[3/4] overflow-hidden bg-panel">
                {item.media ? <Cover media={item.media} eager={i < 3} /> : null}
              </div>
              <h2 className="px-4 pt-[18px] text-[22px] sm:px-5 leading-[1.2] font-normal tracking-[-0.015em]">{item.title}</h2>
              {item.meta ? (
                <p className={cn(LABEL, "mt-2 px-4 text-[11px] sm:px-5 tracking-[0.06em] text-muted opacity-70 transition duration-300 group-hover:text-ink-soft group-hover:opacity-100")}>
                  {item.meta}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <div ref={cursor} aria-hidden data-state="" className="work-cursor">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </>
  );
}

/** A cover filling its frame, cropped to fit. Videos play silently on a loop. */
function Cover({ media, eager }: { media: PortfolioMedia; eager?: boolean }) {
  if (media.kind === "video") {
    return <video src={media.url} className="work-cover" autoPlay muted loop playsInline preload="metadata" aria-label={media.alt || undefined} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.url} alt={media.alt} loading={eager ? "eager" : "lazy"} decoding="async" className="work-cover" />;
}
