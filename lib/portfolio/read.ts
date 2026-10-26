import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PORTFOLIO_BUCKET } from "./blocks";
import type { Block, Locale, PortfolioMedia, Project, ProjectCard, ProjectFrench, StoredBlock } from "./types";

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
  /** Missing until migration 14 is applied. */
  fr?: ProjectFrench | null;
  updated_at: string;
};

const BASE_COLUMNS =
  "id, slug, title, client, year, services, short_summary, featured, published, published_at, sort, cover_media_id, blocks, updated_at";

/*
 * The French column arrives with migration 14. Until it's applied, read
 * projects without it, so the site keeps working in English everywhere
 * instead of failing. Checked once per server, and only remembered once
 * the database has answered.
 */
let frenchColumn: boolean | undefined;

export async function hasFrenchColumn(db: SupabaseClient): Promise<boolean> {
  if (frenchColumn !== undefined) return frenchColumn;
  const { error } = await db.from("projects").select("fr").limit(1);
  if (!error) return (frenchColumn = true);
  // 42703: undefined column. Any other error is left for the real query to report.
  if (error.code === "42703" || /column .*fr.* does not exist/i.test(error.message)) {
    console.warn("projects.fr is missing: apply supabase/migrations/…14_portfolio_french.sql for French project text.");
    return (frenchColumn = false);
  }
  return true;
}

/** The project columns to select: with `fr` once migration 14 is applied. */
export async function projectColumns(db: SupabaseClient) {
  return (await hasFrenchColumn(db)) ? `${BASE_COLUMNS}, fr` : BASE_COLUMNS;
}
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

/** Trimmed text, or undefined when there's nothing to show. */
const filled = (s: string | undefined | null) => (s && s.trim() ? s : undefined);

/** The French to lay over a row, or null for English (or a project with no French yet). */
function french(row: { fr?: ProjectFrench | null }, locale: Locale): ProjectFrench | null {
  return locale === "fr" && row.fr && typeof row.fr === "object" ? row.fr : null;
}

/** A file's alt text in the reader's language. */
function localMedia(media: PortfolioMedia, fr: ProjectFrench | null): PortfolioMedia {
  const alt = filled(fr?.alt?.[media.id]);
  return alt ? { ...media, alt } : media;
}

function toCard(row: ProjectRow, cover: PortfolioMedia | null, locale: Locale = "en"): ProjectCard {
  const fr = french(row, locale);
  return {
    id: row.id,
    slug: row.slug,
    title: filled(fr?.title) ?? row.title,
    client: row.client,
    year: row.year,
    services: fr?.services?.filter(Boolean).length ? fr.services.filter(Boolean) : (row.services ?? []),
    summary: filled(fr?.summary) ?? row.short_summary,
    featured: row.featured,
    cover: cover ? localMedia(cover, fr) : null,
    publishedAt: row.published_at,
  };
}

/** Media blocks get their files; ids that no longer exist are dropped, and so are blocks left empty. */
export function resolveBlocks(stored: StoredBlock[], byId: Map<string, PortfolioMedia>, fr: ProjectFrench | null = null): Block[] {
  return (stored ?? []).flatMap((block): Block[] => {
    const tr = fr?.blocks?.[block.id];
    if (block.type === "text") {
      const text = filled(tr?.text) ?? block.text;
      return text.trim() ? [{ id: block.id, type: "text", text }] : [];
    }
    const media = block.media.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const caption = filled(tr?.caption) ?? block.caption?.trim() ?? null;
    return media.length ? [{ id: block.id, type: "media", media, caption: caption || null }] : [];
  });
}

const order = <T extends { order: (column: string, options: { ascending: boolean }) => T }>(query: T) =>
  query.order("sort", { ascending: true }).order("created_at", { ascending: false });

/** Projects in the studio's order. `published` limits to what's public (the anon client only sees those anyway). */
export async function readCards(
  db: SupabaseClient,
  options: { featured?: boolean; includeDrafts?: boolean; locale?: Locale } = {},
): Promise<ProjectCard[]> {
  let query = db.from("projects").select(`${await projectColumns(db)}, created_at`);
  if (!options.includeDrafts) query = query.eq("published", true);
  if (options.featured) query = query.eq("featured", true);
  const { data, error } = await order(query);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ProjectRow[];

  const coverIds = rows.flatMap((r) => (r.cover_media_id ? [r.cover_media_id] : []));
  const covers = new Map<string, PortfolioMedia>();
  if (coverIds.length) {
    const { data: media, error: mediaError } = await db.from("project_media").select(MEDIA_COLUMNS).in("id", coverIds);
    if (mediaError) throw new Error(mediaError.message);
    for (const m of (media ?? []) as MediaRow[]) covers.set(m.id, toMedia(db, m));
  }
  return rows.map((r) => toCard(r, r.cover_media_id ? (covers.get(r.cover_media_id) ?? null) : null, options.locale));
}

/** One project by its address, with its blocks resolved and its neighbours. */
export async function readProject(
  db: SupabaseClient,
  slug: string,
  options: { includeDrafts?: boolean; preview?: boolean; locale?: Locale } = {},
): Promise<Project | null> {
  let query = db.from("projects").select(await projectColumns(db)).eq("slug", slug).limit(1);
  if (!options.includeDrafts) query = query.eq("published", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as ProjectRow;
  const withFrench = await hasFrenchColumn(db);

  const [{ data: media, error: mediaError }, { data: list, error: listError }] = await Promise.all([
    db.from("project_media").select(MEDIA_COLUMNS).eq("project_id", row.id).order("sort").order("created_at"),
    order(db.from("projects").select(withFrench ? "slug, title, fr, sort, created_at" : "slug, title, sort, created_at").eq("published", true)),
  ]);
  if (mediaError) throw new Error(mediaError.message);
  if (listError) throw new Error(listError.message);

  const locale = options.locale ?? "en";
  const fr = french(row, locale);
  const files = ((media ?? []) as MediaRow[]).map((m) => localMedia(toMedia(db, m), fr));
  const byId = new Map(files.map((m) => [m.id, m]));
  const neighbours = (list ?? []) as unknown as { slug: string; title: string; fr?: ProjectFrench | null }[];
  const at = neighbours.findIndex((p) => p.slug === row.slug);
  const pick = (i: number) => {
    if (i < 0 || i >= neighbours.length) return null;
    const n = neighbours[i];
    return { slug: n.slug, title: filled(french(n, locale)?.title) ?? n.title };
  };

  return {
    ...toCard(row, row.cover_media_id ? (byId.get(row.cover_media_id) ?? null) : null, locale),
    blocks: resolveBlocks(row.blocks, byId, fr),
    media: files,
    previous: at >= 0 ? pick(at - 1) : null,
    next: at >= 0 ? pick(at + 1) : null,
    draft: !row.published,
    preview: Boolean(options.preview),
  };
}
