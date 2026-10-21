import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DimensionKey } from "./constants";
import type { LibraryImage } from "./types";

const URL_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

const COLUMNS =
  "id, status, medium, description, width, height, thumb_path, display_path, thumb_url, display_url, urls_expire_at, source_url, page_url, original_name, score_error, scored_at, created_at, image_scores ( dimension, score, source, confidence )";

type Row = {
  id: string;
  status: LibraryImage["status"];
  medium: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  thumb_path: string | null;
  display_path: string | null;
  thumb_url: string | null;
  display_url: string | null;
  urls_expire_at: string | null;
  source_url: string | null;
  page_url: string | null;
  original_name: string | null;
  score_error: string | null;
  scored_at: string | null;
  created_at: string;
  image_scores: { dimension: string; score: number; source: "ai" | "human"; confidence: number | null }[] | null;
};

/** Every image in the studio's library, newest first. */
export async function listImages(db: SupabaseClient, studioId: string) {
  const { data, error } = await db
    .from("images")
    .select(COLUMNS)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return toLibraryImages(db, (data ?? []) as unknown as Row[]);
}

/** Specific images, e.g. after one was added or rescored. */
export async function getImages(db: SupabaseClient, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await db.from("images").select(COLUMNS).in("id", ids);
  if (error) throw new Error(error.message);
  return toLibraryImages(db, (data ?? []) as unknown as Row[]);
}

/** Images added after a point in time (for picking up extension and phone additions). */
export async function getImagesSince(db: SupabaseClient, studioId: string, since: string) {
  const { data, error } = await db
    .from("images")
    .select(COLUMNS)
    .eq("studio_id", studioId)
    .gt("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return toLibraryImages(db, (data ?? []) as unknown as Row[]);
}

async function toLibraryImages(db: SupabaseClient, rows: Row[]) {
  await renewUrls(db, rows);
  return rows.map(toLibraryImage);
}

/**
 * Signed URLs are reused until a day before they expire, so an image keeps
 * the same address across page loads and the browser cache does its job.
 */
async function renewUrls(db: SupabaseClient, rows: Row[]) {
  const soon = Date.now() + RENEW_BEFORE_MS;
  const stale = rows.filter(
    (r) =>
      r.thumb_path &&
      r.display_path &&
      (!r.thumb_url || !r.display_url || !r.urls_expire_at || Date.parse(r.urls_expire_at) < soon),
  );
  if (!stale.length) return;

  const paths = stale.flatMap((r) => [r.thumb_path!, r.display_path!]);
  const { data } = await db.storage.from("library").createSignedUrls(paths, URL_LIFETIME_SECONDS);
  if (!data) return;
  const signed = new Map(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  const expires = new Date(Date.now() + URL_LIFETIME_SECONDS * 1000).toISOString();

  await Promise.all(
    stale.map(async (row) => {
      const thumb = signed.get(row.thumb_path!);
      const display = signed.get(row.display_path!);
      if (!thumb || !display) return;
      row.thumb_url = thumb;
      row.display_url = display;
      row.urls_expire_at = expires;
      await db
        .from("images")
        .update({ thumb_url: thumb, display_url: display, urls_expire_at: expires })
        .eq("id", row.id);
    }),
  );
}

function toLibraryImage(r: Row): LibraryImage {
  const scores = Object.fromEntries(
    (r.image_scores ?? []).map((s) => [
      s.dimension,
      { score: Number(s.score), source: s.source, confidence: s.confidence === null ? null : Number(s.confidence) },
    ]),
  ) as LibraryImage["scores"] & Record<DimensionKey, unknown>;

  return {
    id: r.id,
    status: r.status,
    medium: r.medium,
    description: r.description,
    name: r.original_name,
    width: r.width,
    height: r.height,
    thumbUrl: r.thumb_url,
    displayUrl: r.display_url,
    sourceUrl: r.page_url ?? r.source_url,
    scoreError: r.score_error,
    scored: Boolean(r.scored_at),
    ready: Boolean(r.display_path) && (Boolean(r.scored_at) || Boolean(r.score_error)),
    createdAt: r.created_at,
    scores,
  };
}
