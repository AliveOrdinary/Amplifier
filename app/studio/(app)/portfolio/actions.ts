"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_TAG } from "@/lib/portfolio";
import {
  IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  PORTFOLIO_BUCKET,
  SLUG_PATTERN,
  StoredBlocksSchema,
  VIDEO_TYPES,
  slugify,
} from "@/lib/portfolio/blocks";
import type { StoredBlock } from "@/lib/portfolio/types";
import { CRUMS } from "@/lib/portfolio/legacy";

type Fail = { ok: false; error: string };
type Ok<T = object> = { ok: true } & T;
const fail = (error: unknown): Fail => ({
  ok: false,
  error:
    error instanceof z.ZodError
      ? (error.issues[0]?.message ?? "Check the form.")
      : error instanceof Error
        ? error.message
        : "Something went wrong.",
});

/** After any change: the studio screens re-render and the public pages refresh. */
function changed() {
  updateTag(PORTFOLIO_TAG);
  refresh();
}

/** A free address: "crums", or "crums-2" when that's taken. */
async function freeSlug(db: Awaited<ReturnType<typeof createClient>>, base: string, except?: string) {
  const root = slugify(base) || "project";
  const { data } = await db.from("projects").select("id, slug").like("slug", `${root}%`);
  const taken = new Set((data ?? []).filter((p) => p.id !== except).map((p) => p.slug));
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
}

/* -------------------------------------------------------------- projects */

/** A new draft at the top of the list, then straight into its editor. */
export async function createProject(title: string): Promise<Fail> {
  await getMember();
  let id: string;
  try {
    const clean = z.string().trim().min(1, "Give it a name.").max(120).parse(title);
    const db = await createClient();
    const { data: first } = await db.from("projects").select("sort").order("sort").limit(1).maybeSingle();
    const { data, error } = await db
      .from("projects")
      .insert({ title: clean, slug: await freeSlug(db, clean), sort: (first?.sort ?? 1) - 1 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
    changed();
  } catch (error) {
    return fail(error);
  }
  redirect(`/studio/portfolio/${id}`);
}

const Details = z.object({
  title: z.string().trim().min(1, "Give the project a name.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "The address can use lowercase letters, numbers and single hyphens, like crums or clinic-rebrand.")
    .max(80),
  client: z.string().trim().max(120),
  year: z.union([z.literal(""), z.coerce.number().int().min(1900, "Check the year.").max(2100, "Check the year.")]),
  services: z.array(z.string().trim().min(1).max(60)).max(16, "Up to 16 services."),
  summary: z.string().trim().max(600, "Keep the summary under 600 characters."),
  blocks: StoredBlocksSchema,
});

export type ProjectDraft = z.input<typeof Details>;

/** Details and the case study, saved together. */
export async function saveProject(id: string, input: ProjectDraft): Promise<Ok<{ updatedAt: string }> | Fail> {
  await getMember();
  try {
    const d = Details.parse(input);
    const db = await createClient();

    const { data: clash } = await db.from("projects").select("id").eq("slug", d.slug).neq("id", id).maybeSingle();
    if (clash) throw new Error(`Another project already uses /projects/${d.slug}. Pick a different address.`);

    // Blocks may only show this project's own files.
    const { data: media } = await db.from("project_media").select("id").eq("project_id", id);
    const own = new Set((media ?? []).map((m) => m.id));
    const blocks: StoredBlock[] = d.blocks.flatMap((b): StoredBlock[] => {
      if (b.type === "text") return [{ id: b.id, type: "text", text: b.text }];
      const ids = b.media.filter((m) => own.has(m));
      return ids.length ? [{ id: b.id, type: "media", media: ids, caption: b.caption?.trim() || null }] : [];
    });

    const { data, error } = await db
      .from("projects")
      .update({
        title: d.title,
        slug: d.slug,
        client: d.client || null,
        year: d.year === "" ? null : d.year,
        services: d.services,
        short_summary: d.summary || null,
        blocks,
      })
      .eq("id", id)
      .select("updated_at")
      .single();
    if (error) throw new Error(error.message);
    changed();
    return { ok: true, updatedAt: data.updated_at };
  } catch (error) {
    return fail(error);
  }
}

async function setFlag(id: string, change: { published?: boolean; featured?: boolean }): Promise<Ok | Fail> {
  await getMember();
  try {
    const db = await createClient();
    const { error } = await db.from("projects").update(change).eq("id", id);
    if (error) throw new Error(error.message);
    changed();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setPublished(id: string, published: boolean) {
  return setFlag(id, { published });
}

export async function setFeatured(id: string, featured: boolean) {
  return setFlag(id, { featured });
}

/** The order on the site: ids top to bottom. */
export async function reorderProjects(ids: string[]): Promise<Ok | Fail> {
  await getMember();
  try {
    const list = z.array(z.uuid()).max(500).parse(ids);
    const db = await createClient();
    const results = await Promise.all(list.map((id, sort) => db.from("projects").update({ sort }).eq("id", id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    changed();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Deletes the project and its files. */
export async function deleteProject(id: string): Promise<Fail> {
  await getMember();
  try {
    const db = await createClient();
    const { data: media } = await db.from("project_media").select("storage_path").eq("project_id", id);
    const paths = (media ?? []).map((m) => m.storage_path);
    if (paths.length) await db.storage.from(PORTFOLIO_BUCKET).remove(paths);
    const { error } = await db.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
    updateTag(PORTFOLIO_TAG);
  } catch (error) {
    return fail(error);
  }
  redirect("/studio/portfolio");
}

/* ----------------------------------------------------------------- media */

const extension = (type: string) =>
  ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
  })[type] ?? "bin";

/** Where a new file goes, and a one-time token to upload it straight from the browser. */
export async function prepareUpload(
  projectId: string,
  file: { type: string; size: number },
): Promise<Ok<{ path: string; token: string }> | Fail> {
  const member = await getMember();
  try {
    if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(file.type)) {
      throw new Error("Use JPG, PNG, WebP, AVIF or GIF images, or MP4 or WebM video.");
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Files can be up to 50 MB. Export the video smaller first.");
    const db = await createClient();
    const { data: project } = await db.from("projects").select("id").eq("id", projectId).maybeSingle();
    if (!project) throw new Error("That project no longer exists.");

    const path = `${member.studioId}/${projectId}/${randomUUID()}.${extension(file.type)}`;
    const { data, error } = await db.storage.from(PORTFOLIO_BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { ok: true, path, token: data.token };
  } catch (error) {
    return fail(error);
  }
}

const Uploaded = z.object({
  path: z.string().min(1).max(300),
  type: z.string(),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

/** Records a file that has finished uploading. The first one becomes the cover. */
export async function addMedia(projectId: string, input: z.input<typeof Uploaded>): Promise<Ok<{ id: string }> | Fail> {
  const member = await getMember();
  try {
    const file = Uploaded.parse(input);
    if (!file.path.startsWith(`${member.studioId}/${projectId}/`)) throw new Error("That upload doesn't belong to this project.");
    const db = await createClient();
    const { data: last } = await db
      .from("project_media")
      .select("sort")
      .eq("project_id", projectId)
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const { data, error } = await db
      .from("project_media")
      .insert({
        project_id: projectId,
        kind,
        storage_path: file.path,
        width: file.width,
        height: file.height,
        bytes: file.bytes,
        mime: file.type,
        sort: (last?.sort ?? -1) + 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await db.from("projects").update({ cover_media_id: data.id }).eq("id", projectId).is("cover_media_id", null);
    changed();
    return { ok: true, id: data.id };
  } catch (error) {
    return fail(error);
  }
}

const MediaChange = z.object({
  alt: z.string().trim().max(400).optional(),
  hasAudio: z.boolean().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/** Alt text, the sound switch, or a size measured in the browser. */
export async function updateMedia(id: string, input: z.input<typeof MediaChange>): Promise<Ok | Fail> {
  await getMember();
  try {
    const c = MediaChange.parse(input);
    const db = await createClient();
    const { error } = await db
      .from("project_media")
      .update({
        ...(c.alt !== undefined ? { alt: c.alt } : {}),
        ...(c.hasAudio !== undefined ? { has_audio: c.hasAudio } : {}),
        ...(c.width && c.height ? { width: c.width, height: c.height } : {}),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    changed();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setCover(projectId: string, mediaId: string | null): Promise<Ok | Fail> {
  await getMember();
  try {
    const db = await createClient();
    if (mediaId) {
      const { data } = await db.from("project_media").select("id").eq("id", mediaId).eq("project_id", projectId).maybeSingle();
      if (!data) throw new Error("That file isn't part of this project.");
    }
    const { error } = await db.from("projects").update({ cover_media_id: mediaId }).eq("id", projectId);
    if (error) throw new Error(error.message);
    changed();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Deletes a file, and takes it out of any block that showed it. */
export async function deleteMedia(id: string): Promise<Ok | Fail> {
  await getMember();
  try {
    const db = await createClient();
    const { data: media } = await db.from("project_media").select("project_id, storage_path").eq("id", id).maybeSingle();
    if (!media) return { ok: true };

    const { data: project } = await db.from("projects").select("blocks").eq("id", media.project_id).single();
    const blocks = ((project?.blocks ?? []) as StoredBlock[]).flatMap((b): StoredBlock[] => {
      if (b.type !== "media") return [b];
      const rest = b.media.filter((m) => m !== id);
      return rest.length ? [{ ...b, media: rest }] : [];
    });

    const { error } = await db.from("project_media").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await db.from("projects").update({ blocks }).eq("id", media.project_id);
    await db.storage.from(PORTFOLIO_BUCKET).remove([media.storage_path]);
    changed();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------- the old site */

/** Step one of bringing Crums over: the project with its text, as a draft. Files follow from the browser. */
export async function startCrumsImport(): Promise<Ok<{ id: string }> | Fail> {
  await getMember();
  try {
    const db = await createClient();
    const { data: existing } = await db.from("projects").select("id").eq("slug", CRUMS.slug).maybeSingle();
    if (existing) throw new Error("Crums is already in the portfolio.");
    const { data, error } = await db
      .from("projects")
      .insert({
        title: CRUMS.title,
        slug: CRUMS.slug,
        year: CRUMS.year,
        services: [...CRUMS.services],
        short_summary: CRUMS.summary,
        featured: true,
        sort: -1,
        blocks: [{ id: "intro", type: "text", text: CRUMS.text }],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    changed();
    return { ok: true, id: data.id };
  } catch (error) {
    return fail(error);
  }
}

/** Last step: the cover, the sound switch on it, and one block per file after the text. */
export async function finishCrumsImport(
  projectId: string,
  files: { cover: string | null; withSound: string[]; blocks: string[] },
): Promise<Ok | Fail> {
  await getMember();
  try {
    const ids = z.object({ cover: z.uuid().nullable(), withSound: z.array(z.uuid()), blocks: z.array(z.uuid()) }).parse(files);
    const db = await createClient();
    if (ids.withSound.length) await db.from("project_media").update({ has_audio: true }).in("id", ids.withSound).eq("project_id", projectId);
    const blocks: StoredBlock[] = [
      { id: "intro", type: "text", text: CRUMS.text },
      ...ids.blocks.map((m, i): StoredBlock => ({ id: `m${i + 1}`, type: "media", media: [m], caption: null })),
    ];
    const { error } = await db
      .from("projects")
      .update({ blocks, ...(ids.cover ? { cover_media_id: ids.cover } : {}) })
      .eq("id", projectId);
    if (error) throw new Error(error.message);
    changed();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
