"use server";

import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boardImages, type BoardImage } from "@/lib/brief/board";
import { similarImages } from "@/lib/library/embed";
import { getImages } from "@/lib/library/queries";

type Fail = { ok: false; error: string };
const fail = (error: unknown): Fail => ({ ok: false, error: error instanceof Error ? error.message : "Something went wrong." });

async function ownBoard(db: Awaited<ReturnType<typeof createClient>>, boardId: string, studioId: string) {
  const { data } = await db.from("boards").select("id").eq("id", boardId).eq("studio_id", studioId).maybeSingle();
  if (!data) throw new Error("That board no longer exists.");
}

/** Save the order of a board's images. */
export async function setBoardOrder(boardId: string, itemIds: string[]): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    await ownBoard(db, boardId, member.studioId);
    const results = await Promise.all(
      itemIds.slice(0, 200).map((id, z) => db.from("board_items").update({ z }).eq("id", id).eq("board_id", boardId)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeBoardItem(boardId: string, itemId: string): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    await ownBoard(db, boardId, member.studioId);
    const { error } = await db.from("board_items").delete().eq("id", itemId).eq("board_id", boardId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Add library images to the end of a board (skipping ones already on it). */
export async function addToBoard(boardId: string, imageIds: string[]): Promise<{ ok: true; images: BoardImage[] } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    await ownBoard(db, boardId, member.studioId);
    const { data: rows } = await db.from("board_items").select("image_id, z").eq("board_id", boardId);
    const onBoard = new Set((rows ?? []).map((r) => r.image_id as string));
    const top = Math.max(-1, ...(rows ?? []).map((r) => r.z as number));
    const fresh = [...new Set(imageIds)].filter((id) => !onBoard.has(id));
    if (fresh.length) {
      const { error } = await db
        .from("board_items")
        .insert(fresh.map((image_id, i) => ({ board_id: boardId, kind: "image", image_id, body: "Added", z: top + 1 + i })));
      if (error) throw new Error(error.message);
    }
    const all = await boardImages(db, boardId);
    return { ok: true, images: all.filter((i) => fresh.includes(i.imageId)) };
  } catch (error) {
    return fail(error);
  }
}

export type PickerImage = { id: string; thumb: string | null; description: string | null; suggested: boolean };

/**
 * Library images that could join the board: the closest matches to what's
 * on it first, then the rest of the approved library.
 */
export async function boardCandidates(boardId: string): Promise<{ ok: true; images: PickerImage[] } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    await ownBoard(db, boardId, member.studioId);
    const { data: rows } = await db.from("board_items").select("image_id").eq("board_id", boardId).order("z");
    const onBoard = new Set((rows ?? []).map((r) => r.image_id as string));

    const distance = new Map<string, number>();
    const lists = await Promise.all(
      [...onBoard].slice(0, 6).map((id) => similarImages(db, id, 16).catch(() => [] as { id: string; distance: number }[])),
    );
    for (const list of lists) {
      for (const n of list) if (!onBoard.has(n.id)) distance.set(n.id, Math.min(distance.get(n.id) ?? Infinity, n.distance));
    }

    const { data: approved } = await db
      .from("images")
      .select("id")
      .eq("studio_id", member.studioId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = [...new Set([...[...distance].sort((a, b) => a[1] - b[1]).map(([id]) => id), ...(approved ?? []).map((r) => r.id as string)])].filter(
      (id) => !onBoard.has(id),
    );
    const images = new Map((await getImages(db, ids)).map((i) => [i.id, i]));
    return {
      ok: true,
      images: ids.flatMap((id) => {
        const i = images.get(id);
        return i?.ready ? [{ id, thumb: i.thumbUrl, description: i.description, suggested: distance.has(id) }] : [];
      }),
    };
  } catch (error) {
    return fail(error);
  }
}

/** Start the board again from the client's picks and matches. */
export async function resetBoard(boardId: string): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    await ownBoard(db, boardId, member.studioId);
    const { error } = await db.from("boards").delete().eq("id", boardId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
