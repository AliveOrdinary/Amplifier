"use client";

import { useEffect, useId, useState } from "react";
import type { ScoringProgress } from "@/lib/library/score-queue";
import { Mono, cn } from "@/components/ui/primitives";
import { useLibrary } from "./library-provider";

/**
 * Where scoring is up to, in plain terms: "Scoring 38 of 144", a bar, and
 * roughly how long is left. Anthropic's batches report nothing until a whole
 * batch is done, so the count moves in steps as batches come back, and the
 * time left is an estimate from how long this studio's batches usually take.
 * The steps behind it (waiting, packing, each batch) sit under "Details".
 */

const MINUTE = 60_000;
/** Without a history yet: Anthropic says most batches finish within the hour. */
const USUAL_MINUTES = 60;
/** Waiting images go out within a couple of minutes. */
const SEND_MINUTES = 2;
/** Packing a batch takes a minute or two; longer means it got stuck and will be retried. */
const PACKING_STUCK_MINUTES = 5;

function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function duration(ms: number) {
  const m = Math.max(0, Math.round(ms / MINUTE));
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Images in the batch queue, sent or not. */
export const queuedCount = (p: ScoringProgress) => p.waiting + (p.packing ?? 0) + p.batches.reduce((sum, b) => sum + b.count, 0);

/** The whole picture in one line: how many are back, and when the rest should be. */
export function summarize(p: ScoringProgress, now: number) {
  const left = queuedCount(p);
  const done = p.wave?.done ?? 0;
  const total = done + left;
  const usual = (p.typicalMinutes ?? USUAL_MINUTES) * MINUTE;

  // A batch out much longer than usual, or a pack that never went out.
  const late =
    p.batches.some((b) => now - Date.parse(b.sentAt) > Math.max(usual * 2, USUAL_MINUTES * MINUTE)) ||
    (p.packingSince !== null && p.packing > 0 && now - Date.parse(p.packingSince) > PACKING_STUCK_MINUTES * MINUTE);

  // When the last of them should be back: each batch from when it went out,
  // anything not sent yet from a couple of minutes from now.
  const expected = [
    ...p.batches.map((b) => Date.parse(b.sentAt) + usual),
    ...(p.waiting || p.packing ? [now + SEND_MINUTES * MINUTE + usual] : []),
  ];
  const remaining = expected.length ? Math.max(...expected) - now : 0;

  let eta: string;
  let short: string;
  if (late) {
    eta = "Taking longer than usual. They'll still come back on their own.";
    short = "taking longer than usual";
  } else if (p.typicalMinutes === null) {
    eta = "Usually done within the hour";
    short = "usually within the hour";
  } else if (remaining > MINUTE) {
    eta = `About ${duration(remaining)} left`;
    short = `about ${duration(remaining)} left`;
  } else {
    eta = "Any minute now";
    short = "any minute now";
  }
  return { done, total, left, late, eta, short, fraction: total ? done / total : 0 };
}

/**
 * For the Review screen when it's caught up, and its sidebar. `scoring` is
 * every image not scored yet, including single uploads, which are scored
 * straight away and only show under Details.
 */
export function ScoringSummary({ scoring, compact = false, className }: { scoring: number; compact?: boolean; className?: string }) {
  const { progress } = useLibrary();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const s = summarize(progress, now);
  const direct = Math.max(0, scoring - s.left);

  if (!s.left && !direct) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      {s.left ? (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <span className={compact ? "text-sm" : "text-[17px]"}>
              Scoring {s.done} of {s.total}
            </span>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => setOpen((o) => !o)}
              className="-my-2 min-h-11 shrink-0 font-mono text-[11px] tracking-[0.08em] text-muted uppercase hover:text-ink"
            >
              {open ? "Hide details" : "Details"}
            </button>
          </div>
          <div
            role="progressbar"
            aria-label="Images scored"
            aria-valuemin={0}
            aria-valuemax={s.total}
            aria-valuenow={s.done}
            className="mt-2 h-1 overflow-hidden rounded-full bg-rule"
          >
            <div
              className={cn("h-full rounded-full transition-[width] duration-700", s.late ? "bg-muted" : "bg-signal")}
              style={{ width: `${Math.max(2, Math.round(s.fraction * 100))}%` }}
            />
          </div>
          <p className={cn("mt-2 text-muted", compact ? "text-xs" : "text-sm")}>
            {s.eta}
            {s.late ? "" : " · you'll get a notice when it's done"}
          </p>
        </>
      ) : (
        <p className={compact ? "text-sm" : "text-[15px]"}>
          Scoring {plural(direct, "image", "images")} · a few seconds each
        </p>
      )}

      {s.left && open ? <ScoringSteps id={detailsId} direct={direct} compact={compact} now={now} /> : null}
    </div>
  );
}

/** The steps behind the summary, for the curious (and for working out what's stuck). */
function ScoringSteps({ id, direct, compact, now }: { id: string; direct: number; compact: boolean; now: number }) {
  const { progress } = useLibrary();
  const text = compact ? "text-xs" : "text-sm";
  const row = "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5";

  return (
    <ul id={id} className={cn("mt-4 flex flex-col gap-3 border-t border-rule pt-4", text)}>
      {progress.wave?.done ? (
        <li className={row}>
          <span>{plural(progress.wave.done, "image", "images")} scored</span>
          <Mono>Since {clock(progress.wave.since)}</Mono>
        </li>
      ) : null}
      {progress.batches.map((b) => (
        <li key={b.id} className={row}>
          <span>{plural(b.count, "image", "images")} with Claude</span>
          <Mono>
            Sent {clock(b.sentAt)} · {duration(now - Date.parse(b.sentAt))} ago
          </Mono>
        </li>
      ))}
      {progress.packing ? (
        <li className={row}>
          <span>{plural(progress.packing, "image", "images")} being packed into a batch</span>
          {progress.packingSince ? <Mono>Since {clock(progress.packingSince)}</Mono> : null}
        </li>
      ) : null}
      {progress.waiting ? (
        <li className={row}>
          <span>{plural(progress.waiting, "image", "images")} waiting to go out</span>
          {progress.waitingSince ? <Mono>Added {clock(progress.waitingSince)}</Mono> : null}
        </li>
      ) : null}
      {direct ? (
        <li className={row}>
          <span>{plural(direct, "image", "images")} being stored or scored one at a time</span>
        </li>
      ) : null}
      <li className="text-muted">
        Images go to Claude in batches of up to 100, at half the price of scoring them one by one. A batch comes back all at once,
        {progress.typicalMinutes ? ` usually in about ${duration(progress.typicalMinutes * MINUTE)} for this studio.` : " usually within the hour."}
      </li>
    </ul>
  );
}

/** One line for the library bar, on every tab, while scoring runs. */
export function ScoringChip() {
  const { progress } = useLibrary();
  const now = useNow();
  const s = summarize(progress, now);
  if (!s.left) return null;

  return (
    <span className="flex min-w-0 items-center gap-2" role="status">
      <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-signal" />
      <Mono className="truncate">
        Scoring {s.done} of {s.total} · {s.short}
      </Mono>
    </span>
  );
}
