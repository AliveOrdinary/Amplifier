import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { finishImage, removeImage } from "./pipeline";

/**
 * Adding an image has two steps: store the original, then make its display
 * and thumbnail versions (finishImage). When the second step is cut off (a
 * function timeout, the database struggling), nothing used to come back for
 * it, and it sat as "scoring" forever. This picks those up again.
 *
 * Due a try: no display version, added over 15 minutes ago, not tried in the
 * last 5 (the counts' `unfinished`, migration 18). After three tries it gives
 * up and records why, and the Review screen offers Retry or Remove. An image
 * whose file never reached storage is removed after a day.
 */

const BUCKET = "library";
const MAX_TRIES = 3;
const DUE_AFTER_MS = 15 * 60 * 1000;
const RETRY_AFTER_MS = 5 * 60 * 1000;
const NEVER_ARRIVED_MS = 24 * 60 * 60 * 1000;
/** Resizing one image takes a few seconds; leave room to finish the last. */
const NEEDS_MS = 20_000;

type Unfinished = { id: string; storage_path: string; collection: string | null; created_at: string; add_attempts: number };

export async function finishUnfinished(db: SupabaseClient, studioId: string, { deadline }: { deadline: number }) {
  const now = Date.now();
  const { data, error } = await db
    .from("images")
    .select("id, storage_path, collection, created_at, add_attempts")
    .eq("studio_id", studioId)
    .is("display_path", null)
    .is("add_error", null)
    .lt("created_at", new Date(now - DUE_AFTER_MS).toISOString())
    .or(`add_tried_at.is.null,add_tried_at.lt.${new Date(now - RETRY_AFTER_MS).toISOString()}`)
    .order("created_at")
    .limit(10);
  if (error) throw new Error(error.message);

  let finished = 0;
  let removed = 0;
  let failed = 0;
  for (const image of (data ?? []) as Unfinished[]) {
    if (Date.now() + NEEDS_MS > deadline) break;

    if (image.add_attempts >= MAX_TRIES) {
      // The last try was cut off before it could say why.
      await giveUp(db, image.id, "Adding this image kept timing out.");
      failed++;
      continue;
    }

    if (!(await originalArrived(db, image.storage_path))) {
      if (now - Date.parse(image.created_at) > NEVER_ARRIVED_MS) {
        await removeImage(db, image.id, studioId);
        removed++;
      }
      continue;
    }

    // Claim this try; if another refresh got there first, leave it to them.
    const { data: claimed } = await db
      .from("images")
      .update({ add_attempts: image.add_attempts + 1, add_tried_at: new Date().toISOString() })
      .eq("id", image.id)
      .eq("add_attempts", image.add_attempts)
      .select("id");
    if (!claimed?.length) continue;

    try {
      await finishImage(db, image.id, undefined, { queue: true, autoApprove: image.collection !== null });
      finished++;
    } catch (err) {
      failed++;
      // "Couldn't be read as an image" has already removed it; anything else may pass on a later try.
      if (image.add_attempts + 1 >= MAX_TRIES) {
        await giveUp(db, image.id, err instanceof Error ? err.message : "Couldn't finish adding this image.");
      }
    }
  }
  return { finished, removed, failed };
}

/** Clear an image's give-up so finishUnfinished, or a Retry, can try again. */
export async function resetUnfinished(db: SupabaseClient, imageId: string) {
  const { error } = await db
    .from("images")
    .update({ add_attempts: 0, add_tried_at: null, add_error: null })
    .eq("id", imageId);
  if (error) throw new Error(error.message);
}

async function originalArrived(db: SupabaseClient, path: string) {
  const slash = path.lastIndexOf("/");
  const { data } = await db.storage.from(BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1) });
  return Boolean(data?.some((f) => f.name === path.slice(slash + 1)));
}

async function giveUp(db: SupabaseClient, imageId: string, reason: string) {
  await db.from("images").update({ add_error: reason.slice(0, 500) }).eq("id", imageId).is("display_path", null);
}
