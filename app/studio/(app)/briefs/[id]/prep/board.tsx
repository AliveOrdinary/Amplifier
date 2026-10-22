"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_TYPES } from "@/lib/library/constants";
import type { BoardImage } from "@/lib/brief/board";
import { boardSvg, boardZip, download, justifiedLayout } from "@/lib/brief/board-export";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { abandonUpload, addFromLink, finishUpload, prepareUpload } from "../../../library/actions";
import { addToBoard, boardCandidates, removeBoardItem, resetBoard, setBoardOrder, type PickerImage } from "./board-actions";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest("input, textarea, [contenteditable=true]"));

/** Upload one file to the library the same way the Library screen does. Returns its image id. */
async function uploadToLibrary(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error("Use JPEG, PNG, WebP, GIF or AVIF.");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const prepared = await prepareUpload({ name: file.name || "pasted.png", type: file.type, size: file.size, sha256 });
  if (!prepared.ok) throw new Error(prepared.error);
  if (prepared.status === "duplicate") return prepared.imageId;
  const upload = await createClient().storage.from("library").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
  if (upload.error) {
    await abandonUpload(prepared.imageId);
    throw new Error("Upload failed, try again.");
  }
  const finished = await finishUpload(prepared.imageId);
  if (!finished.ok) throw new Error(finished.error);
  return prepared.imageId;
}

export function Board({ boardId, initial, clientName }: { boardId: string; initial: BoardImage[]; clientName: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState<{ text: string; tone?: "error" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Lay the images out in rows that fill the width, like the export does.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const layout = useMemo(
    () => (width ? justifiedLayout(items, width, width < 640 ? 120 : 190, 8) : { placed: [], height: 0 }),
    [items, width],
  );

  const say = (text: string, tone?: "error") => setMessage({ text, tone });

  const saveOrder = (next: BoardImage[]) => {
    setItems(next);
    void setBoardOrder(
      boardId,
      next.map((i) => i.itemId),
    ).then((r) => !r.ok && say(r.error, "error"));
  };

  const move = (from: number, to: number, save = true) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    if (save) saveOrder(next);
    else setItems(next);
  };

  const remove = (item: BoardImage) => {
    setItems((list) => list.filter((i) => i.itemId !== item.itemId));
    void removeBoardItem(boardId, item.itemId).then((r) => !r.ok && say(r.error, "error"));
  };

  const add = async (imageIds: string[]) => {
    const r = await addToBoard(boardId, imageIds);
    if (!r.ok) return say(r.error, "error");
    setItems((list) => [...list, ...r.images]);
    return r.images.length;
  };

  /* --------------------------------------------- paste and drop to add */

  const addFiles = async (files: File[], links: string[] = []) => {
    const total = files.length + links.length;
    if (!total) return;
    setBusy(`Adding ${total} to the library and this board…`);
    const ids: string[] = [];
    const problems: string[] = [];
    for (const file of files) {
      try {
        ids.push(await uploadToLibrary(file));
      } catch (err) {
        problems.push(err instanceof Error ? err.message : "Couldn't add one image.");
      }
    }
    for (const link of links) {
      const r = await addFromLink(link);
      if (r.ok && r.image) ids.push(r.image.id);
      else if (!r.ok) problems.push(r.error);
    }
    const added = ids.length ? await add(ids) : 0;
    setBusy(null);
    if (problems.length) say(`${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} more)` : ""}`, "error");
    else say(`Added ${added ?? 0} to the board. New images also wait in Library › Review.`);
  };

  const addFilesRef = useRef(addFiles);
  useEffect(() => {
    addFilesRef.current = addFiles;
  });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      const text = e.clipboardData?.getData("text")?.trim() ?? "";
      const links = !files.length && /^https?:\/\/\S+$/.test(text) ? [text] : [];
      if (!files.length && !links.length) return;
      e.preventDefault();
      void addFilesRef.current(files, links);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  /* ------------------------------------------------------------ export */

  const exportable = () => items.map((i) => ({ url: i.url, width: i.width, height: i.height, description: i.description }));
  const name = `${clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-moodboard`;

  const copyLayers = async () => {
    setBusy("Preparing layers…");
    try {
      const svg = boardSvg(exportable());
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": svg.then((s) => new Blob([s], { type: "text/plain" })),
            "image/svg+xml": svg.then((s) => new Blob([s], { type: "image/svg+xml" })),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(await svg);
      }
      say("Copied. Paste into a Figma design file and each image arrives separately, in this layout. For FigJam or Claude Design, use Download images and drag the files in.");
    } catch {
      say("Couldn't copy the layers. Try Download images instead.", "error");
    }
    setBusy(null);
  };

  const downloadZip = async () => {
    setBusy("Zipping images…");
    try {
      download(await boardZip(exportable()), `${name}.zip`);
      say("Downloaded. Unzip, select all and drag them onto a FigJam or Claude Design canvas.");
    } catch {
      say("Couldn't make the zip. Try again in a moment.", "error");
    }
    setBusy(null);
  };

  const startOver = async () => {
    setConfirmReset(false);
    setBusy("Starting over…");
    const r = await resetBoard(boardId);
    setBusy(null);
    if (!r.ok) return say(r.error, "error");
    router.refresh();
  };

  return (
    <div
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return;
        e.preventDefault();
        void addFiles(files);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={copyLayers} disabled={Boolean(busy) || !items.length} title="Separate images in a Figma design file">
          Copy as layers
        </Button>
        <Button size="sm" onClick={downloadZip} disabled={Boolean(busy) || !items.length}>
          Download images
        </Button>
        <span className="mx-1 hidden h-5 w-px bg-rule-strong sm:block" />
        <Button size="sm" variant="ghost" onClick={() => setPicking(true)} disabled={Boolean(busy)}>
          Add from library
        </Button>
        {confirmReset ? (
          <>
            <span className="text-sm text-ink-soft">Replace the board with their picks and matches again?</span>
            <Button size="sm" onClick={startOver}>
              Start over
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)} disabled={Boolean(busy)}>
            Start over
          </Button>
        )}
        <Mono className="ml-auto">{items.length} images</Mono>
      </div>

      <p className={cn("mt-3 min-h-5 text-sm", message?.tone === "error" ? "text-danger" : "text-ink-soft")} aria-live="polite">
        {busy ?? message?.text ?? "Drag to reorder. Paste or drop images here (from FigJam, a site, your files) to add them to the library and this board."}
      </p>

      <div ref={box} className="relative mt-3" style={{ height: layout.height || 200 }}>
        {items.map((item, i) => {
          const p = layout.placed[i];
          if (!p) return null;
          return (
            <figure
              key={item.itemId}
              draggable
              onDragStart={(e) => {
                setDragging(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragging(null);
                saveOrder(items);
              }}
              onDragOver={(e) => {
                if (dragging === null) return;
                e.preventDefault();
                if (dragging !== i) {
                  move(dragging, i, false);
                  setDragging(i);
                }
              }}
              className={cn(
                "group absolute m-0 cursor-grab overflow-hidden bg-panel transition-[left,top,width,height] duration-200 active:cursor-grabbing",
                dragging === i && "opacity-50",
              )}
              style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumb ?? item.url}
                alt={item.description ?? ""}
                title={item.description ?? ""}
                draggable={false}
                className="h-full w-full object-cover"
              />
              <figcaption className="absolute bottom-1.5 left-1.5 bg-paper/90 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase">
                {item.tag}
              </figcaption>
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" aria-label="Move earlier" onClick={() => move(i, i - 1)} className="flex size-7 items-center justify-center bg-ink text-paper">
                  ←
                </button>
                <button type="button" aria-label="Move later" onClick={() => move(i, i + 1)} className="flex size-7 items-center justify-center bg-ink text-paper">
                  →
                </button>
                <button type="button" aria-label="Remove from board" onClick={() => remove(item)} className="flex size-7 items-center justify-center bg-ink text-paper">
                  ×
                </button>
              </div>
            </figure>
          );
        })}
        {!items.length ? (
          <p className="absolute inset-0 flex items-center justify-center border border-dashed border-rule-strong text-sm text-muted">
            The board is empty. Add from the library, or paste images here.
          </p>
        ) : null}
      </div>

      {picking ? (
        <LibraryPicker
          boardId={boardId}
          onAdd={async (ids) => {
            const added = await add(ids);
            if (added !== undefined) say(`Added ${added} from the library.`);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}

/** Library images to add, closest to the board first. */
function LibraryPicker({ boardId, onAdd, onClose }: { boardId: string; onAdd: (ids: string[]) => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [images, setImages] = useState<PickerImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    void boardCandidates(boardId).then((r) => (r.ok ? setImages(r.images) : setError(r.error)));
  }, [boardId]);

  const term = search.trim().toLowerCase();
  const visible = (images ?? []).filter((i) => !term || (i.description ?? "").toLowerCase().includes(term));

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="board-picker-title"
      className="m-auto h-[min(760px,calc(100dvh-32px))] w-[min(960px,calc(100vw-32px))] border border-ink bg-paper p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-5 py-4">
          <h2 id="board-picker-title" className="min-w-0 flex-1 text-lg font-medium">
            Add from the library
          </h2>
          <label htmlFor="board-picker-search" className="sr-only">
            Search descriptions
          </label>
          <input
            id="board-picker-search"
            type="search"
            placeholder="Search descriptions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56 max-w-full border border-rule-strong bg-transparent px-2.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <Button
            size="sm"
            variant="primary"
            disabled={!selected.length || adding}
            onClick={async () => {
              setAdding(true);
              await onAdd(selected);
              dialog.current?.close();
            }}
          >
            {adding ? "Adding…" : `Add ${selected.length || ""}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => dialog.current?.close()}>
            Close
          </Button>
        </div>
        <p className="px-5 pt-3 text-sm text-muted">Closest to the board first, then the rest of the approved library.</p>
        {error ? <p className="px-5 pt-2 text-sm text-danger">{error}</p> : null}
        <ul className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(128px,1fr))] content-start gap-3 overflow-y-auto p-5">
          {images === null ? <li className="text-sm text-muted">Loading…</li> : null}
          {visible.map((image) => {
            const on = selected.includes(image.id);
            return (
              <li key={image.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected((list) => (on ? list.filter((x) => x !== image.id) : [...list, image.id]))}
                  title={image.description ?? ""}
                  className={cn("block w-full outline-offset-2", on && "outline outline-2 outline-signal")}
                >
                  <span className="block aspect-square overflow-hidden bg-panel">
                    {image.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <Mono className="mt-1 block text-left">{on ? "Selected" : image.suggested ? "Close match" : " "}</Mono>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
