"use client";

import { useState } from "react";
import { DIMENSIONS, MEDIA, type DimensionKey } from "@/lib/library/constants";
import type { LibraryImage } from "@/lib/library/types";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { useLibrary } from "./library-provider";

const STEPS = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];

export function signed(value: number) {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  return `${value > 0 ? "+" : "−"}${abs % 1 === 0 ? abs : abs.toFixed(1)}`;
}

/** The image, shown whole, fading in once loaded so switching doesn't flash. */
export function ImageStage({ image, className }: { image: LibraryImage; className?: string }) {
  return (
    <div className={cn("relative flex min-h-0 items-center justify-center overflow-hidden bg-panel", className)}>
      {image.thumbUrl ? (
        // The thumbnail fills in instantly while the full image loads.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.thumbUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-contain opacity-40 blur-xl" />
      ) : null}
      {image.displayUrl ? (
        <FadeImage key={image.id} src={image.displayUrl} alt={image.description ?? image.name ?? "Library image"} />
      ) : (
        <span className="relative text-sm text-muted">Processing…</span>
      )}
    </div>
  );
}

function FadeImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
      ref={(el) => {
        if (el?.complete && el.naturalWidth) setLoaded(true);
      }}
      className={cn(
        "relative max-h-full max-w-full object-contain transition-opacity duration-200",
        loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/** Medium, the eight scores, and a legend. */
export function ScorePanel({
  image,
  focusDim,
  onFocusDim,
}: {
  image: LibraryImage;
  focusDim: number;
  onFocusDim: (index: number) => void;
}) {
  const { setScore, setImageMedium } = useLibrary();

  return (
    <div className="flex flex-col">
      <label htmlFor={`medium-${image.id}`} className="text-[13px] text-muted">
        Medium
      </label>
      <select
        id={`medium-${image.id}`}
        value={image.medium ?? ""}
        onChange={(e) => setImageMedium(image, e.target.value)}
        className="mt-1.5 h-10 border border-rule-strong bg-paper px-2 text-[15px] text-ink focus:border-ink focus:outline-none"
      >
        {!image.medium ? <option value="">Choose…</option> : null}
        {MEDIA.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>

      <div className="mt-5 flex justify-between">
        <Mono>Scores</Mono>
        <Mono className="hidden lg:inline">1–8 pick · ← → adjust</Mono>
      </div>
      <div className="mt-2 border-t border-rule">
        {DIMENSIONS.map((d, i) => (
          <ScoreScale
            key={d.key}
            index={i}
            dimension={d}
            score={image.scores[d.key]}
            focused={focusDim === i}
            onPick={(value) => {
              onFocusDim(i);
              setScore(image, d.key as DimensionKey, value);
            }}
          />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-3 bg-signal" /> Claude
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-3 bg-ink" /> Your edit, kept on rescore
        </span>
      </p>
    </div>
  );
}

function ScoreScale({
  index,
  dimension,
  score,
  focused,
  onPick,
}: {
  index: number;
  dimension: (typeof DIMENSIONS)[number];
  score: LibraryImage["scores"][DimensionKey];
  focused: boolean;
  onPick: (value: number) => void;
}) {
  const value = score?.score ?? null;
  const human = score?.source === "human";
  const labelId = `scale-${dimension.key}`;

  return (
    <div
      className={cn(
        "grid h-11 grid-cols-[16px_72px_minmax(0,1fr)_88px] items-center gap-2.5 border-b border-rule px-1.5",
        focused && "bg-panel",
      )}
    >
      <Mono>{index + 1}</Mono>
      <span id={labelId} className="text-[13px]">
        {dimension.left}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-9 gap-[3px]">
        {STEPS.map((step) => {
          const on = value === step;
          const side = step < 0 ? dimension.left : step > 0 ? dimension.right : "Balanced";
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${signed(step)} ${side}`}
              tabIndex={on || (value === null && step === 0) ? 0 : -1}
              onClick={() => onPick(step)}
              className={cn(
                "h-[18px] border transition-colors",
                on
                  ? human
                    ? "border-ink bg-ink"
                    : "border-signal bg-signal"
                  : step === 0
                    ? "border-transparent bg-rule-strong/60 hover:bg-rule-strong"
                    : "border-transparent bg-rule/70 hover:bg-rule-strong",
              )}
            />
          );
        })}
      </div>
      <span className="text-right text-[13px]">{dimension.right}</span>
    </div>
  );
}

/** Rescore and delete, with a two-step delete. */
export function SecondaryActions({ image }: { image: LibraryImage }) {
  const { rescoreImage, removeImage } = useLibrary();
  const [busy, setBusy] = useState<null | "rescore" | "delete">(null);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={async () => {
          setBusy("rescore");
          await rescoreImage(image);
          setBusy(null);
        }}
      >
        {busy === "rescore" ? "Scoring…" : "Rescore"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        className={confirm ? "text-danger" : undefined}
        onBlur={() => setConfirm(false)}
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          setBusy("delete");
          await removeImage(image);
          setBusy(null);
          setConfirm(false);
        }}
      >
        {busy === "delete" ? "Deleting…" : confirm ? "Confirm delete" : "Delete"}
      </Button>
      {image.sourceUrl ? (
        <a
          href={image.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="px-3 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Source
        </a>
      ) : null}
    </div>
  );
}

/** Keyboard shortcuts shared by Review and Browse. Ignores typing in fields. */
export function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}
