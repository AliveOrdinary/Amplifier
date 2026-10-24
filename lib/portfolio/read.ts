import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PORTFOLIO_BUCKET } from "./blocks";
import type { Block, PortfolioMedia, Project, ProjectCard, StoredBlock } from "./types";

/** Reading projects from the database into the shapes in ./types. Callers pick the client. */

export type MediaRow = {
  id: string;
  project_id: string;
  kind: "image" | "video";
  storage_path: string;
  caption: string | null;
  has_audio: boolean;
  width: number | null;
  height: number | null;
  alt: string | null;
  bytes: number | null;
  mime: string | null;
  sort: number;
  created_at: string;
};

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  year: number | null;
  services: string[];
  short_summary: string | null;
  featured: boolean;
  published: boolean;
  published_at: string | null;
  sort: number;
  cover_media_id: string | null;
  blocks: StoredBlock[];
  updated_at: string;
};

export const PROJECT_COLUMNS =
  "id, slug, title, client, year, services, short_summary, featured, published, published_at, sort, cover_media_id, blocks, updated_at";
export const MEDIA_COLUMNS =
  "id, project_id, kind, storage_path, caption, has_audio, width, height, alt, bytes, mime, sort, created_at";

export function mediaUrl(db: SupabaseClient, path: string) {
  return db.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function toMedia(db: SupabaseClient, row: MediaRow): PortfolioMedia {
  return {
    id: row.id,
    kind: row.kind,
    url: mediaUrl(db, row.storage_path),
    width: row.width,
    height: row.height,
    alt: row.alt ?? "",
    caption: row.caption,
    hasAudio: row.kind === "video" && row.has_audio,
  };
}

function toCard(row: ProjectRow, cover: PortfolioMedia | null): ProjectCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    client: row.client,
    year: row.year,
    services: row.services ?? [],
    summary: row.short_summary,
    featured: row.featured,
    cover,
    publishedAt: row.published_at,
  };
}

/** Media blocks get their files; ids that no longer exist are dropped, and so are blocks left empty. */
export function resolveBlocks(stored: StoredBlock[], byId: Map<string, PortfolioMedia>): Block[] {
  return (stored ?? []).flatMap((block): Block[] => {
    if (block.type === "text") return block.text.trim() ? [{ id: block.id, type: "text", text: block.text }] : [];
    const media = block.media.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    return media.length ? [{ id: block.id, type: "media", media, caption: block.caption?.trim() || null }] : [];
  });
}

const order = <T extends { order: (column: string, options: { ascending: boolean }) => T }>(query: T) =>
  query.order("sort", { ascending: true }).order("created_at", { ascending: false });

/** Projects in the studio's order. `published` limits to what's public (the anon client only sees those anyway). */
export async function readCards(
  db: SupabaseClient,
  options: { featured?: boolean; includeDrafts?: boolean } = {},
): Promise<ProjectCard[]> {
  let query = db.from("projects").select(`${PROJECT_COLUMNS}, created_at`);
  if (!options.includeDrafts) query = query.eq("published", true);
  if (options.featured) query = query.eq("featured", true);
  const { data, error } = await order(query);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ProjectRow[];

  const coverIds = rows.flatMap((r) => (r.cover_media_id ? [r.cover_media_id] : []));
  const covers = new Map<string, PortfolioMedia>();
  if (coverIds.length) {
    const { data: media, error: mediaError } = await db.from("project_media").select(MEDIA_COLUMNS).in("id", coverIds);
    if (mediaError) throw new Error(mediaError.message);
    for (const m of (media ?? []) as MediaRow[]) covers.set(m.id, toMedia(db, m));
  }
  return rows.map((r) => toCard(r, r.cover_media_id ? (covers.get(r.cover_media_id) ?? null) : null));
}

/** One project by its address, with its blocks resolved and its neighbours. */
export async function readProject(
  db: SupabaseClient,
  slug: string,
  options: { includeDrafts?: boolean; preview?: boolean } = {},
): Promise<Project | null> {
  let query = db.from("projects").select(PROJECT_COLUMNS).eq("slug", slug).limit(1);
  if (!options.includeDrafts) query = query.eq("published", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ProjectRow;

  const [{ data: media, error: mediaError }, { data: list, error: listError }] = await Promise.all([
    db.from("project_media").select(MEDIA_COLUMNS).eq("project_id", row.id).order("sort").order("created_at"),
    order(db.from("projects").select("slug, title, sort, created_at").eq("published", true)),
  ]);
  if (mediaError) throw new Error(mediaError.message);
  if (listError) throw new Error(listError.message);

  const files = ((media ?? []) as MediaRow[]).map((m) => toMedia(db, m));
  const byId = new Map(files.map((m) => [m.id, m]));
  const neighbours = (list ?? []) as { slug: string; title: string }[];
  const at = neighbours.findIndex((p) => p.slug === row.slug);
  const pick = (i: number) => (i >= 0 && i < neighbours.length ? { slug: neighbours[i].slug, title: neighbours[i].title } : null);

  return {
    ...toCard(row, row.cover_media_id ? (byId.get(row.cover_media_id) ?? null) : null),
    blocks: resolveBlocks(row.blocks, byId),
    media: files,
    previous: at >= 0 ? pick(at - 1) : null,
    next: at >= 0 ? pick(at + 1) : null,
    draft: !row.published,
    preview: Boolean(options.preview),
  };
}
