"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, clampScore } from "@/lib/library/constants";
import type { Dimension, ImageStatus, LibraryImage } from "@/lib/library/types";
import {
  abandonUpload,
  addFromLink,
  deleteImage,
  embedMissing,
  finishUpload,
  pollImages,
  prepareUpload,
  rescore,
  saveScore,
  setMedium,
  setStatus,
  type AddResult,
} from "./actions";

export type Job = {
  key: string;
  name: string;
  state: "uploading" | "scoring" | "done" | "duplicate" | "error";
  message?: string;
};

type Notice = { id: number; message: string; tone?: "error"; action?: { label: string; run: () => void } };

type LibraryState = {
  images: LibraryImage[];
  /** The studio's active rubric, in order. */
  dimensions: Dimension[];
  jobs: Job[];
  notice: Notice | null;
  addFiles: (files: File[]) => void;
  addLink: (url: string) => void;
  clearJobs: () => void;
  decide: (image: LibraryImage, status: ImageStatus, onUndo?: () => void) => void;
  setScore: (image: LibraryImage, dim: string, value: number) => void;
  setImageMedium: (image: LibraryImage, medium: string) => void;
  rescoreImage: (image: LibraryImage) => Promise<void>;
  removeImage: (image: LibraryImage) => Promise<void>;
  notify: (message: string, options?: Omit<Notice, "id" | "message">) => void;
  dismissNotice: () => void;
  holdNotice: (hold: boolean) => void;
};

const LibraryContext = createContext<LibraryState | null>(null);

export function useLibrary() {
  const value = use(LibraryContext);
  if (!value) throw new Error("useLibrary must be used inside LibraryProvider");
  return value;
}

const newest = (list: LibraryImage[]) => list.reduce((max, i) => (i.createdAt > max ? i.createdAt : max), "1970-01-01T00:00:00Z");

export function LibraryProvider({
  initialImages,
  dimensions,
  children,
}: {
  initialImages: LibraryImage[];
  dimensions: Dimension[];
  children: ReactNode;
}) {
  const [images, setImages] = useState(initialImages);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);

  /* ------------------------------------------------------------ helpers */

  const upsert = useCallback((incoming: LibraryImage[]) => {
    if (!incoming.length) return;
    setImages((list) => {
      const byId = new Map(list.map((i) => [i.id, i]));
      for (const image of incoming) byId.set(image.id, { ...byId.get(image.id), ...image });
      return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    });
  }, []);

  const patch = useCallback((id: string, change: Partial<LibraryImage>) => {
    setImages((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }, []);

  // Notices with Undo stay 10s; any notice stays open while the pointer is on it.
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string, options?: Omit<Notice, "id" | "message">) => {
    clearTimeout(noticeTimer.current);
    setNotice({ id: Date.now(), message, ...options });
    noticeTimer.current = setTimeout(() => setNotice(null), options?.action ? 10_000 : 4000);
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const holdNotice = useCallback((hold: boolean) => {
    clearTimeout(noticeTimer.current);
    if (!hold) noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const updateJob = (key: string, change: Partial<Job>) =>
    setJobs((list) => list.map((j) => (j.key === key ? { ...j, ...change } : j)));

  /* ------------------------------------------------------------- adding */

  // Up to two additions at a time; workers drain the queue and stop.
  const queue = useRef<Array<() => Promise<void>>>([]);
  const running = useRef(0);
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

  const settle = useCallback(
    (key: string, result: AddResult) => {
      if (!result.ok) return updateJob(key, { state: "error", message: result.error });
      if (result.image) upsert([result.image]);
      if (result.status === "duplicate") return updateJob(key, { state: "duplicate", message: "Already in the library" });
      const notes = [result.nearDuplicate ? "Looks like one already in the library" : "", result.scored ? "" : "Scoring failed"]
        .filter(Boolean)
        .join(" · ");
      updateJob(key, { state: "done", message: notes || undefined });
    },
    [upsert],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      for (const file of files.filter((f) => f.type.startsWith("image/"))) {
        const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        setJobs((list) => [{ key, name: file.name, state: "uploading" } as Job, ...list].slice(0, 40));

        queue.current.push(async () => {
          if (!ACCEPTED_TYPES.includes(file.type)) {
            return updateJob(key, { state: "error", message: "Use JPEG, PNG, WebP, GIF or AVIF" });
          }
          if (file.size > MAX_UPLOAD_BYTES) return updateJob(key, { state: "error", message: "Larger than 25 MB" });

          const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
          const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
          const prepared = await prepareUpload({ name: file.name, type: file.type, size: file.size, sha256 });
          if (!prepared.ok) return updateJob(key, { state: "error", message: prepared.error });
          if (prepared.status === "duplicate") return updateJob(key, { state: "duplicate", message: "Already in the library" });

          const upload = await createClient()
            .storage.from("library")
            .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
          if (upload.error) {
            await abandonUpload(prepared.imageId);
            return updateJob(key, { state: "error", message: "Upload failed, try again" });
          }

          updateJob(key, { state: "scoring" });
          settle(key, await finishUpload(prepared.imageId));
        });
      }
      pump();
    },
    [pump, settle],
  );

  const addLink = useCallback(
    (url: string) => {
      const key = `link-${Math.random().toString(36).slice(2)}`;
      setJobs((list) => [{ key, name: url, state: "scoring" } as Job, ...list].slice(0, 40));
      queue.current.push(async () => settle(key, await addFromLink(url)));
      pump();
    },
    [pump, settle],
  );

  const clearJobs = useCallback(
    () => setJobs((list) => list.filter((j) => j.state === "uploading" || j.state === "scoring")),
    [],
  );

  /* ------------------------------------------- drop and paste, anywhere */

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
      addFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    const paste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        return addFiles(files);
      }
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && /^https?:\/\/\S+$/.test(text)) {
        e.preventDefault();
        addLink(text);
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
  }, [addFiles, addLink]);

  /* ---------------------------------- pick up additions from elsewhere */

  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const current = imagesRef.current;
      const pendingIds = current.filter((i) => !i.ready).map((i) => i.id);
      const result = await pollImages(newest(current), pendingIds);
      if (result.ok) upsert(result.images);
    };
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, [upsert]);

  // Quietly embed images that predate embeddings, a few at a time.
  useEffect(() => {
    let stopped = false;
    void (async () => {
      for (let round = 0; round < 50 && !stopped; round++) {
        const r = await embedMissing();
        if (!r.ok || r.remaining === 0) return;
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  /* ---------------------------------------------------------- reviewing */

  const decide = useCallback(
    (image: LibraryImage, status: ImageStatus, onUndo?: () => void) => {
      const previous = image.status;
      patch(image.id, { status });
      void setStatus(image.id, status).then((r) => {
        if (!r.ok) {
          patch(image.id, { status: previous });
          notify(r.error, { tone: "error" });
        }
      });
      const verb = { approved: "Approved", rejected: "Rejected", pending: "Moved back to review" }[status];
      notify(verb, {
        action: {
          label: "Undo",
          run: () => {
            patch(image.id, { status: previous });
            void setStatus(image.id, previous);
            setNotice(null);
            onUndo?.();
          },
        },
      });
    },
    [patch, notify],
  );

  const scoreTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const setScore = useCallback(
    (image: LibraryImage, dim: string, value: number) => {
      const score = clampScore(value);
      setImages((list) =>
        list.map((i) =>
          i.id === image.id ? { ...i, scores: { ...i.scores, [dim]: { score, source: "human", confidence: null, check: false } } } : i,
        ),
      );
      const key = `${image.id}:${dim}`;
      clearTimeout(scoreTimers.current.get(key));
      scoreTimers.current.set(
        key,
        setTimeout(async () => {
          const r = await saveScore(image.id, dim, score);
          if (!r.ok) notify(`Couldn't save that score: ${r.error}`, { tone: "error" });
        }, 400),
      );
    },
    [notify],
  );

  const setImageMedium = useCallback(
    (image: LibraryImage, medium: string) => {
      patch(image.id, { medium });
      void setMedium(image.id, medium).then((r) => !r.ok && notify(r.error, { tone: "error" }));
    },
    [patch, notify],
  );

  const rescoreImage = useCallback(
    async (image: LibraryImage) => {
      const r = await rescore(image.id);
      if (!r.ok) return notify(r.error, { tone: "error" });
      if (r.image) upsert([r.image]);
      notify("Rescored. Your edits were kept.");
    },
    [upsert, notify],
  );

  const removeImage = useCallback(
    async (image: LibraryImage) => {
      const r = await deleteImage(image.id);
      if (!r.ok) return notify(r.error, { tone: "error" });
      setImages((list) => list.filter((i) => i.id !== image.id));
      notify("Deleted");
    },
    [notify],
  );

  const value = useMemo<LibraryState>(
    () => ({
      images,
      dimensions,
      jobs,
      notice,
      addFiles,
      addLink,
      clearJobs,
      decide,
      setScore,
      setImageMedium,
      rescoreImage,
      removeImage,
      notify,
      dismissNotice,
      holdNotice,
    }),
    [images, dimensions, jobs, notice, addFiles, addLink, clearJobs, decide, setScore, setImageMedium, rescoreImage, removeImage, notify, dismissNotice, holdNotice],
  );

  return (
    <LibraryContext value={value}>
      {children}
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-paper/85">
          <div className="border-2 border-dashed border-ink px-10 py-8 text-xl">Drop to add to the library</div>
        </div>
      ) : null}
    </LibraryContext>
  );
}
