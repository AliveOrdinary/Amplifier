"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { EditorProject } from "@/lib/portfolio/studio";
import type { ProjectFrench, StoredBlock } from "@/lib/portfolio/types";
import { slugify } from "@/lib/portfolio/blocks";
import { Button, Field, Input, Mono, PageContainer, PageHeader, Section, cn } from "@/components/ui/primitives";
import { deleteProject, saveProject, setPublished } from "../actions";
import { BlocksEditor } from "./blocks-editor";
import { FrenchEditor } from "./french-editor";
import { MediaPanel } from "./media-panel";

type Form = {
  title: string;
  slug: string;
  client: string;
  year: string;
  services: string;
  summary: string;
  blocks: StoredBlock[];
  fr: ProjectFrench;
};

const toForm = (p: EditorProject): Form => ({
  title: p.title,
  slug: p.slug,
  client: p.client ?? "",
  year: p.year ? String(p.year) : "",
  services: p.services.join(", "),
  summary: p.summary ?? "",
  blocks: p.blocks,
  fr: p.fr,
});

const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" });

const area =
  "w-full rounded-xl border border-rule-strong bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted focus:border-ink focus:outline-none";

/**
 * One project: details and the case study are edited together and saved
 * with one button; files, the cover and publishing take effect at once.
 */
export function ProjectEditor({ project }: { project: EditorProject }) {
  const [saved, setSaved] = useState(() => toForm(project));
  const [form, setForm] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();
  // The address follows the name until it's been published or typed by hand.
  const [slugLinked, setSlugLinked] = useState(!project.published && project.slug === slugify(project.title));

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useCallback(() => {
    if (!dirty || saving) return;
    startSave(async () => {
      const r = await saveProject(project.id, {
        title: form.title,
        slug: form.slug,
        client: form.client,
        year: form.year.trim(),
        services: form.services.split(",").map((s) => s.trim()).filter(Boolean),
        summary: form.summary,
        blocks: form.blocks,
        fr: form.fr,
      });
      if (!r.ok) return setError(r.error);
      setError(null);
      setSaved(form);
      setNote(project.published ? "Saved. The live page is updated." : "Saved.");
    });
  }, [dirty, saving, form, project.id, project.published]);

  // ⌘S / Ctrl+S saves; leaving with unsaved changes asks first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [save, dirty]);

  const togglePublished = () =>
    startPublish(async () => {
      const r = await setPublished(project.id, !project.published);
      setError(r.ok ? null : r.error);
      setNote(r.ok ? (project.published ? "Taken off the site. It's a draft again." : `Published at /projects/${saved.slug}.`) : null);
    });

  return (
    <PageContainer className={cn(dirty && "pb-40")}>
      <PageHeader
        eyebrow={
          <>
            <Link href="/studio/portfolio" className="font-mono text-label uppercase text-muted hover:text-ink">
              ← Portfolio
            </Link>
            <Mono className="flex items-center gap-2">
              <span aria-hidden className={cn("size-1.5 rounded-full", project.published ? "bg-signal" : "bg-rule-strong")} />
              {project.published && project.publishedAt ? `Published ${day(project.publishedAt)}` : "Draft"}
            </Mono>
          </>
        }
        title={saved.title || "Untitled"}
        actions={
          <>
            {/* A plain link that opens a new tab: Preview sets a cookie, which prefetching mustn't do. */}
            <a
              href={`/api/portfolio/preview?id=${project.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-full border border-rule-strong px-5 text-[15px] hover:border-ink"
            >
              Preview{dirty ? " (saved version)" : ""}
            </a>
            <a
              href={`/api/portfolio/preview?id=${project.id}&lang=fr`}
              target="_blank"
              rel="noreferrer"
              lang="fr"
              className="inline-flex h-11 items-center rounded-full border border-rule-strong px-5 text-[15px] hover:border-ink"
            >
              Aperçu FR
            </a>
            <Button variant={project.published ? "secondary" : "primary"} onClick={togglePublished} disabled={publishing}>
              {publishing ? "…" : project.published ? "Unpublish" : "Publish"}
            </Button>
          </>
        }
      />

      {note && !dirty ? (
        <p role="status" className="mt-4 text-sm text-ink-soft">
          {note}
        </p>
      ) : null}

      <Section number="01" title="Details" description="Shown at the top of the case study and wherever the project is listed.">
        <div className="flex max-w-3xl flex-col gap-6">
          <Field label="Name" htmlFor="p-title">
            <Input
              id="p-title"
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({ ...f, title, slug: slugLinked ? slugify(title) || f.slug : f.slug }));
              }}
            />
          </Field>
          <Field
            label="Address"
            htmlFor="p-slug"
            hint={project.published ? "Changing it breaks links people already have." : "Follows the name until you change it."}
          >
            <div className="flex items-stretch">
              <span className="flex items-center border border-r-0 border-rule-strong px-3 font-mono text-sm text-muted">/projects/</span>
              <Input
                id="p-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugLinked(false);
                  set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
                className="font-mono text-sm"
                spellCheck={false}
              />
            </div>
          </Field>
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Field label="Client" htmlFor="p-client">
              <Input id="p-client" value={form.client} onChange={(e) => set("client", e.target.value)} />
            </Field>
            <Field label="Year" htmlFor="p-year">
              <Input id="p-year" inputMode="numeric" maxLength={4} value={form.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
          <Field label="Services" htmlFor="p-services" hint="Separated by commas: Naming, Branding, Packaging.">
            <Input id="p-services" value={form.services} onChange={(e) => set("services", e.target.value)} />
          </Field>
          <Field label="Summary" htmlFor="p-summary" hint="A sentence or two. Shown in lists and at the top of the case study.">
            <textarea id="p-summary" rows={3} value={form.summary} onChange={(e) => set("summary", e.target.value)} className={area} />
          </Field>
        </div>
      </Section>

      <Section
        number="02"
        title="Images and video"
        description="Everything for this project. Pick the cover (top of the case study) and, if it should differ, the thumbnail (its tile on Home and Works) here; choose what the case study shows below."
      >
        <MediaPanel project={project} blocks={form.blocks} />
      </Section>

      <Section
        number="03"
        title="Case study"
        description="Text and media, top to bottom, in the order the page shows them."
      >
        <BlocksEditor blocks={form.blocks} media={project.media} onChange={(blocks) => set("blocks", blocks)} areaClass={area} />
      </Section>

      <Section
        number="04"
        title="French"
        description="The French site at /fr. Write it beside the English; anything left empty shows in English there."
      >
        <FrenchEditor
          english={{ title: form.title, services: form.services, summary: form.summary }}
          blocks={form.blocks}
          media={project.media}
          fr={form.fr}
          onChange={(fr) => set("fr", fr)}
          areaClass={area}
        />
      </Section>

      <Section number="05" title="Delete" description="Removes the project and its files from the site and the studio." className="border-b-0">
        <DeleteProject id={project.id} title={saved.title} />
      </Section>

      {dirty || error ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule-strong bg-paper/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-10">
            <p role={error ? "alert" : "status"} className={cn("flex-1 text-[15px]", error ? "text-danger" : "text-ink")}>
              {error ?? (project.published ? "Unsaved changes. The live page changes when you save." : "Unsaved changes.")}
            </p>
            {dirty ? (
              <>
                <Button variant="ghost" onClick={() => (setForm(saved), setError(null))} disabled={saving}>
                  Discard
                </Button>
                <Button variant="primary" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"} <span className="font-mono text-xs opacity-70">⌘S</span>
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setError(null)}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

function DeleteProject({ id, title }: { id: string; title: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {confirm ? (
        <>
          <span className="text-[15px] text-danger">Delete {title || "this project"} and all its files?</span>
          <Button
            onClick={() =>
              start(async () => {
                const r = await deleteProject(id);
                if (r && !r.ok) setError(r.error);
              })
            }
            disabled={pending}
            className="border-danger text-danger"
          >
            {pending ? "Deleting…" : "Delete for good"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button onClick={() => setConfirm(true)}>Delete project…</Button>
      )}
      {error ? <p role="alert" className="w-full text-sm text-danger">{error}</p> : null}
    </div>
  );
}
