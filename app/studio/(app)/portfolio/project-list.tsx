"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { StudioProjectRow } from "@/lib/portfolio/studio";
import { Button, EmptyState, Input, Mono, cn } from "@/components/ui/primitives";
import { createProject, reorderProjects, setFeatured } from "./actions";

/** Name a new project, then go straight to its editor. */
export function NewProject() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        New project
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createProject(title);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <div>
        <label htmlFor="new-project" className="sr-only">
          Project name
        </label>
        <Input
          id="new-project"
          autoFocus
          placeholder="Project name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="w-64"
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="primary" disabled={pending || !title.trim()}>
        {pending ? "Creating…" : "Create"}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

export function ProjectList({ projects }: { projects: StudioProjectRow[] }) {
  const [list, move] = useOptimistic(projects, (current, { from, to }: { from: number; to: number }) => {
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!projects.length) {
    return <EmptyState title="No projects yet">Start one with New project. It stays a draft until you publish it.</EmptyState>;
  }

  const reorder = (from: number, to: number) =>
    start(async () => {
      move({ from, to });
      const ids = list.map((p) => p.id);
      const [id] = ids.splice(from, 1);
      ids.splice(to, 0, id);
      const r = await reorderProjects(ids);
      setError(r.ok ? null : r.error);
    });

  return (
    <>
      <ol className="border-t border-rule">
        {list.map((p, i) => (
          <Row
            key={p.id}
            project={p}
            first={i === 0}
            last={i === list.length - 1}
            onUp={() => reorder(i, i - 1)}
            onDown={() => reorder(i, i + 1)}
            onError={setError}
          />
        ))}
      </ol>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}

function Row({
  project: p,
  first,
  last,
  onUp,
  onDown,
  onError,
}: {
  project: StudioProjectRow;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onError: (e: string | null) => void;
}) {
  const [featured, setLocalFeatured] = useOptimistic(p.featured);
  const [, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-rule py-3">
      <Link href={`/studio/portfolio/${p.id}`} className="group flex min-w-0 flex-1 basis-72 items-center gap-4">
        <span className="block h-[54px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-panel">
          {p.cover?.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.cover.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : p.cover?.kind === "video" ? (
            <video src={`${p.cover.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[16px] group-hover:underline group-hover:underline-offset-4">{p.title}</span>
          <span className="block truncate text-sm text-muted">
            {[p.client, p.year, `/projects/${p.slug}`].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>

      <Mono className="flex w-24 items-center gap-2">
        <span aria-hidden className={cn("size-1.5 rounded-full", p.published ? "bg-signal" : "bg-rule-strong")} />
        {p.published ? "Published" : "Draft"}
      </Mono>

      <button
        type="button"
        aria-pressed={featured}
        onClick={() =>
          start(async () => {
            setLocalFeatured(!featured);
            const r = await setFeatured(p.id, !featured);
            onError(r.ok ? null : r.error);
          })
        }
        className={cn("h-9 w-28 rounded-full border px-3 text-sm", featured ? "border-ink text-ink" : "border-rule-strong text-muted hover:text-ink")}
      >
        {featured ? "★ Featured" : "☆ Feature"}
      </button>

      <div className="-mr-2 flex">
        <Button size="sm" variant="ghost" aria-label={`Move ${p.title} up`} disabled={first} onClick={onUp}>
          ↑
        </Button>
        <Button size="sm" variant="ghost" aria-label={`Move ${p.title} down`} disabled={last} onClick={onDown}>
          ↓
        </Button>
      </div>
    </li>
  );
}
