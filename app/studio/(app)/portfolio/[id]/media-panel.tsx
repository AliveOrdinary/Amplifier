"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { EditorProject, StudioMedia } from "@/lib/portfolio/studio";
import type { StoredBlock } from "@/lib/portfolio/types";
import { IMAGE_TYPES, VIDEO_TYPES } from "@/lib/portfolio/blocks";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { deleteMedia, setCover, setMediaScore, setThumbnail, updateMedia } from "../actions";
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

/** One of the Work page's faders, named by the rubric. */
export type MixFader = { key: string; left: string; right: string };

const STEPS = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type ScoreRun = { state: "idle" } | { state: "running"; done: number; total: number } | { state: "failed"; error: string };

/**
 * Has Claude score the project's pictures on the rubric, a few per request
 * (portfolio/score/route.ts), until none are waiting. The page refreshes
 * after each round, so scores appear as they land.
 */
function useScoring(projectId: string) {
  const router = useRouter();
  const [run, setRun] = useState<ScoreRun>({ state: "idle" });
  const going = useRef(false);

  const start = useCallback(
    async (total: number, again?: "all" | "failed") => {
      if (going.current || !total) return;
      going.current = true;
      let done = 0;
      setRun({ state: "running", done, total });
      try {
        for (let round = 0; round < 40; round++) {
          const response = await fetch("/studio/portfolio/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, again: round === 0 ? again : undefined }),
          });
          const r = (await response.json().catch(() => null)) as
            | { ok: true; scored: number; failed: number; left: number }
            | { ok: false; error: string }
            | null;
          if (!r?.ok) throw new Error(r?.error ?? "Couldn't score the pictures.");
          done += r.scored + r.failed;
          setRun({ state: "running", done, total: Math.max(total, done + r.left) });
          router.refresh();
          // Nothing left, or a round that got nowhere (try again later rather than spin).
          if (!r.left || !(r.scored + r.failed)) break;
        }
        setRun({ state: "idle" });
      } catch (error) {
        setRun({ state: "failed", error: error instanceof Error ? error.message : "Couldn't score the pictures." });
        router.refresh();
      } finally {
        going.current = false;
      }
    },
    [projectId, router],
  );
  return { run, start };
}

type Upload = { name: string; state: "waiting" | "uploading" | "done" | "failed"; error?: string };

export function MediaPanel({ project, blocks, faders }: { project: EditorProject; blocks: StoredBlock[]; faders: MixFader[] }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = uploads.some((u) => u.state === "waiting" || u.state === "uploading");

  const used = new Set(blocks.flatMap((b) => (b.type === "media" ? b.media : [])));

  const pictures = project.media.filter((m) => m.kind === "image");
  const unscored = pictures.filter((m) => !m.scored && !m.scoreError).length;
  const failed = pictures.filter((m) => m.scoreError).length;
  const { run, start } = useScoring(project.id);

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
    // New pictures go straight to Claude, as in the library.
    const added = files.filter((f) => f.type.startsWith("image/")).length;
    if (added) void start(unscored + added);
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

      {pictures.length && faders.length ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y border-rule py-3" role="status">
          <div className="min-w-0">
            <p className="text-[15px]">
              {run.state === "running"
                ? `Scoring pictures: ${run.done} of ${run.total}`
                : unscored
                  ? `${plural(unscored, "picture isn't", "pictures aren't")} scored for the Work page's mix yet`
                  : failed
                    ? `Claude couldn't score ${plural(failed, "picture", "pictures")}`
                    : "Every picture is scored for the Work page's mix"}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {run.state === "failed"
                ? run.error
                : "Claude scores each picture on your rubric; correct any score under its picture. Videos take the average of the project's pictures."}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {unscored && run.state !== "running" ? (
              <Button size="sm" onClick={() => void start(unscored)}>
                Score {plural(unscored, "picture", "pictures")}
              </Button>
            ) : null}
            {failed && run.state !== "running" ? (
              <Button size="sm" variant="text" onClick={() => void start(failed, "failed")}>
                Try {failed === 1 ? "it" : "them"} again
              </Button>
            ) : null}
            {!unscored && !failed && run.state !== "running" ? (
              <Button size="sm" variant="text" onClick={() => void start(pictures.length, "all")}>
                Score again
              </Button>
            ) : null}
          </div>
        </div>
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
              faders={faders}
              scoring={run.state === "running"}
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
  faders,
  scoring,
}: {
  media: StudioMedia;
  projectId: string;
  cover: boolean;
  /** Shown on the project's tile instead of the cover. */
  thumbnail: boolean;
  placed: boolean;
  faders: MixFader[];
  /** Claude is scoring this project's pictures now. */
  scoring: boolean;
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
          {cover ? <span className="rounded-full bg-signal px-2.5 py-0.5 font-mono text-[11px] uppercase text-on-signal">Cover</span> : null}
          {thumbnail ? <span className="rounded-full bg-ink px-2.5 py-0.5 font-mono text-[11px] uppercase text-paper">Thumbnail</span> : null}
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

      {faders.length ? <MixRows media={m} faders={faders} scoring={scoring} disabled={pending} onPick={(key, value) => run(() => setMediaScore(m.id, key, value))} /> : null}

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

      <div className="flex flex-wrap gap-x-5">
        {cover ? null : (
          <Button size="sm" variant="text" disabled={pending} onClick={() => run(() => setCover(projectId, m.id))}>
            Make cover
          </Button>
        )}
        <Button size="sm" variant="text" disabled={pending} onClick={() => run(() => setThumbnail(projectId, thumbnail ? null : m.id))}>
          {thumbnail ? "Remove thumbnail" : "Make thumbnail"}
        </Button>
        {confirm ? (
          <>
            <Button size="sm" variant="text" className="text-danger" disabled={pending} onClick={() => run(() => deleteMedia(m.id))}>
              Delete for good
            </Button>
            <Button size="sm" variant="text" onClick={() => setConfirm(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button size="sm" variant="text" onClick={() => setConfirm(true)}>
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

/**
 * Where a file sits on the Work page's four faders. Orange is Claude's score,
 * white your correction (click a cell to set one, click it again to go back),
 * grey a video's project average.
 */
function MixRows({
  media: m,
  faders,
  scoring,
  disabled,
  onPick,
}: {
  media: StudioMedia;
  faders: MixFader[];
  scoring: boolean;
  disabled: boolean;
  onPick: (key: string, value: number | null) => void;
}) {
  if (!m.scores) {
    return (
      <p className="text-sm text-muted">
        {m.scoreError
          ? `Claude couldn't score it: ${m.scoreError}`
          : m.kind === "video"
            ? "Takes the average of this project's pictures once they're scored."
            : scoring
              ? "Being scored…"
              : "Not scored for the mix yet."}
      </p>
    );
  }
  const inherited = m.kind === "video";
  return (
    <div className="flex flex-col" aria-label="Where it sits on the Work page's mix">
      {faders.map((f) => {
        const value = Math.round((m.scores?.[f.key] ?? 0) * 2) / 2;
        const edited = f.key in m.scoreEdits;
        return (
          <div key={f.key} className="grid grid-cols-[4.4rem_minmax(0,1fr)_4.6rem] items-center gap-1.5 text-[12px] leading-none">
            <span className={cn("truncate", value < 0 ? "text-ink" : "text-muted")}>{f.left}</span>
            <div role="radiogroup" aria-label={`${f.left} to ${f.right}`} className="grid grid-cols-9">
              {STEPS.map((step) => {
                const on = value === step;
                const side = step < 0 ? f.left : step > 0 ? f.right : "Balanced";
                return (
                  <button
                    key={step}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${signed(step)} ${side}`}
                    title={on && edited ? "Your correction. Click to go back." : `${signed(step)} ${side}`}
                    disabled={disabled}
                    onClick={() => onPick(f.key, on && edited ? null : step)}
                    className={cn(
                      "h-6 bg-clip-content px-[1.5px] py-[5px] transition-colors",
                      on
                        ? edited
                          ? "bg-ink"
                          : inherited
                            ? "bg-muted"
                            : "bg-signal"
                        : step === 0
                          ? "bg-rule-strong/60 hover:bg-rule-strong"
                          : "bg-rule/70 hover:bg-rule-strong",
                    )}
                  />
                );
              })}
            </div>
            <span className={cn("truncate text-right", value > 0 ? "text-ink" : "text-muted")}>{f.right}</span>
          </div>
        );
      })}
      <Mono className="mt-1 normal-case tracking-normal">
        {inherited ? "Project average" : "Claude"}
        {Object.keys(m.scoreEdits).length ? " · white: your correction" : ""}
      </Mono>
    </div>
  );
}
