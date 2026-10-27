"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { ProjectCard } from "@/lib/portfolio/types";
import { FADERS, FLAT_MIX, match, mixFor } from "@/lib/portfolio/channels";
import { setMix, useMix } from "@/lib/portfolio/mix-store";
import { cn } from "@/components/ui/primitives";
import type { HomeCopy } from "@/lib/i18n/home";

const label = "font-mono text-[12px] uppercase tracking-[0.08em]";

/** Every tile is the same rounded square (the second shape in Lumark's opening row). */
const TILE_RADIUS = "16%";

/**
 * Selected work as a mixing desk. Every featured project is a channel card;
 * the faders light up the cards that fit and solo the closest one.
 */
export function Desk({ projects, copy }: { projects: ProjectCard[]; copy: HomeCopy["desk"] }) {
  // Shared with the closing call, which lays the work out by the same mix.
  const mix = useMix();
  const touched = FADERS.some((f) => mix[f.key] !== 0);

  const channels = projects.map((p, i) => ({
    project: p,
    ch: String(i + 1).padStart(2, "0"),
    level: match(mix, mixFor(p.slug)),
  }));
  const solo = touched && channels.length ? channels.reduce((a, b) => (b.level > a.level ? b : a)) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className={cn(label, "flex flex-wrap justify-between gap-3 text-muted")}>
        <span>( {copy.channels.replace("{n}", String(channels.length).padStart(2, "0"))} )</span>
        <span aria-live="polite">
          ( {copy.solo} → <span className={solo ? "text-signal" : ""}>{solo ? solo.project.title : copy.none}</span> )
        </span>
      </div>

      {/* Fixed columns, so a tile is the same size however many projects there are. */}
      {channels.length ? (
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 sm:gap-x-5">
        {channels.map((t) => {
          const { project, level } = t;
          const isSolo = solo?.project.id === project.id;
          const dim = touched && !isSolo && level < 0.6;
          return (
            <li key={project.id} className={cn("tile transition-opacity duration-300", dim && "opacity-35")}>
              <Link href={`/projects/${project.slug}`} className="group block" aria-label={`${project.title}, ${project.services[0] ?? "project"}${project.year ? `, ${project.year}` : ""}`}>
                <span
                  className={cn("tile-shape relative block aspect-square overflow-hidden bg-panel", isSolo && "ring-2 ring-signal ring-offset-4 ring-offset-paper")}
                  style={{ borderRadius: TILE_RADIUS }}
                >
                  <Cover project={project} />
                </span>
                <span className={cn(label, "mt-3 flex justify-between gap-3 px-3 text-muted group-hover:text-ink sm:px-5")}>
                  <span className="truncate">
                    {project.title} <span className={isSolo ? "text-signal" : ""}>✺</span> {project.services[0] ?? ""}
                  </span>
                  <span className="shrink-0">{project.year ?? ""}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      ) : (
        <p className="rounded-[28px] border border-dashed border-rule-strong px-6 py-16 text-center text-ink-soft">{copy.empty}</p>
      )}

      <div className="mt-2 rounded-[28px] border border-rule-strong p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn(label, "text-muted")}>( {copy.mix} )</span>
          <button
            type="button"
            onClick={() => setMix(FLAT_MIX)}
            disabled={!touched}
            className={cn(label, "h-10 rounded-full bg-ink px-5 text-paper transition-opacity hover:opacity-85 disabled:opacity-30")}
          >
            {copy.reset}
          </button>
        </div>
        <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {FADERS.map(({ key }, i) => {
            const f = { key, ...copy.faders[key] };
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

/** The project's thumbnail, or its cover when it has none. */
function Cover({ project }: { project: ProjectCard }) {
  const c = project.thumbnail ?? project.cover;
  const cls = "block size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]";
  if (!c) return <span className={cn(cls, "bg-[radial-gradient(circle_at_30%_30%,#2a2926,#121211)]")} />;
  if (c.kind === "video")
    return <video src={c.url} className={cls} autoPlay muted loop playsInline preload="metadata" aria-label={c.alt || project.title} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={c.url} alt={c.alt || project.title} className={cls} decoding="async" />;
}
