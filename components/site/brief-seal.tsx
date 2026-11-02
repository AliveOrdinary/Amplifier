"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent } from "react";

/**
 * A link to a spot on this page (the closing call, #brief) glides there and
 * centres it, instead of jumping. Links to other pages go as usual.
 */
export function glide(e: MouseEvent<HTMLAnchorElement>, href: string) {
  const url = new URL(href, window.location.href);
  if (url.pathname !== window.location.pathname || !url.hash) return;
  const target = document.getElementById(url.hash.slice(1));
  if (!target) return;
  e.preventDefault();
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  history.replaceState(null, "", url.hash);
}

/**
 * "Start a brief": a spinning orange seal on every page of the site, held
 * at the bottom of the screen. Where a page marks a spot for it
 * (data-seal-dock, Home's closing call), the seal settles into that spot
 * as it scrolls up to meet it and travels with the page from there,
 * standing in for the button.
 */
export function BriefSeal({ label, href }: { label: string; href: string }) {
  const seal = useRef<HTMLAnchorElement>(null);

  // Re-place it on every page change too (client-side navigation keeps this component).
  const path = usePathname();

  useEffect(() => {
    const el = seal.current;
    if (!el) return;
    let frame = 0;
    let dx = 0;
    let dy = 0;

    const place = (x: number, y: number) => {
      dx = x;
      dy = y;
      el.style.setProperty("--dx", `${x}px`);
      el.style.setProperty("--dy", `${y}px`);
      el.toggleAttribute("data-docked", x !== 0 || y !== 0);
    };

    const draw = () => {
      frame = 0;
      const dock = document.querySelector<HTMLElement>("[data-seal-dock]");
      const d = dock?.getBoundingClientRect();
      // No spot on this page, or one that isn't laid out (hidden, still loading): stay at rest.
      if (!d || !d.width || !d.height) return place(0, 0);
      // Where the seal sits at rest, measured from where it is now, less its offset.
      const box = el.getBoundingClientRect();
      const restX = box.left + box.width / 2 - dx;
      const restY = box.top + box.height / 2 - dy;
      const dockX = d.left + d.width / 2;
      const dockY = d.top + d.height / 2;
      // Below the resting place: wait for it. At or above: ride along with it.
      if (dockY <= restY) place(dockX - restX, dockY - restY);
      else place(0, 0);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    place(0, 0);
    queue();
    // Images, fonts and tiles loading move the spot without any scrolling.
    const resized = new ResizeObserver(queue);
    resized.observe(document.body);
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    window.addEventListener("load", queue);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      window.removeEventListener("load", queue);
    };
  }, [path]);

  const ring = `${label} · ${label} · `.toUpperCase();

  return (
    <a ref={seal} href={href} onClick={(e) => glide(e, href)} className="brief-seal" aria-label={label}>
      <svg aria-hidden className="brief-seal-ring" viewBox="0 0 124 124">
        <defs>
          <path id="brief-seal-path" d="M62,62 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" />
        </defs>
        <text fontSize="12" fill="currentColor">
          <textPath href="#brief-seal-path" textLength="293" lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
      </svg>
      <svg aria-hidden className="brief-seal-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
