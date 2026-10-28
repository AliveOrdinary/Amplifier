"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { GREETINGS } from "./greetings";

/**
 * The opening from amplifier.studio: on black, the greetings flash one after
 * another, twice round, then the black fades away. Done in CSS so it shows
 * from the first paint. Skipped for people who ask for reduced motion.
 *
 * Once per visit: coming back to Home, switching EN/FR or reloading in the
 * same tab skips it (sessionStorage). The inline script hides it before the
 * first paint on a reload; on a page change inside the site, the layout
 * effect removes it before it's drawn.
 */
const START = 1;
const WORD = 0.2;
const STEP = WORD - 0.06;
const KEY = "amp-greeted";

/** Runs while the HTML is read, before anything is drawn. */
const HIDE_IF_GREETED = `try{if(sessionStorage.getItem("${KEY}"))document.documentElement.dataset.greeted=""}catch(e){}`;

export function Preloader() {
  const [done, setDone] = useState(false);
  const cover = useRef<HTMLDivElement>(null);
  const decided = useRef(false);

  useLayoutEffect(() => {
    // StrictMode runs this twice with the same refs: decide once.
    if (decided.current) return;
    decided.current = true;
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Private mode or blocked storage: show it, as on a first visit.
    }
    if (seen && cover.current) cover.current.style.display = "none";
  }, []);

  if (done) return null;

  const words = [...GREETINGS, ...GREETINGS];
  const exitAt = START + STEP * (words.length - 1) + WORD + 0.2;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HIDE_IF_GREETED }} />
      <div
        ref={cover}
        aria-hidden
        className="preloader"
        style={{ "--exit": `${exitAt}s` } as CSSProperties}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setDone(true);
        }}
      >
        {words.map((w, i) => (
          <span key={i} className="preloader-word" style={{ animationDelay: `${START + i * STEP}s`, opacity: 0 }}>
            {w}
          </span>
        ))}
      </div>
    </>
  );
}
