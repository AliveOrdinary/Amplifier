"use client";

import { useEffect, useRef } from "react";

/**
 * "Start a brief": a spinning orange seal on every page of the site, held
 * at the bottom of the screen. Where a page marks a spot for it
 * (data-seal-dock, Home's closing call), the seal settles into that spot
 * as it scrolls up to meet it and travels with the page from there,
 * standing in for the button.
 */
export function BriefSeal({ label, href }: { label: string; href: string }) {
  const seal = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = seal.current;
    if (!el) return;
    let frame = 0;

    const draw = () => {
      frame = 0;
      const dock = document.querySelector<HTMLElement>("[data-seal-dock]");
      if (!dock) {
        el.style.setProperty("--dx", "0px");
        el.style.setProperty("--dy", "0px");
        el.removeAttribute("data-docked");
        return;
      }
      // Where the seal rests (its centre, with no offset) and where the dock is.
      const size = el.offsetWidth;
      const gap = parseFloat(getComputedStyle(el).bottom) || 0;
      const restY = window.innerHeight - gap - size / 2;
      const restX = window.innerWidth / 2;
      const d = dock.getBoundingClientRect();
      const dockY = d.top + d.height / 2;
      const dockX = d.left + d.width / 2;
      // Below the resting place: wait for it. At or above: ride along with it.
      const docked = dockY <= restY;
      el.style.setProperty("--dx", docked ? `${dockX - restX}px` : "0px");
      el.style.setProperty("--dy", docked ? `${dockY - restY}px` : "0px");
      el.toggleAttribute("data-docked", docked);
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
  }, []);

  const ring = `${label} · ${label} · `.toUpperCase();

  return (
    <a ref={seal} href={href} className="brief-seal" aria-label={label}>
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
