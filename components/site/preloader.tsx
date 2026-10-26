"use client";

import { useState, type CSSProperties } from "react";
import { GREETINGS } from "./greetings";

/**
 * The opening from amplifier.studio: on black, the greetings flash one after
 * another, twice round, then the cover fades and folds up over 2 seconds.
 * Same timing as the old site's GSAP version (1s wait, 0.2s per word, each
 * overlapping the next by 0.06s), done in CSS so it shows from the first
 * paint. Skipped for people who ask for reduced motion.
 */
const START = 1;
const WORD = 0.2;
const STEP = WORD - 0.06;

export function Preloader() {
  const [done, setDone] = useState(false);
  if (done) return null;

  const words = [...GREETINGS, ...GREETINGS];
  const exitAt = START + STEP * (words.length - 1) + WORD + 0.2;

  return (
    <div
      aria-hidden
      className="preloader"
      style={{ "--exit": `${exitAt}s`, background: "#000" } as CSSProperties}
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
  );
}
