"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { ProjectCard } from "@/lib/portfolio/types";
import { FADERS, FLAT_MIX, match, mixFor, type Mix } from "@/lib/portfolio/channels";
import { cn } from "@/components/ui/primitives";

const SEGMENTS = 16;
const label = "font-mono text-[12px] uppercase tracking-[0.08em]";

/**
 * Selected work as a mixing desk. Every featured project is a channel card;
 * the faders light up the cards that fit and solo the closest one.
 */
export function Desk({ projects }: { projects: ProjectCard[] }) {
  const [mix, setMix] = useState<Mix>(FLAT_MIX);
  const touched = FADERS.some((f) => mix[f.key] !== 0);

  const channels = projects.map((p, i) => ({
    project: p,
    ch: String(i + 1).padStart(2, "0"),
    level: match(mix, mixFor(p.slug)),
  }));
  const solo = touched && channels.length ? channels.reduce((a, b) => (b.level > a.level ? b : a)) : null;
  // Keep the grid even: an odd count leaves one open channel.
  const open = channels.length % 2 === 1 ? 1 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className={cn(label, "flex flex-wrap justify-between gap-3 text-muted")}>
        <span>( Channels ✺ {String(channels.length).padStart(2, "0")} in use )</span>
        <span aria-live="polite">
          ( Solo → <span className={solo ? "text-signal" : ""}>{solo ? solo.project.title : "none"}</span> )
        </span>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {channels.map(({ project, ch, level }, i) => {
          const isSolo = solo?.project.id === project.id;
          const dim = touched && !isSolo && level < 0.6;
          return (
            <li key={project.id} className={cn("channel", i % 2 ? "channel-right" : "channel-left")}>
              <Link
                href={`/projects/${project.slug}`}
                className={cn(
                  "group flex h-full flex-col rounded-[28px] border p-3 transition-[opacity,border-color] duration-300",
                  isSolo ? "border-signal" : "border-rule-strong hover:border-muted",
                  dim && "opacity-40",
                )}
              >
                <span className={cn(label, "flex items-center justify-between gap-4 px-3 pt-2 pb-4")}>
                  <span className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "size-2 rounded-full transition-colors",
                        isSolo ? "bg-signal shadow-[0_0_10px_var(--signal)]" : level >= 0.6 ? "bg-ink" : "bg-rule-strong",
                      )}
                    />
                    ( CH {ch} ✺ {project.services[0] ?? "Project"}
                  </span>
                  <span>{project.year ? `…${project.year} )` : ")"}</span>
                </span>

                <span className="relative block overflow-hidden rounded-[22px] bg-panel">
                  <Cover project={project} />
                  <span
                    aria-hidden
                    className="absolute right-4 bottom-4 grid size-14 place-items-center rounded-full bg-ink text-xl text-paper transition-transform duration-300 group-hover:rotate-45"
                  >
                    ↗
                  </span>
                </span>

                <span className="flex flex-col gap-3 px-3 pt-5 pb-2">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="text-[28px] leading-none font-medium tracking-[-0.02em]">{project.title}</span>
                    <span className={cn(label, "shrink-0 text-muted")}>Match {Math.round(level * 100)}%</span>
                  </span>
                  <span aria-hidden className="grid grid-cols-16 gap-[3px]">
                    {Array.from({ length: SEGMENTS }, (_, s) => (
                      <span
                        key={s}
                        className={cn(
                          "h-1.5 rounded-full transition-colors duration-300",
                          s >= Math.round(level * SEGMENTS) ? "bg-rule" : s >= SEGMENTS - 3 ? "bg-signal" : "bg-ink",
                        )}
                      />
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        {open ? (
          <li className="channel channel-right hidden min-h-[320px] place-items-center rounded-[28px] border border-dashed border-rule-strong md:grid">
            <span className={cn(label, "text-muted")}>( CH {String(channels.length + 1).padStart(2, "0")} ✺ No signal yet )</span>
          </li>
        ) : null}
      </ul>

      <div className="mt-2 rounded-[28px] border border-rule-strong p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn(label, "text-muted")}>( Mix to your taste )</span>
          <button
            type="button"
            onClick={() => setMix(FLAT_MIX)}
            disabled={!touched}
            className={cn(label, "h-10 rounded-full bg-ink px-5 text-paper transition-opacity hover:opacity-85 disabled:opacity-30")}
          >
            Reset
          </button>
        </div>
        <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {FADERS.map((f, i) => {
            const v = mix[f.key];
            const readout = v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
            return (
              <label key={f.key} className="flex flex-col gap-3">
                <span className={cn(label, "flex justify-between")}>
                  <span>
                    ( {String(i + 1).padStart(2, "0")} ✺ {f.name} )
                  </span>
                  <span className={v ? "text-signal" : "text-muted"}>{readout}</span>
                </span>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.5}
                  value={v}
                  onChange={(e) => setMix((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                  aria-label={`${f.name}: ${f.left} to ${f.right}`}
                  className="fader"
                  style={{ "--at": `${((v + 2) / 4) * 100}%` } as CSSProperties}
                />
                <span className="flex justify-between text-sm text-muted">
                  <span>{f.left}</span>
                  <span>{f.right}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Cover({ project }: { project: ProjectCard }) {
  const c = project.cover;
  const cls = "block aspect-[3/2] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]";
  if (!c) return <span className={cn(cls, "bg-[radial-gradient(circle_at_30%_30%,#2a2926,#121211)]")} />;
  if (c.kind === "video")
    return <video src={c.url} className={cls} autoPlay muted loop playsInline preload="metadata" aria-label={c.alt || project.title} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={c.url} alt={c.alt || project.title} className={cls} decoding="async" />;
}
