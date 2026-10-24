import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_COLUMNS, PROJECT_COLUMNS, toMedia, type MediaRow, type ProjectRow } from "./read";
import type { PortfolioMedia, StoredBlock } from "./types";

/** What Studio › Portfolio reads, as the signed-in member (drafts included). */

export type StudioMedia = PortfolioMedia & { bytes: number | null; mime: string | null };

export type StudioProjectRow = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  client: string | null;
  published: boolean;
  featured: boolean;
  updatedAt: string;
  cover: PortfolioMedia | null;
  blocks: number;
};

export type EditorProject = {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  year: number | null;
  services: string[];
  summary: string | null;
  published: boolean;
  publishedAt: string | null;
  featured: boolean;
  coverId: string | null;
  blocks: StoredBlock[];
  updatedAt: string;
  media: StudioMedia[];
};

const studioMedia = (db: SupabaseClient, row: MediaRow): StudioMedia => ({
  ...toMedia(db, row),
  hasAudio: row.has_audio,
  bytes: row.bytes,
  mime: row.mime,
});

export async function studioProjects(db: SupabaseClient): Promise<StudioProjectRow[]> {
  const { data, error } = await db
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ProjectRow[];

  const coverIds = rows.flatMap((r) => (r.cover_media_id ? [r.cover_media_id] : []));
  const covers = new Map<string, PortfolioMedia>();
  if (coverIds.length) {
    const { data: media } = await db.from("project_media").select(MEDIA_COLUMNS).in("id", coverIds);
    for (const m of (media ?? []) as MediaRow[]) covers.set(m.id, toMedia(db, m));
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    year: r.year,
    client: r.client,
    published: r.published,
    featured: r.featured,
    updatedAt: r.updated_at,
    cover: r.cover_media_id ? (covers.get(r.cover_media_id) ?? null) : null,
    blocks: Array.isArray(r.blocks) ? r.blocks.length : 0,
  }));
}

export async function editorProject(db: SupabaseClient, id: string): Promise<EditorProject | null> {
  const { data, error } = await db.from("projects").select(PROJECT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ProjectRow;
  const { data: media, error: mediaError } = await db
    .from("project_media")
    .select(MEDIA_COLUMNS)
    .eq("project_id", id)
    .order("sort")
    .order("created_at");
  if (mediaError) throw new Error(mediaError.message);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    client: row.client,
    year: row.year,
    services: row.services ?? [],
    summary: row.short_summary,
    published: row.published,
    publishedAt: row.published_at,
    featured: row.featured,
    coverId: row.cover_media_id,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    updatedAt: row.updated_at,
    media: ((media ?? []) as MediaRow[]).map((m) => studioMedia(db, m)),
  };
}
