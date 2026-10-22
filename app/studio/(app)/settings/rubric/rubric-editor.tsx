"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { MAX_DIMENSIONS } from "@/lib/library/constants";
import type { Dimension } from "@/lib/library/types";
import { Button, Input, Mono, cn } from "@/components/ui/primitives";
import { addAnchor, moveDimension, removeAnchor, rescoreStale, retireDimension, saveDimension } from "./actions";

export type RubricDimension = Dimension & { retired: boolean; corrections: number };
export type PickerImage = { id: string; thumbUrl: string; description: string; approved: boolean; scores: Record<string, number> };
type Anchor = { dimension: string; side: "left" | "right"; imageId: string; url: string };
type Side = "left" | "right";

const MAX_ANCHORS = 3;

export function RubricEditor({
  dimensions,
  anchors,
  images,
  stale,
  toCheck,
}: {
  dimensions: RubricDimension[];
  anchors: Anchor[];
  images: PickerImage[];
  stale: number;
  toCheck: number;
}) {
  const active = dimensions.filter((d) => !d.retired);
  const retired = dimensions.filter((d) => d.retired);
  const [adding, setAdding] = useState(false);
  const [picker, setPicker] = useState<{ dimension: RubricDimension; side: Side } | null>(null);
  const full = active.length >= MAX_DIMENSIONS;

  return (
    <div className="pt-8">
      <RescoreBar stale={stale} toCheck={toCheck} />

      <div className="mt-8 grid gap-x-10 gap-y-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="text-sm leading-relaxed text-muted">
          <p>
            Each dimension is a spectrum between two ends. Claude scores every library image on each one, and briefs use them
            to build the client&apos;s pairs.
          </p>
          <p className="mt-3">
            <span className="text-ink">Describe each end by what you can see</span>: elements, colour, line, texture. Feelings
            are harder to score consistently.
          </p>
          <p className="mt-3">
            <span className="text-ink">Anchors</span> are library images that show an end. Claude sees them every time it
            scores. Your corrections in the library teach it too.
          </p>
          <p className="mt-3">
            Up to {MAX_DIMENSIONS} dimensions. Each one adds two or three pairs to a client&apos;s brief.
          </p>
        </div>

        <div className="min-w-0">
          <ol className="flex flex-col">
            {active.map((d, i) => (
              <li key={d.key}>
                <DimensionCard
                  dimension={d}
                  index={i}
                  first={i === 0}
                  last={i === active.length - 1}
                  anchors={anchors.filter((a) => a.dimension === d.key)}
                  onPick={(side) => setPicker({ dimension: d, side })}
                />
              </li>
            ))}
          </ol>

          {adding ? (
            <DimensionCard index={active.length} onDone={() => setAdding(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-4 border-t border-ink pt-6">
              <Button onClick={() => setAdding(true)} disabled={full}>
                Add a dimension
              </Button>
              <Mono>
                {active.length} of {MAX_DIMENSIONS}
              </Mono>
              {full ? <span className="text-sm text-muted">Retire one to add another.</span> : null}
            </div>
          )}

          {retired.length ? <RetiredList dimensions={retired} full={full} /> : null}
        </div>
      </div>

      {picker ? (
        <AnchorPicker
          dimension={picker.dimension}
          side={picker.side}
          images={images}
          taken={new Set(anchors.filter((a) => a.dimension === picker.dimension.key).map((a) => a.imageId))}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- rescoring */

function RescoreBar({ stale, toCheck }: { stale: number; toCheck: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);

  async function run() {
    setRunning(true);
    setMessage(null);
    stop.current = false;
    let failed = 0;
    let left = stale;
    setRemaining(left);
    while (!stop.current && left > 0) {
      const r = await rescoreStale();
      if (!r.ok) {
        setMessage(r.error);
        break;
      }
      failed += r.failed;
      left = r.remaining;
      setRemaining(left);
    }
    setRunning(false);
    setRemaining(null);
    if (left === 0) setMessage(failed ? `Library rescored. ${failed} couldn't be scored; retry them from the library.` : "Library rescored.");
    router.refresh();
  }

  const count = remaining ?? stale;
  if (!count && !toCheck && !message) return null;

  return (
    <div className="flex flex-col gap-3">
      {count || running ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border border-ink px-4 py-3">
          <span aria-hidden className="size-2 shrink-0 bg-signal" />
          <p className="min-w-0 flex-1 text-[15px]" aria-live="polite">
            {running
              ? `Rescoring… ${count} ${count === 1 ? "image" : "images"} left. Keep this page open.`
              : `${count} ${count === 1 ? "image was" : "images were"} scored before your last change to the rubric.`}
          </p>
          {running ? (
            <Button size="sm" onClick={() => (stop.current = true)}>
              Stop
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={run}>
              Rescore now
            </Button>
          )}
        </div>
      ) : null}
      {message && !running ? <p className="text-sm text-ink-soft">{message}</p> : null}
      {toCheck ? (
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
          <span aria-hidden className="size-1.5 rounded-full bg-signal" />
          {toCheck} of your corrections were made before a definition changed.
          <Link href="/studio/library/browse?check=1" className="text-ink underline underline-offset-2">
            Check them
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ dimensions */

function DimensionCard({
  dimension,
  index,
  first,
  last,
  anchors = [],
  onPick,
  onDone,
}: {
  dimension?: RubricDimension;
  index: number;
  first?: boolean;
  last?: boolean;
  anchors?: Anchor[];
  onPick?: (side: Side) => void;
  onDone?: () => void;
}) {
  const saved = {
    left: dimension?.left ?? "",
    right: dimension?.right ?? "",
    leftDefinition: dimension?.leftDefinition ?? "",
    rightDefinition: dimension?.rightDefinition ?? "",
  };
  const [form, setForm] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isNew = !dimension;
  const dirty = isNew || (Object.keys(saved) as (keyof typeof saved)[]).some((k) => form[k].trim() !== saved[k]);

  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveDimension({ key: dimension?.key, ...form });
      if (!r.ok) return setError(r.error);
      onDone?.();
    });

  const act = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });

  return (
    <article className="border-t border-ink py-6" aria-label={isNew ? "New dimension" : `${saved.left} to ${saved.right}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Mono className="w-5">{index === 9 ? "0" : index + 1}</Mono>
        <h3 className="min-w-0 flex-1 text-lg font-medium">
          {isNew ? "New dimension" : `${saved.left} ↔ ${saved.right}`}
        </h3>
        {dimension ? (
          <>
            <Mono>
              {dimension.corrections} {dimension.corrections === 1 ? "correction" : "corrections"}
            </Mono>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" aria-label="Move up" disabled={first || pending} onClick={() => act(() => moveDimension(dimension.key, -1))}>
                ↑
              </Button>
              <Button size="sm" variant="ghost" aria-label="Move down" disabled={last || pending} onClick={() => act(() => moveDimension(dimension.key, 1))}>
                ↓
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => retireDimension(dimension.key, true))}>
                Retire
              </Button>
            </div>
          </>
        ) : null}
      </header>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {(["left", "right"] as const).map((side) => (
          <EndEditor
            key={side}
            side={side}
            name={side === "left" ? form.left : form.right}
            definition={side === "left" ? form.leftDefinition : form.rightDefinition}
            onName={set(side)}
            onDefinition={set(side === "left" ? "leftDefinition" : "rightDefinition")}
            anchors={anchors.filter((a) => a.side === side)}
            dimensionKey={dimension?.key}
            onPick={onPick ? () => onPick(side) : undefined}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {dirty ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : isNew ? "Add dimension" : "Save changes"}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => (isNew ? onDone?.() : setForm(saved))}>
            Cancel
          </Button>
          <span className="text-sm text-muted">
            {isNew
              ? "Every image gets a score on it when you rescore."
              : "Saving marks the library for rescoring. Corrections on this dimension get flagged to check."}
          </span>
        </div>
      ) : null}
    </article>
  );
}

function EndEditor({
  side,
  name,
  definition,
  onName,
  onDefinition,
  anchors,
  dimensionKey,
  onPick,
}: {
  side: Side;
  name: string;
  definition: string;
  onName: (v: string) => void;
  onDefinition: (v: string) => void;
  anchors: Anchor[];
  dimensionKey?: string;
  onPick?: () => void;
}) {
  const id = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const end = side === "left" ? "−2" : "+2";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={`${id}-name`} className="text-sm">
          {side === "left" ? "Left end" : "Right end"}
        </label>
        <Mono>{end}</Mono>
      </div>
      <Input id={`${id}-name`} value={name} maxLength={24} placeholder={side === "left" ? "e.g. Minimal" : "e.g. Rich"} onChange={(e) => onName(e.target.value)} />
      <label htmlFor={`${id}-definition`} className="sr-only">
        What you can see at the {side} end
      </label>
      <textarea
        id={`${id}-definition`}
        value={definition}
        maxLength={300}
        rows={3}
        placeholder={side === "left" ? "What you can see: few elements, generous empty space…" : "What you can see: many elements, layered, dense…"}
        onChange={(e) => onDefinition(e.target.value)}
        className="w-full resize-y border border-rule-strong bg-transparent px-3 py-2.5 text-[15px] leading-snug text-ink placeholder:text-muted focus:border-ink focus:outline-none"
      />

      <div>
        <Mono>Anchors</Mono>
        <ul className="mt-2 flex flex-wrap gap-2">
          {anchors.map((a) => (
            <li key={a.imageId} className="group relative size-16 bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove anchor"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await removeAnchor(dimensionKey!, a.imageId);
                    setError(r.ok ? null : r.error);
                  })
                }
                className="absolute top-0 right-0 flex size-6 items-center justify-center bg-ink text-paper opacity-90 hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
          {anchors.length < MAX_ANCHORS && onPick ? (
            <li>
              <button
                type="button"
                onClick={onPick}
                className="flex size-16 items-center justify-center border border-dashed border-rule-strong text-sm text-muted hover:border-ink hover:text-ink"
              >
                + Add
              </button>
            </li>
          ) : null}
          {!dimensionKey ? <li className="text-sm text-muted">Add anchors once the dimension is saved.</li> : null}
        </ul>
        {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  );
}

function RetiredList({ dimensions, full }: { dimensions: RubricDimension[]; full: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="mt-12">
      <Mono>Retired</Mono>
      <p className="mt-1 text-sm text-muted">Scores are kept, but retired dimensions aren&apos;t scored or used in briefs.</p>
      <ul className="mt-3 border-t border-rule">
        {dimensions.map((d) => (
          <li key={d.key} className="flex items-center gap-4 border-b border-rule py-2.5">
            <span className="min-w-0 flex-1 text-[15px] text-ink-soft">
              {d.left} ↔ {d.right}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending || full}
              onClick={() =>
                start(async () => {
                  const r = await retireDimension(d.key, false);
                  setError(r.ok ? null : r.error);
                })
              }
            >
              Restore
            </Button>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}

/* --------------------------------------------------------- anchor picker */

/** Library images, the strongest examples of this end first. */
function AnchorPicker({
  dimension,
  side,
  images,
  taken,
  onClose,
}: {
  dimension: RubricDimension;
  side: Side;
  images: PickerImage[];
  taken: Set<string>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const name = side === "left" ? dimension.left : dimension.right;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const sorted = useMemo(() => {
    const term = search.trim().toLowerCase();
    const direction = side === "left" ? 1 : -1;
    return images
      .filter((i) => !term || i.description.toLowerCase().includes(term))
      .sort((a, b) => direction * ((a.scores[dimension.key] ?? 0) - (b.scores[dimension.key] ?? 0)));
  }, [images, search, side, dimension.key]);

  const choose = (imageId: string) =>
    start(async () => {
      const r = await addAnchor(dimension.key, imageId, side);
      if (!r.ok) return setError(r.error);
      dialog.current?.close();
    });

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="picker-title"
      className="m-auto h-[min(760px,calc(100dvh-32px))] w-[min(960px,calc(100vw-32px))] border border-ink bg-paper p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-5 py-4">
          <h2 id="picker-title" className="min-w-0 flex-1 text-lg font-medium">
            Anchor for {name} <span className="font-mono text-sm text-muted">{side === "left" ? "−2" : "+2"}</span>
          </h2>
          <label htmlFor="picker-search" className="sr-only">
            Search descriptions
          </label>
          <input
            id="picker-search"
            type="search"
            placeholder="Search descriptions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56 max-w-full border border-rule-strong bg-transparent px-2.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <Button size="sm" variant="ghost" onClick={() => dialog.current?.close()}>
            Close
          </Button>
        </div>
        <p className="px-5 pt-3 text-sm text-muted">
          Sorted by Claude&apos;s current score, most {name.toLowerCase()} first. Pick images that show this end clearly.
        </p>
        {error ? <p className="px-5 pt-2 text-sm text-danger">{error}</p> : null}
        <ul className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(128px,1fr))] content-start gap-3 overflow-y-auto p-5">
          {sorted.map((image) => {
            const used = taken.has(image.id);
            const score = image.scores[dimension.key];
            return (
              <li key={image.id}>
                <button
                  type="button"
                  disabled={used || pending}
                  onClick={() => choose(image.id)}
                  title={image.description}
                  className={cn("block w-full text-left outline-offset-2 disabled:cursor-not-allowed", used && "opacity-35")}
                >
                  <span className="block aspect-square overflow-hidden bg-panel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </span>
                  <span className="mt-1 flex justify-between gap-2">
                    <Mono>{used ? "Anchor" : image.approved ? "" : "To review"}</Mono>
                    <Mono className="text-ink">{score === undefined ? "–" : score > 0 ? `+${score}` : score}</Mono>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
