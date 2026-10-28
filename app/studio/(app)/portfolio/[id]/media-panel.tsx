"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { EditorProject, StudioMedia } from "@/lib/portfolio/studio";
import type { StoredBlock } from "@/lib/portfolio/types";
import { IMAGE_TYPES, VIDEO_TYPES } from "@/lib/portfolio/blocks";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { deleteMedia, setCover, setThumbnail, updateMedia } from "../actions";
import { fileSize as size, uploadFile } from "../upload";

const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

/** An image or a still of a video, letterboxed on the panel colour. */
export function Thumb({ media, className }: { media: StudioMedia; className?: string }) {
  return media.kind === "video" ? (
    <video
      src={`${media.url}#t=0.5`}
      muted
      playsInline
      preload="metadata"
      className={cn("block h-32 w-full rounded-xl bg-panel object-contain", className)}
      aria-label={media.alt || "Video"}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt={media.alt} loading="lazy" className={cn("block h-32 w-full rounded-xl bg-panel object-contain", className)} />
  );
}

type Upload = { name: string; state: "waiting" | "uploading" | "done" | "failed"; error?: string };

export function MediaPanel({ project, blocks }: { project: EditorProject; blocks: StoredBlock[] }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = uploads.some((u) => u.state === "waiting" || u.state === "uploading");

  const used = new Set(blocks.flatMap((b) => (b.type === "media" ? b.media : [])));

  async function upload(files: File[]) {
    if (!files.length) return;
    setUploads(files.map((f) => ({ name: f.name, state: "waiting" })));
    const mark = (i: number, change: Partial<Upload>) => setUploads((list) => list.map((u, j) => (j === i ? { ...u, ...change } : u)));

    // One at a time: large videos upload more reliably, and the order is kept.
    for (const [i, file] of files.entries()) {
      mark(i, { state: "uploading" });
      try {
        await uploadFile(project.id, file);
        mark(i, { state: "done" });
      } catch (error) {
        mark(i, { state: "failed", error: error instanceof Error ? error.message : "Upload failed." });
      }
    }
    setUploads((list) => list.filter((u) => u.state === "failed"));
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void upload([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-dashed px-5 py-5",
          dragging ? "border-ink bg-panel" : "border-rule-strong",
        )}
      >
        <Button onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Uploading…" : "Add images or video"}
        </Button>
        <p className="text-sm text-muted">Or drop files here. JPG, PNG, WebP, GIF, MP4 or WebM, up to 50 MB each.</p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void upload([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {uploads.map((u, i) => (
            <li key={i} className={cn(u.state === "failed" ? "text-danger" : "text-ink-soft")}>
              {u.name}: {u.state === "failed" ? u.error : u.state === "uploading" ? "uploading…" : u.state === "done" ? "done" : "waiting"}
            </li>
          ))}
        </ul>
      ) : null}

      {project.media.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-6">
          {project.media.map((m) => (
            <MediaTile
              key={m.id}
              media={m}
              projectId={project.id}
              cover={project.coverId === m.id}
              thumbnail={project.thumbnailId === m.id}
              placed={used.has(m.id)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MediaTile({
  media: m,
  projectId,
  cover,
  thumbnail,
  placed,
}: {
  media: StudioMedia;
  projectId: string;
  cover: boolean;
  /** Shown on the project's tile instead of the cover. */
  thumbnail: boolean;
  placed: boolean;
}) {
  const [alt, setAlt] = useState(m.alt);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : r.error);
    });

  // Files added without a size (the old site's videos) get one the first time they're shown.
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v || (m.width && m.height)) return;
    const record = () => {
      if (v.videoWidth && v.videoHeight) void updateMedia(m.id, { width: v.videoWidth, height: v.videoHeight });
    };
    if (v.readyState >= 1) record();
    else v.addEventListener("loadedmetadata", record, { once: true });
    return () => v.removeEventListener("loadedmetadata", record);
  }, [m.id, m.width, m.height]);

  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div className="relative">
        {m.kind === "video" ? (
          <video ref={video} src={m.url} muted playsInline controls preload="metadata" className="block h-44 w-full rounded-xl bg-panel object-contain" />
        ) : (
          <Thumb media={m} className="h-44" />
        )}
        <span className="absolute top-2 left-2 flex gap-1">
          {cover ? <span className="bg-signal px-2 py-0.5 font-mono text-[11px] uppercase text-on-signal">Cover</span> : null}
          {thumbnail ? <span className="bg-ink px-2 py-0.5 font-mono text-[11px] uppercase text-paper">Thumbnail</span> : null}
        </span>
      </div>

      <Mono className="flex flex-wrap gap-x-3 normal-case tracking-normal">
        <span>{m.kind === "video" ? "Video" : (m.mime?.split("/")[1]?.toUpperCase() ?? "Image")}</span>
        {m.width && m.height ? <span>{`${m.width} × ${m.height}`}</span> : null}
        {m.bytes ? <span>{size(m.bytes)}</span> : null}
        <span className="flex items-center gap-1.5">
          {placed || cover ? null : <span aria-hidden className="size-1.5 rounded-full bg-signal" />}
          {placed ? "In the case study" : cover ? "Shown at the top" : "Not placed yet"}
        </span>
      </Mono>

      {m.kind === "video" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={m.hasAudio}
            disabled={pending}
            onChange={(e) => run(() => updateMedia(m.id, { hasAudio: e.target.checked }))}
            className="size-4 accent-[var(--signal)]"
          />
          Has sound (show controls instead of a silent loop)
        </label>
      ) : null}

      <div>
        <label htmlFor={`alt-${m.id}`} className="sr-only">
          Description for screen readers
        </label>
        <input
          id={`alt-${m.id}`}
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => alt !== m.alt && run(() => updateMedia(m.id, { alt }))}
          placeholder={m.kind === "video" ? "What happens in it (for screen readers)" : "What it shows (for screen readers)"}
          className="h-9 w-full rounded-full border border-rule-strong bg-transparent px-2.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
      </div>

      <div className="-ml-3 flex flex-wrap">
        {cover ? null : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setCover(projectId, m.id))}>
            Make cover
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setThumbnail(projectId, thumbnail ? null : m.id))}>
          {thumbnail ? "Remove thumbnail" : "Make thumbnail"}
        </Button>
        {confirm ? (
          <>
            <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => deleteMedia(m.id))}>
              Delete for good
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            Delete…
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
