"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectCard } from "@/lib/portfolio/types";
import { DESK_SLOTS, FADERS, FLAT_MIX, match, mixFor, type Mix } from "@/lib/portfolio/channels";
import { cn } from "@/components/ui/primitives";

const SEGMENTS = 12;

/**
 * The mixing desk on Home. Every featured project is a channel; moving the
 * faders lights up the channels that fit, and the closest one is soloed.
 */
export function Desk({ projects }: { projects: ProjectCard[] }) {
  const [mix, setMix] = useState<Mix>(FLAT_MIX);
  const touched = FADERS.some((f) => mix[f.key] !== 0);

  const channels = projects.slice(0, DESK_SLOTS).map((p, i) => ({
    project: p,
    ch: String(i + 1).padStart(2, "0"),
    level: match(mix, mixFor(p.slug)),
  }));

  const solo = touched && channels.length ? channels.reduce((a, b) => (b.level > a.level ? b : a)) : null;
  const empty = Math.max(0, DESK_SLOTS - channels.length);

  return (
    <section id="work" aria-label="Work" className="desk border border-ink bg-desk p-3 sm:p-5">
      <div className="flex flex-wrap justify-between gap-3 pb-3.5 font-mono text-label uppercase tracking-[0.08em]">
        <span>Channels · {String(channels.length).padStart(2, "0")} in use</span>
        <span aria-live="polite">Solo → {solo ? solo.project.title : "—"}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {channels.map(({ project, ch, level }) => {
          const lit = Math.round(level * SEGMENTS);
          const isSolo = solo?.project.id === project.id;
          const dim = touched && !isSolo && level < 0.6;
          return (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className={cn(
                "group flex flex-col gap-3 border bg-paper p-3 transition-opacity duration-200",
                isSolo ? "border-signal" : "border-transparent",
                dim && "opacity-45",
              )}
            >
              <span className="flex items-center justify-between font-mono text-label uppercase tracking-[0.08em]">
                <span>CH {ch}</span>
                <span aria-hidden className={cn("size-2 rounded-full", isSolo ? "bg-signal" : level >= 0.6 ? "bg-ink" : "bg-rule-strong")} />
              </span>
              <Cover project={project} />
              <span className="flex flex-col gap-1">
                <span className="text-[22px] font-medium leading-[1.1] tracking-[-0.01em] group-hover:underline group-hover:underline-offset-4">
                  {project.title}
                </span>
                <span className="text-sm text-ink-soft">
                  {[project.services[0], project.year].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span aria-hidden className="grid grid-cols-12 gap-[3px]">
                {Array.from({ length: SEGMENTS }, (_, s) => (
                  <span
                    key={s}
                    className={cn(
                      "h-2.5 transition-colors duration-200",
                      s >= lit ? "bg-rule" : s >= SEGMENTS - 2 ? "bg-signal" : "bg-ink",
                    )}
                  />
                ))}
              </span>
              <span className="flex justify-between font-mono text-label uppercase tracking-[0.08em]">
                <span>Match {Math.round(level * 100)}%</span>
                <span>Open →</span>
              </span>
            </Link>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <div
            key={i}
            className="hidden min-h-[420px] items-center justify-center border border-dashed border-[#8d8a80] font-mono text-label uppercase tracking-[0.08em] text-muted lg:flex"
          >
            CH {String(channels.length + i + 1).padStart(2, "0")} · No signal yet
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-6 border-t border-ink pt-5">
        <div className="grid flex-[999_1_640px] grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {FADERS.map((f, i) => {
            const v = mix[f.key];
            const readout = v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
            return (
              <label key={f.key} className="flex flex-col gap-2">
                <span className="flex justify-between font-mono text-label uppercase tracking-[0.08em]">
                  <span>
                    {String(i + 1).padStart(2, "0")} · {f.name}
                  </span>
                  <span>{readout}</span>
                </span>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.5}
                  value={v}
                  onChange={(e) => setMix((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                  aria-label={`${f.left} to ${f.right}`}
                  className="fader"
                />
                <span className="flex justify-between text-sm text-ink-soft">
                  <span>{f.left}</span>
                  <span>{f.right}</span>
                </span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setMix(FLAT_MIX)}
          disabled={!touched}
          className="h-11 flex-none border border-ink px-[18px] font-mono text-xs uppercase tracking-[0.08em] hover:bg-paper disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </section>
  );
}

function Cover({ project }: { project: ProjectCard }) {
  const c = project.cover;
  const cls = "block aspect-[4/5] w-full bg-[#cfcbbf] object-cover";
  if (!c) return <span className={cls} />;
  if (c.kind === "video") return <video src={c.url} className={cls} autoPlay muted loop playsInline preload="metadata" aria-label={c.alt || project.title} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={c.url} alt={c.alt || project.title} className={cls} loading="eager" decoding="async" />;
}
