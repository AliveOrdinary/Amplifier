"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { MAX_PINS } from "@/lib/brief/types";
import { setPin } from "../actions";

type Thumb = { id: string; thumb: string | null; description: string | null };

export function PinsPanel({ briefId, locked, pins, library }: { briefId: string; locked: boolean; pins: Thumb[]; library: Thumb[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = (id: string, pinned: boolean) =>
    start(async () => {
      const r = await setPin(briefId, id, pinned);
      setError(r.ok ? null : r.error);
      if (r.ok) router.refresh();
    });

  return (
    <div>
      {pins.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
          {pins.map((p) => (
            <li key={p.id} className="relative">
              <span className="block aspect-square overflow-hidden bg-panel">
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb} alt={p.description ?? ""} className="h-full w-full object-cover" />
                ) : null}
              </span>
              {!locked ? (
                <button
                  type="button"
                  aria-label="Unpin"
                  disabled={pending}
                  onClick={() => toggle(p.id, false)}
                  className="absolute top-0 right-0 flex size-7 items-center justify-center bg-ink text-paper"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-ink-soft">No pins. The warm-up is drawn from the library.</p>
      )}
      {!locked ? (
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={() => setOpen(true)} disabled={pins.length >= MAX_PINS}>
            Pin images
          </Button>
          <Mono>
            {pins.length} of {MAX_PINS}
          </Mono>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {open ? (
        <PinPicker
          library={library}
          pinned={new Set(pins.map((p) => p.id))}
          full={pins.length >= MAX_PINS}
          pending={pending}
          onToggle={toggle}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function PinPicker({
  library,
  pinned,
  full,
  pending,
  onToggle,
  onClose,
}: {
  library: Thumb[];
  pinned: Set<string>;
  full: boolean;
  pending: boolean;
  onToggle: (id: string, pinned: boolean) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return library.filter((i) => !term || (i.description ?? "").toLowerCase().includes(term));
  }, [library, search]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="pin-title"
      className="m-auto h-[min(760px,calc(100dvh-32px))] w-[min(960px,calc(100vw-32px))] border border-ink bg-paper p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-5 py-4">
          <h2 id="pin-title" className="min-w-0 flex-1 text-lg font-medium">
            Pin images
          </h2>
          <label htmlFor="pin-search" className="sr-only">
            Search descriptions
          </label>
          <input
            id="pin-search"
            type="search"
            placeholder="Search descriptions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56 max-w-full border border-rule-strong bg-transparent px-2.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <Button size="sm" variant="ghost" onClick={() => dialog.current?.close()}>
            Done
          </Button>
        </div>
        <p className="px-5 pt-3 text-sm text-muted">Approved images only. To pin something new, add it to the library and approve it first.</p>
        <ul className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(128px,1fr))] content-start gap-3 overflow-y-auto p-5">
          {visible.map((image) => {
            const on = pinned.has(image.id);
            return (
              <li key={image.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={pending || (!on && full)}
                  onClick={() => onToggle(image.id, !on)}
                  title={image.description ?? ""}
                  className={cn("block w-full outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40", on && "outline outline-2 outline-signal")}
                >
                  <span className="block aspect-square overflow-hidden bg-panel">
                    {image.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <Mono className="mt-1 block text-left">{on ? "Pinned" : " "}</Mono>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
