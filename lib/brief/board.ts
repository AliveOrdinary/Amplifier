import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getImages } from "@/lib/library/queries";
import { similarImages } from "@/lib/library/embed";
import type { Evidence } from "./evidence";

/** Tags shown on board images: where each one came from. */
export type BoardTag = "Their pick" | "Match" | "Added";

export type BoardImage = {
  itemId: string;
  imageId: string;
  url: string;
  thumb: string | null;
  width: number;
  height: number;
  description: string | null;
  tag: BoardTag;
};

const PICKS = 8;
const MATCHES = 8;

/**
 * The client's board, made on first visit: their strongest picks, then the
 * library images most like them (by embedding) that they didn't turn down.
 */
export async function ensureBoard(
  db: SupabaseClient,
  brief: { id: string; studioId: string; title: string },
  ev: Evidence,
): Promise<string> {
  const { data: existing } = await db.from("boards").select("id").eq("brief_id", brief.id).maybeSingle();
  if (existing) return existing.id as string;

  const picks = ev.chosen.filter((c) => c.weight >= 1).slice(0, PICKS).map((c) => c.id);
  const turnedDown = new Set(ev.rejected.map((r) => r.id));
  const seen = new Set([...picks, ...ev.chosen.map((c) => c.id)]);

  // Closest library images to their top picks, best match first.
  const distance = new Map<string, number>();
  const neighbours = await Promise.all(picks.slice(0, 5).map((id) => similarImages(db, id, 12).catch(() => [])));
  for (const list of neighbours) {
    for (const n of list) {
      if (seen.has(n.id) || turnedDown.has(n.id)) continue;
      distance.set(n.id, Math.min(distance.get(n.id) ?? Infinity, n.distance));
    }
  }
  const matches = [...distance].sort((a, b) => a[1] - b[1]).slice(0, MATCHES).map(([id]) => id);

  const { data: board, error } = await db
    .from("boards")
    .insert({ studio_id: brief.studioId, brief_id: brief.id, title: brief.title })
    .select("id")
    .single();
  if (error) {
    // Two requests raced: use the board the other one made.
    const { data: again } = await db.from("boards").select("id").eq("brief_id", brief.id).maybeSingle();
    if (again) return again.id as string;
    throw new Error(error.message);
  }

  const items = [
    ...picks.map((id) => ({ image_id: id, body: "Their pick" })),
    ...matches.map((id) => ({ image_id: id, body: "Match" })),
  ].map((item, z) => ({ ...item, board_id: board.id, kind: "image", z }));
  if (items.length) {
    const { error: itemsError } = await db.from("board_items").insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }
  return board.id as string;
}

/** A board's images in order, with links that work for a week. */
export async function boardImages(db: SupabaseClient, boardId: string): Promise<BoardImage[]> {
  const { data, error } = await db
    .from("board_items")
    .select("id, image_id, body, z")
    .eq("board_id", boardId)
    .eq("kind", "image")
    .order("z");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; image_id: string; body: string | null }[];
  const images = new Map((await getImages(db, rows.map((r) => r.image_id))).map((i) => [i.id, i]));
  return rows.flatMap((r) => {
    const image = images.get(r.image_id);
    if (!image?.displayUrl) return [];
    return [
      {
        itemId: r.id,
        imageId: r.image_id,
        url: image.displayUrl,
        thumb: image.thumbUrl,
        width: image.width ?? 1000,
        height: image.height ?? 1000,
        description: image.description,
        tag: (r.body as BoardTag) ?? "Added",
      },
    ];
  });
}
