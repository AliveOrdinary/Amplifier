"use client";

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { cn } from "@/components/ui/primitives";

export type StorySection = { id: string; label: string; text: string };

/**
 * The case study's left column, after mubien.com: the sections' names
 * stacked, held on screen while the work scrolls past on the right. The
 * section you're looking at opens to show its text (the height first,
 * then the words fade in); the others close. A section starts where its
 * marker (`#{id}`) sits in the work column, once that passes the middle
 * of the screen. On phones every section stays open above the work.
 * Set in the nav menu's type: 15px, Light.
 */
export function CaseStory({ sections, link }: { sections: StorySection[]; link?: { href: string; label: string } | null }) {
  const [open, setOpen] = useState(0);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      frame = 0;
      const line = window.innerHeight / 2;
      let k = 0;
      sections.forEach((s, i) => {
        const mark = document.getElementById(s.id);
        if (mark && mark.getBoundingClientRect().top < line) k = i;
      });
      setOpen(k);
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
  }, [sections]);

  return (
    <ol className="case-story pb-8 lg:sticky lg:top-[72px] lg:self-start lg:pr-4 lg:pb-0">
      {sections.map((s, i) => (
        <li key={s.id} data-open={i === open ? "" : undefined} className="case-story-item mt-[22px] first:mt-0">
          <div className="case-story-name flex items-center gap-2.5 text-[15px] leading-none font-light">
            <span aria-hidden className="size-2 shrink-0 rounded-full border border-current" />
            {s.label}
          </div>
          <div className="case-story-text">
            <div className="overflow-hidden">
              <div className="pt-3.5 pb-1 pl-[18px] text-[15px] leading-[1.5] font-light text-ink-soft [&_:is(h1,h2,h3,h4)]:font-light [&_:is(h1,h2,h3,h4)]:text-ink [&_:is(h1,h2,h3,h4)+*]:mt-2 [&_a]:underline [&_p+p]:mt-3">
                <Markdown>{s.text}</Markdown>
              </div>
              {link && i === sections.length - 1 ? (
                <a href={link.href} target="_blank" rel="noreferrer" className={cn("mt-4 ml-[18px] inline-block text-[15px] font-light hover:text-muted")}>
                  {link.label} ↗
                </a>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
