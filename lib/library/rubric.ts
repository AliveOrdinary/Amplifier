import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getImages } from "./queries";
import type { Dimension } from "./types";

export type DimensionRow = Dimension & {
  sort: number;
  retiredAt: string | null;
  revisedAt: string;
};

type Row = {
  key: string;
  left_label: string;
  right_label: string;
  left_definition: string;
  right_definition: string;
  sort: number;
  retired_at: string | null;
  revised_at: string;
};

const toDimension = (r: Row): DimensionRow => ({
  key: r.key,
  left: r.left_label,
  right: r.right_label,
  leftDefinition: r.left_definition,
  rightDefinition: r.right_definition,
  sort: r.sort,
  retiredAt: r.retired_at,
  revisedAt: r.revised_at,
});

/** The studio's dimensions in order; retired ones only when asked. */
export async function listDimensions(db: SupabaseClient, studioId: string, { retired = false } = {}) {
  let query = db
    .from("dimensions")
    .select("key, left_label, right_label, left_definition, right_definition, sort, retired_at, revised_at")
    .eq("studio_id", studioId)
    .order("sort");
  if (!retired) query = query.is("retired_at", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toDimension);
}

/** The newest change to any active dimension: images scored before it are out of date. */
export function rubricRevision(dimensions: DimensionRow[]) {
  return dimensions.reduce((latest, d) => (d.revisedAt > latest ? d.revisedAt : latest), "2000-01-01T00:00:00Z");
}

export type Anchor = { dimension: string; side: "left" | "right"; imageId: string; url: string };
export type Correction = { imageId: string; url: string; scores: { dimension: string; score: number; ai: number | null }[] };

/** Anchors for the given dimensions, with thumbnail links. */
export async function listAnchors(db: SupabaseClient, dimensionKeys: string[]): Promise<Anchor[]> {
  if (!dimensionKeys.length) return [];
  const { data, error } = await db
    .from("dimension_anchors")
    .select("dimension, image_id, side, created_at")
    .in("dimension", dimensionKeys)
    .order("created_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { dimension: string; image_id: string; side: "left" | "right" }[];
  const images = new Map((await getImages(db, [...new Set(rows.map((r) => r.image_id))])).map((i) => [i.id, i]));
  return rows.flatMap((r) => {
    const url = images.get(r.image_id)?.thumbUrl;
    return url ? [{ dimension: r.dimension, side: r.side, imageId: r.image_id, url }] : [];
  });
}

/** The studio's most recent corrections to Claude, as examples for scoring. */
export async function recentCorrections(
  db: SupabaseClient,
  studioId: string,
  dimensionKeys: string[],
  { limit = 8, exclude }: { limit?: number; exclude?: string } = {},
): Promise<Correction[]> {
  if (!dimensionKeys.length) return [];
  const { data, error } = await db
    .from("image_scores")
    .select("image_id, dimension, score, ai_score, updated_at, images!inner ( studio_id, status )")
    .eq("source", "human")
    .eq("needs_check", false)
    .eq("images.studio_id", studioId)
    .neq("images.status", "rejected")
    .in("dimension", dimensionKeys)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);

  const byImage = new Map<string, Correction["scores"]>();
  for (const row of (data ?? []) as { image_id: string; dimension: string; score: number; ai_score: number | null }[]) {
    if (row.image_id === exclude) continue;
    if (!byImage.has(row.image_id)) {
      if (byImage.size >= limit) continue;
      byImage.set(row.image_id, []);
    }
    byImage.get(row.image_id)!.push({
      dimension: row.dimension,
      score: Number(row.score),
      ai: row.ai_score === null ? null : Number(row.ai_score),
    });
  }
  const images = new Map((await getImages(db, [...byImage.keys()])).map((i) => [i.id, i]));
  return [...byImage].flatMap(([imageId, scores]) => {
    const url = images.get(imageId)?.thumbUrl;
    return url ? [{ imageId, url, scores }] : [];
  });
}

/** A key for a new dimension: readable, and unique across studios. */
export function dimensionKey(left: string, right: string) {
  const slug = `${left}_${right}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${slug || "dimension"}_${Math.random().toString(36).slice(2, 6)}`;
}
