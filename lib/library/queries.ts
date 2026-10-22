import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryImage } from "./types";

const URL_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

const COLUMNS =
  "id, status, medium, description, width, height, thumb_path, display_path, thumb_url, display_url, urls_expire_at, source_url, page_url, collection, review_reason, original_name, score_error, scored_at, created_at, image_scores ( dimension, score, source, confidence, needs_check )";

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
  collection: string | null;
  review_reason: string | null;
  original_name: string | null;
  score_error: string | null;
  scored_at: string | null;
  created_at: string;
  image_scores:
    | { dimension: string; score: number; source: "ai" | "human"; confidence: number | null; needs_check: boolean }[]
    | null;
};

/** Specific images, e.g. after one was added or rescored. */
export async function getImages(db: SupabaseClient, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await db.from("images").select(COLUMNS).in("id", ids);
  if (error) throw new Error(error.message);
  return toLibraryImages(db, (data ?? []) as unknown as Row[]);
}

/** Images added after a point in time (for picking up extension and phone additions). */
export async function getImagesSince(db: SupabaseClient, studioId: string, since: string, limit = 100) {
  const { data, error } = await db
    .from("images")
    .select(COLUMNS)
    .eq("studio_id", studioId)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
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
      {
        score: Number(s.score),
        source: s.source,
        confidence: s.confidence === null ? null : Number(s.confidence),
        check: Boolean(s.needs_check),
      },
    ]),
  ) as LibraryImage["scores"];

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
    collection: r.collection,
    reviewReason: r.review_reason,
    scoreError: r.score_error,
    scored: Boolean(r.scored_at),
    ready: Boolean(r.display_path) && (Boolean(r.scored_at) || Boolean(r.score_error)),
    createdAt: r.created_at,
    scores,
  };
}

/* ------------------------------------------------------------------ pages */

export type LibraryFilters = {
  status?: "pending" | "approved" | "rejected" | "all";
  medium?: string;
  search?: string;
  check?: boolean;
  board?: string;
};

/** Where the next page starts: the last image of this one. */
export type PageCursor = { createdAt: string; id: string };

export const PAGE_SIZE = 60;

/** One page of ready images, newest first, with the cursor for the next. */
export async function libraryPage(
  db: SupabaseClient,
  studioId: string,
  filters: LibraryFilters,
  cursor: PageCursor | null,
  limit = PAGE_SIZE,
) {
  const { data, error } = await db.rpc("library_page", {
    p_studio: studioId,
    p_status: filters.status ?? "all",
    p_medium: filters.medium || null,
    p_search: filters.search?.trim() || null,
    p_check: Boolean(filters.check),
    p_board: filters.board || null,
    p_before: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; created_at: string }[];
  const byId = new Map((await getImages(db, rows.map((r) => r.id))).map((i) => [i.id, i]));
  const images = rows.flatMap((r) => (byId.has(r.id) ? [byId.get(r.id)!] : []));
  const last = rows.at(-1);
  return { images, next: rows.length === limit && last ? { createdAt: last.created_at, id: last.id } : null };
}

export type LibraryCounts = { toReview: number; approved: number; scoring: number; toCheck: number; newest: string | null };

export async function libraryCounts(db: SupabaseClient, studioId: string): Promise<LibraryCounts> {
  const { data, error } = await db.rpc("library_counts", { p_studio: studioId });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as { to_review: number; approved: number; scoring: number; to_check: number; newest: string | null }[])[0];
  return {
    toReview: row?.to_review ?? 0,
    approved: row?.approved ?? 0,
    scoring: row?.scoring ?? 0,
    toCheck: row?.to_check ?? 0,
    newest: row?.newest ?? null,
  };
}

export type Board = { name: string; images: number };

export async function libraryBoards(db: SupabaseClient, studioId: string): Promise<Board[]> {
  const { data, error } = await db.rpc("library_boards", { p_studio: studioId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { collection: string; images: number }[]).map((b) => ({ name: b.collection, images: b.images }));
}

/** Everything waiting for review (ready, oldest first). */
export async function reviewQueue(db: SupabaseClient, studioId: string, limit = 300) {
  const { data, error } = await db
    .from("images")
    .select(COLUMNS)
    .eq("studio_id", studioId)
    .eq("status", "pending")
    .not("display_path", "is", null)
    .or("scored_at.not.is.null,score_error.not.is.null")
    .order("created_at")
    .limit(limit);
  if (error) throw new Error(error.message);
  return toLibraryImages(db, (data ?? []) as unknown as Row[]);
}

/** Images still being processed or scored that someone added by hand (not a board import), newest first. */
export async function scoringNow(db: SupabaseClient, studioId: string, limit = 50) {
  const { data, error } = await db
    .from("images")
    .select(COLUMNS)
    .eq("studio_id", studioId)
    .is("collection", null)
    .is("scored_at", null)
    .is("score_error", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return toLibraryImages(db, (data ?? []) as unknown as Row[]);
}

export type Coverage = {
  /** Approved images per dimension, in five bins from −2 to +2. */
  bins: Record<string, number[]>;
  media: Record<string, number>;
  approved: number;
};

export async function libraryCoverage(db: SupabaseClient, studioId: string): Promise<Coverage> {
  const [bins, media] = await Promise.all([
    db.rpc("library_coverage", { p_studio: studioId }),
    db.rpc("library_media", { p_studio: studioId }),
  ]);
  if (bins.error) throw new Error(bins.error.message);
  if (media.error) throw new Error(media.error.message);
  const result: Coverage = { bins: {}, media: {}, approved: 0 };
  for (const row of (bins.data ?? []) as { dimension: string; bin: number; images: number }[]) {
    (result.bins[row.dimension] ??= [0, 0, 0, 0, 0])[row.bin] += row.images;
  }
  for (const row of (media.data ?? []) as { medium: string; images: number }[]) {
    result.media[row.medium] = row.images;
    result.approved += row.images;
  }
  return result;
}

export type PickOptions = {
  search?: string;
  /** Sort by this dimension's score: ascending puts the left end first. */
  dimension?: string | null;
  ascending?: boolean;
  approvedOnly?: boolean;
  offset?: number;
  limit?: number;
};

/** A page of images for a picker, with whether there are more. */
export async function pickImages(db: SupabaseClient, studioId: string, options: PickOptions) {
  const limit = options.limit ?? PAGE_SIZE;
  const { data, error } = await db.rpc("library_pick", {
    p_studio: studioId,
    p_search: options.search?.trim() || null,
    p_dimension: options.dimension ?? null,
    p_ascending: options.ascending ?? true,
    p_approved_only: Boolean(options.approvedOnly),
    p_offset: options.offset ?? 0,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const byId = new Map((await getImages(db, ids)).map((i) => [i.id, i]));
  return { images: ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])), more: ids.length === limit };
}
