"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_TYPES, DIMENSIONS, MEDIA, MAX_UPLOAD_BYTES, clampScore, mediumLabel, type DimensionKey } from "@/lib/library/constants";
import { Button, Input, Mono, cn } from "@/components/ui/primitives";
import {
  abandonUpload,
  addFromLink,
  deleteImage,
  finishUpload,
  prepareUpload,
  rescore,
  saveScore,
  setMedium,
  setStatus,
} from "./actions";

export type LibraryImage = {
  id: string;
  status: "pending" | "approved" | "rejected";
  medium: string | null;
  description: string | null;
  name: string | null;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  displayUrl: string | null;
  sourceUrl: string | null;
  scoreError: string | null;
  scored: boolean;
  scores: Partial<Record<DimensionKey, { score: number; source: "ai" | "human"; confidence: number | null }>>;
};

type Tab = "pending" | "approved" | "rejected" | "all";
type Job = {
  key: string;
  name: string;
  state: "queued" | "uploading" | "scoring" | "done" | "duplicate" | "error";
  message?: string;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "To review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function LibraryWorkspace({ images: initial }: { images: LibraryImage[] }) {
  // Local copy for instant edits; replaced whenever the server sends fresh data.
  const [images, setImages] = useState(initial);
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setImages(initial);
  }

  const [tab, setTab] = useState<Tab>("pending");
  const visible = useMemo(() => (tab === "all" ? images : images.filter((i) => i.status === tab)), [images, tab]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visible.find((i) => i.id === selectedId) ?? visible[0] ?? null;
  const [focusDim, setFocusDim] = useState(0);

  const { jobs, addFiles, addLink } = useUploads();

  /* ------------------------------------------------------------ editing */

  const patch = useCallback((id: string, change: Partial<LibraryImage>) => {
    setImages((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }, []);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nudge = useCallback(
    (image: LibraryImage, dim: DimensionKey, value: number) => {
      const score = clampScore(value);
      patch(image.id, {
        scores: { ...image.scores, [dim]: { score, source: "human", confidence: null } },
      });
      const timerKey = `${image.id}:${dim}`;
      clearTimeout(timers.current.get(timerKey));
      timers.current.set(
        timerKey,
        setTimeout(() => void saveScore(image.id, dim, score), 400),
      );
    },
    [patch],
  );

  const moveSelection = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const index = selected ? visible.findIndex((i) => i.id === selected.id) : -1;
      const next = visible[Math.max(0, Math.min(visible.length - 1, index + delta))];
      setSelectedId(next.id);
      document.getElementById(`row-${next.id}`)?.scrollIntoView({ block: "nearest" });
    },
    [visible, selected],
  );

  const [, startTransition] = useTransition();
  const decide = useCallback(
    (image: LibraryImage, status: "approved" | "rejected" | "pending") => {
      const index = visible.findIndex((i) => i.id === image.id);
      const leaves = tab !== "all" && tab !== status;
      if (leaves) {
        const next = visible[index + 1] ?? visible[index - 1] ?? null;
        setSelectedId(next?.id ?? null);
      }
      patch(image.id, { status });
      startTransition(() => void setStatus(image.id, status));
    },
    [visible, tab, patch],
  );

  /* ----------------------------------------------------------- keyboard */

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;

      if (key === "j" || key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
      } else if (key === "k" || key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
      } else if (/^[1-8]$/.test(key)) {
        setFocusDim(Number(key) - 1);
      } else if ((key === "ArrowLeft" || key === "ArrowRight") && selected) {
        event.preventDefault();
        const dim = DIMENSIONS[focusDim].key;
        const current = selected.scores[dim]?.score ?? 0;
        nudge(selected, dim, current + (key === "ArrowRight" ? 0.5 : -0.5));
      } else if ((key === "Enter" || key === "a") && selected) {
        event.preventDefault();
        decide(selected, "approved");
      } else if (key === "x" && selected) {
        decide(selected, "rejected");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveSelection, selected, focusDim, nudge, decide]);

  /* ------------------------------------------------------------- render */

  const counts = useMemo(
    () => ({
      pending: images.filter((i) => i.status === "pending").length,
      approved: images.filter((i) => i.status === "approved").length,
      rejected: images.filter((i) => i.status === "rejected").length,
      all: images.length,
    }),
    [images],
  );

  return (
    <div className="flex flex-col gap-6">
      <AddBar onFiles={addFiles} onLink={addLink} jobs={jobs} />

      <div role="tablist" aria-label="Filter images" className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "h-9 border px-3.5 text-sm",
              tab === t.key ? "border-ink bg-ink text-paper" : "border-rule text-ink hover:border-ink",
            )}
          >
            {t.label} · {counts[t.key]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="border border-dashed border-rule-strong p-8 text-[15px] text-ink-soft">
          {images.length === 0
            ? "No images yet. Upload, drop or paste some above."
            : tab === "pending"
              ? "Nothing left to review."
              : "No images here."}
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-8">
          <ul className="min-w-0 flex-[999_1_480px] border-t border-rule" aria-label="Images">
            {visible.map((image) => (
              <ImageRow
                key={image.id}
                image={image}
                selected={selected?.id === image.id}
                onSelect={() => setSelectedId(image.id)}
              />
            ))}
          </ul>
          {selected ? (
            <Detail
              key={selected.id}
              image={selected}
              focusDim={focusDim}
              onFocusDim={setFocusDim}
              onScore={(dim, value) => nudge(selected, dim, value)}
              onDecide={(status) => decide(selected, status)}
              onMedium={(medium) => {
                patch(selected.id, { medium });
                void setMedium(selected.id, medium);
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ================================================================ Adding */

function useUploads() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const update = (key: string, change: Partial<Job>) =>
    setJobs((list) => list.map((j) => (j.key === key ? { ...j, ...change } : j)));

  const queue = useRef<Array<() => Promise<void>>>([]);
  const running = useRef(0);
  /** Up to two uploads at a time; workers drain the queue and stop. */
  const pump = useCallback(() => {
    while (running.current < 2 && queue.current.length > 0) {
      running.current += 1;
      void (async () => {
        let task = queue.current.shift();
        while (task) {
          await task().catch(() => undefined);
          task = queue.current.shift();
        }
        running.current -= 1;
      })();
    }
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter((f) => f.type.startsWith("image/"));
      for (const file of accepted) {
        const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        setJobs((list) => [{ key, name: file.name, state: "queued" } as Job, ...list].slice(0, 30));

        queue.current.push(async () => {
          if (!ACCEPTED_TYPES.includes(file.type)) {
            return update(key, { state: "error", message: "Use JPEG, PNG, WebP, GIF or AVIF." });
          }
          if (file.size > MAX_UPLOAD_BYTES) return update(key, { state: "error", message: "Larger than 25 MB." });

          update(key, { state: "uploading" });
          const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
          const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

          const prepared = await prepareUpload({ name: file.name, type: file.type, size: file.size, sha256 });
          if (!prepared.ok) return update(key, { state: "error", message: prepared.error });
          if (prepared.status === "duplicate") return update(key, { state: "duplicate", message: "Already in the library." });

          const upload = await createClient()
            .storage.from("library")
            .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
          if (upload.error) {
            await abandonUpload(prepared.imageId);
            return update(key, { state: "error", message: "Upload failed. Try again." });
          }

          update(key, { state: "scoring" });
          const finished = await finishUpload(prepared.imageId);
          if (!finished.ok) return update(key, { state: "error", message: finished.error });
          update(key, finishedMessage(finished));
        });
      }
      pump();
    },
    [pump],
  );

  const addLink = useCallback(
    (url: string) => {
      const key = `link-${Math.random().toString(36).slice(2)}`;
      setJobs((list) => [{ key, name: url, state: "queued" } as Job, ...list].slice(0, 30));
      queue.current.push(async () => {
        update(key, { state: "scoring" });
        const result = await addFromLink(url);
        if (!result.ok) return update(key, { state: "error", message: result.error });
        update(key, finishedMessage(result));
      });
      pump();
    },
    [pump],
  );

  return { jobs, addFiles, addLink };
}

function finishedMessage(result: { status: "duplicate" } | { status: "added"; nearDuplicates: string[]; scored: boolean }): Partial<Job> {
  if (result.status === "duplicate") return { state: "duplicate", message: "Already in the library." };
  const notes = [
    result.nearDuplicates.length ? "Looks like an image already in the library." : "",
    result.scored ? "" : "Scoring failed; use Rescore.",
  ].filter(Boolean);
  return { state: "done", message: notes.join(" ") || undefined };
}

function AddBar({ onFiles, onLink, jobs }: { onFiles: (files: File[]) => void; onLink: (url: string) => void; jobs: Job[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      onFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    const paste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        onFiles(files);
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && /^https?:\/\/\S+$/.test(text)) {
        e.preventDefault();
        onLink(text);
      }
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, [onFiles, onLink]);

  const active = jobs.filter((j) => j.state === "queued" || j.state === "uploading" || j.state === "scoring").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => input.current?.click()}>
          Upload images
        </Button>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          hidden
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <form
          className="flex min-w-[260px] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!link.trim()) return;
            onLink(link.trim());
            setLink("");
          }}
        >
          <label htmlFor="add-link" className="sr-only">
            Image or page link
          </label>
          <Input
            id="add-link"
            type="url"
            inputMode="url"
            placeholder="Paste an image or Pinterest link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Button type="submit">Add</Button>
        </form>
      </div>
      <p className="text-sm text-muted">Or drop images anywhere on this page, or paste them with ⌘V.</p>

      {jobs.length ? (
        <div className="border border-rule">
          <div className="flex items-center justify-between border-b border-rule px-3 py-2">
            <Mono>{active ? `Adding ${active}` : "Recent additions"}</Mono>
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {jobs.map((job) => (
              <li key={job.key} className="flex items-baseline gap-3 border-b border-rule px-3 py-2 text-sm last:border-b-0">
                <span className="w-24 shrink-0">
                  <Mono className={job.state === "error" ? "text-danger" : job.state === "done" ? "text-ink" : undefined}>
                    {
                      {
                        queued: "Waiting",
                        uploading: "Uploading",
                        scoring: "Scoring",
                        done: "Added",
                        duplicate: "Skipped",
                        error: "Failed",
                      }[job.state]
                    }
                  </Mono>
                </span>
                <span className="min-w-0 flex-1 truncate">{job.name}</span>
                {job.message ? <span className="text-muted">{job.message}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-paper/85">
          <div className="border-2 border-dashed border-ink px-10 py-8 text-xl">Drop to add to the library</div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================== Reviewing */

function ImageRow({ image, selected, onSelect }: { image: LibraryImage; selected: boolean; onSelect: () => void }) {
  return (
    <li id={`row-${image.id}`} className="border-b border-rule">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "grid w-full grid-cols-[72px_minmax(0,1fr)] gap-4 px-3 py-2.5 text-left lg:grid-cols-[72px_minmax(0,1fr)_auto]",
          selected ? "bg-panel shadow-[inset_3px_0_0_var(--ink)]" : "hover:bg-panel/60",
        )}
      >
        <span className="block h-14 w-[72px] overflow-hidden bg-panel">
          {image.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-[15px]">
            {image.description ?? image.name ?? "Untitled"}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3">
            <Mono>{mediumLabel(image.medium)}</Mono>
            {image.scoreError ? <Mono className="text-danger">Not scored</Mono> : null}
            {image.status !== "pending" ? <Mono>{image.status}</Mono> : null}
          </span>
        </span>
        <span className="hidden grid-cols-8 gap-1 self-center lg:grid" aria-hidden>
          {DIMENSIONS.map((d) => {
            const s = image.scores[d.key];
            return (
              <span
                key={d.key}
                title={`${d.left}–${d.right}`}
                className={cn(
                  "w-9 border py-0.5 text-center font-mono text-xs",
                  s?.source === "human" ? "border-ink" : "border-transparent",
                )}
              >
                {s ? signed(s.score) : "·"}
              </span>
            );
          })}
        </span>
      </button>
    </li>
  );
}

function Detail({
  image,
  focusDim,
  onFocusDim,
  onScore,
  onDecide,
  onMedium,
}: {
  image: LibraryImage;
  focusDim: number;
  onFocusDim: (i: number) => void;
  onScore: (dim: DimensionKey, value: number) => void;
  onDecide: (status: "approved" | "rejected" | "pending") => void;
  onMedium: (medium: string) => void;
}) {
  const [busy, setBusy] = useState<null | "rescore" | "delete">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <aside
      aria-label="Selected image"
      className="flex-[1_1_380px] max-w-[520px] lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto"
    >
      <div className="flex max-h-[420px] items-center justify-center bg-panel">
        {image.displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.displayUrl} alt={image.description ?? ""} className="max-h-[420px] w-auto max-w-full object-contain" />
        ) : (
          <span className="p-16 text-sm text-muted">Processing…</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {image.width && image.height ? <Mono>{image.width} × {image.height}</Mono> : null}
        {image.sourceUrl ? (
          <a href={image.sourceUrl} target="_blank" rel="noreferrer noopener" className="font-mono text-label uppercase tracking-[0.08em] text-muted underline hover:text-ink">
            Source
          </a>
        ) : null}
        <Mono>{image.status === "pending" ? "To review" : image.status}</Mono>
      </div>
      {image.description ? <p className="mt-2 text-[15px] text-ink-soft">{image.description}</p> : null}
      {image.scoreError ? <p className="mt-2 text-sm text-danger">{image.scoreError}</p> : null}

      <div className="mt-5 flex flex-col gap-2">
        <label htmlFor="medium" className="text-sm">
          Medium
        </label>
        <select
          id="medium"
          value={image.medium ?? ""}
          onChange={(e) => onMedium(e.target.value)}
          className="h-10 border border-rule-strong bg-paper px-2 text-[15px] text-ink"
        >
          {!image.medium ? <option value="">Choose…</option> : null}
          {MEDIA.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="mt-5 border-t border-rule">
        <legend className="sr-only">Dimension scores</legend>
        {DIMENSIONS.map((d, i) => {
          const s = image.scores[d.key];
          const value = s?.score ?? 0;
          return (
            <div
              key={d.key}
              className={cn(
                "grid grid-cols-[20px_76px_minmax(0,1fr)_88px_36px] items-center gap-2 border-b border-rule py-2",
                focusDim === i && "bg-panel",
              )}
            >
              <Mono>{i + 1}</Mono>
              <label htmlFor={`dim-${d.key}`} className="text-sm">
                {d.left}
              </label>
              <input
                id={`dim-${d.key}`}
                type="range"
                min={-2}
                max={2}
                step={0.5}
                value={value}
                onFocus={() => onFocusDim(i)}
                onChange={(e) => onScore(d.key, Number(e.target.value))}
                aria-valuetext={`${signed(value)}, ${value < 0 ? d.left : value > 0 ? d.right : "balanced"}`}
                className="w-full accent-[var(--signal)]"
              />
              <span className="text-right text-sm">{d.right}</span>
              <span className="text-right font-mono text-xs" title={s?.source === "human" ? "Edited" : "Claude's score"}>
                {signed(value)}
                {s?.source === "human" ? "*" : ""}
              </span>
            </div>
          );
        })}
      </fieldset>
      <p className="mt-2 text-xs text-muted">* edited by you, kept when rescoring.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {image.status !== "approved" ? (
          <Button variant="primary" onClick={() => onDecide("approved")}>
            Approve
          </Button>
        ) : (
          <Button onClick={() => onDecide("pending")}>Back to review</Button>
        )}
        {image.status !== "rejected" ? <Button onClick={() => onDecide("rejected")}>Reject</Button> : null}
        <Button
          variant="ghost"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("rescore");
            setError(null);
            const result = await rescore(image.id);
            if (!result.ok) setError(result.error);
            setBusy(null);
          }}
        >
          {busy === "rescore" ? "Scoring…" : "Rescore"}
        </Button>
        <Button
          variant="ghost"
          className={confirmDelete ? "text-danger" : undefined}
          disabled={busy !== null}
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            setBusy("delete");
            const result = await deleteImage(image.id);
            if (!result.ok) {
              setError(result.error);
              setBusy(null);
            }
          }}
          onBlur={() => setConfirmDelete(false)}
        >
          {busy === "delete" ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete"}
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}

function signed(value: number) {
  if (value === 0) return "0";
  const text = Math.abs(value) % 1 === 0 ? String(Math.abs(value)) : Math.abs(value).toFixed(1);
  return `${value > 0 ? "+" : "−"}${text}`;
}
