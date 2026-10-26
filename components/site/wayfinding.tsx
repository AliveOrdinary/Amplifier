"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/primitives";

const STEP = 31; // px between ticks

/**
 * The scale on the right edge (after ozgur.design): one tick per section,
 * the current one longer, pulsing and named, and the scale slides so the
 * current section sits in the middle. Hover shows every name; click jumps.
 * Shown from 1280px wide, where the page leaves a gutter for it.
 */
export function Wayfinding({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const update = () => {
      const line = window.innerHeight * 0.4;
      let current = 0;
      sections.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      // At the very bottom, the last section is current even if it's short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections.length - 1;
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  return (
    <nav aria-label="Sections" className="wayfinding fixed top-1/2 right-[clamp(0.75rem,1.6vw,1.5rem)] z-30 hidden h-[380px] w-[140px] -translate-y-1/2 xl:block">
      <span className="wayfinding-current" aria-hidden>
        {sections[active]?.label}
      </span>
      <ul
        className="wayfinding-list"
        style={{ transform: `translateY(${-(active * STEP + STEP / 2)}px)` }}
      >
        {sections.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={i === active ? "location" : undefined}
              className={cn("wayfinding-link", i === active && "is-active")}
            >
              <span className="wayfinding-label">{s.label}</span>
              <span className="wayfinding-tick" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
