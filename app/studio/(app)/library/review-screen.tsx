"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { mediumLabel } from "@/lib/library/constants";
import type { LibraryImage } from "@/lib/library/types";
import { Mono, buttonClass, cn } from "@/components/ui/primitives";
import { useLibrary } from "./library-provider";
import { ImageStage, ScorePanel, SecondaryActions, hotkeyIndex, isTypingTarget } from "./editor";
import { AddControls } from "./library-chrome";

/**
 * Review queue: oldest first, so new arrivals join the end and never move
 * what you're looking at. Images reviewed this visit stay in the list,
 * dimmed, so you can step back to them.
 */
export function ReviewScreen() {
  const { images, counts, dimensions, jobs, decide, setScore } = useLibrary();

  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const queue = useMemo(
    () =>
      images
        .filter((i) => i.ready && (i.status === "pending" || reviewed.has(i.id)))
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [images, reviewed],
  );
  const scoring = Math.max(counts.scoring, images.filter((i) => !i.ready).length) + jobs.filter((j) => j.state === "uploading").length;
  const pending = queue.filter((i) => i.status === "pending");
  const hasLibrary = images.length > 0 || counts.approved > 0 || counts.scoring > 0;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Once nothing is pending, show the caught-up screen; Undo brings the image back.
  const current = pending.length ? (queue.find((i) => i.id === selectedId) ?? pending[0]) : null;
  const [focusDim, setFocusDim] = useState(0);

  // Warm the cache for the next image so it appears instantly.
  const nextPending = current ? pending[pending.findIndex((i) => i.id === current.id) + 1] : undefined;
  useEffect(() => {
    if (nextPending?.displayUrl) new Image().src = nextPending.displayUrl;
  }, [nextPending?.displayUrl]);

  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (current) listRef.current?.querySelector(`[data-id="${current.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const choose = (image: LibraryImage, status: "approved" | "rejected") => {
    const index = queue.findIndex((i) => i.id === image.id);
    const after = queue.slice(index + 1).find((i) => i.status === "pending");
    const before = queue.slice(0, index).find((i) => i.status === "pending");
    setReviewed((set) => new Set(set).add(image.id));
    setSelectedId((after ?? before ?? image).id);
    decide(image, status, () => setSelectedId(image.id));
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      if (!current) return;
      const index = queue.findIndex((i) => i.id === current.id);

      if (key === "j" || key === "ArrowDown") {
        event.preventDefault();
        const next = queue[Math.min(queue.length - 1, index + 1)];
        if (next) setSelectedId(next.id);
      } else if (key === "k" || key === "ArrowUp") {
        event.preventDefault();
        const prev = queue[Math.max(0, index - 1)];
        if (prev) setSelectedId(prev.id);
      } else if (hotkeyIndex(key) >= 0 && hotkeyIndex(key) < dimensions.length) {
        setFocusDim(hotkeyIndex(key));
      } else if ((key === "ArrowLeft" || key === "ArrowRight") && dimensions[focusDim]) {
        event.preventDefault();
        const dim = dimensions[focusDim].key;
        const now = current.scores[dim]?.score ?? 0;
        setScore(current, dim, now + (key === "ArrowRight" ? 0.5 : -0.5));
      } else if (key === "Enter" || key === "a") {
        if ((event.target as HTMLElement).closest("button, a")) return;
        event.preventDefault();
        if (current.status !== "approved") choose(current, "approved");
      } else if (key === "x") {
        if (current.status !== "rejected") choose(current, "rejected");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="flex w-full max-w-2xl flex-col items-center rounded-[28px] border border-dashed border-rule-strong px-6 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-medium">{hasLibrary ? "All caught up" : "Start your library"}</h2>
          <p className="mt-2 max-w-md text-[15px] text-ink-soft">
            {scoring
              ? `${scoring} ${scoring === 1 ? "image is" : "images are"} being scored. Images you add appear here; board imports go straight to the library unless one needs a look.`
              : hasLibrary
                ? "Nothing is waiting for review. Add more images below."
                : "Add reference images: Claude scores each one, then you check the scores here."}
          </p>
          <div className="mt-8 w-full">
            <AddControls large />
          </div>
          <Mono className="mt-4">Or drop images anywhere, or paste with ⌘V</Mono>
          {hasLibrary ? (
            <Link href="/studio/library/browse" className="mt-8 text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
              Browse the library
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const position = pending.findIndex((i) => i.id === current.id);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)_420px]">
      {/* Queue */}
      <aside className="flex min-h-0 flex-col border-rule max-lg:border-b lg:border-r">
        <div className="flex justify-between px-4 pt-3.5 pb-2.5">
          <Mono>To review</Mono>
          <Mono>{pending.length ? `${position >= 0 ? position + 1 : "–"} / ${pending.length}` : "Done"}</Mono>
        </div>
        <ul ref={listRef} className="flex min-h-0 flex-1 gap-1 overflow-auto max-lg:px-4 max-lg:pb-3 lg:flex-col lg:gap-0">
          {queue.map((image) => {
            const active = image.id === current.id;
            const done = image.status !== "pending";
            return (
              <li key={image.id} data-id={image.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(image.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 text-left lg:px-4 lg:py-2",
                    active ? "lg:bg-panel lg:shadow-[inset_3px_0_0_var(--signal)]" : "hover:bg-panel/60",
                  )}
                >
                  <span
                    className={cn(
                      "relative block size-14 shrink-0 overflow-hidden rounded-lg bg-panel lg:size-[52px]",
                      active && "max-lg:outline max-lg:outline-2 max-lg:outline-signal",
                      done && "opacity-40",
                    )}
                  >
                    {image.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    ) : null}
                  </span>
                  <span className={cn("hidden min-w-0 lg:block", done && "text-muted")}>
                    <span className="line-clamp-2 text-[13px] leading-snug">{image.description ?? image.name ?? "Untitled"}</span>
                    {done ? <Mono className="mt-0.5 block">{image.status}</Mono> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {scoring ? (
          <div className="border-t border-rule px-4 py-3 max-lg:hidden">
            <Mono>Being scored · {scoring}</Mono>
            <p className="mt-1 text-xs text-muted">Joins the end of the queue when ready. Board imports skip it unless flagged.</p>
          </div>
        ) : null}
      </aside>

      {/* Image */}
      <section aria-label="Image" className="flex min-h-0 flex-col p-4 lg:p-6">
        <ImageStage image={current} className="min-h-[320px] flex-1" />
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-3">
          <p className="min-w-0 flex-1 text-[15px] text-ink-soft">{current.description ?? current.name}</p>
          <Mono>{mediumLabel(current.medium)}</Mono>
          {current.width && current.height ? (
            <Mono>
              {current.width} × {current.height}
            </Mono>
          ) : null}
        </div>
        {current.scoreError ? <p className="mt-1 text-sm text-danger">Scoring failed: {current.scoreError}</p> : null}
        {current.reviewReason && !current.scoreError ? (
          <p className="mt-1 text-sm text-ink-soft">Flagged on import: {current.reviewReason}.</p>
        ) : null}
      </section>

      {/* Scores and decision */}
      <aside className="flex min-h-0 flex-col border-rule px-4 py-5 max-lg:border-t lg:overflow-y-auto lg:border-l lg:px-6">
        <ScorePanel image={current} focusDim={focusDim} onFocusDim={setFocusDim} />

        <div className="mt-6 flex flex-col gap-3 lg:mt-auto lg:pt-6">
          <div className="flex gap-2">
            {current.status === "approved" ? (
              <span className="flex h-12 flex-1 items-center justify-center rounded-full border border-rule-strong text-[15px] text-muted">
                Approved
              </span>
            ) : (
              <button type="button" onClick={() => choose(current, "approved")} className={buttonClass("primary", "md", "h-12 flex-1 text-[15px]")}>
                Approve <span className="font-mono text-xs opacity-70">↵</span>
              </button>
            )}
            {current.status === "rejected" ? (
              <span className="flex h-12 flex-1 items-center justify-center rounded-full border border-rule-strong text-[15px] text-muted">
                Rejected
              </span>
            ) : (
              <button type="button" onClick={() => choose(current, "rejected")} className={buttonClass("secondary", "md", "h-12 flex-1 text-[15px]")}>
                Reject <span className="font-mono text-xs opacity-70">X</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SecondaryActions image={current} />
            <Mono className="hidden lg:inline">J / K move · U undo</Mono>
          </div>
        </div>
      </aside>
    </div>
  );
}
