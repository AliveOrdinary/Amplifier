import "server-only";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scorePicture, scoringContext } from "@/lib/library/score";
import { PORTFOLIO_BUCKET } from "./blocks";

/**
 * Portfolio pictures on the studio's rubric, for the Work page's mix.
 *
 * Claude scores each picture with the library's rubric, anchors and
 * corrections (scorePicture), one at a time rather than in a batch: a project
 * has a few dozen pictures at most, and the studio is waiting on the page.
 * Scores land in project_media.scores; the studio's corrections live in
 * score_edits and are never overwritten. Videos aren't scored (read.ts gives
 * them their project's average).
 */

/** Long side sent to Claude. The originals run to 8000px; the look survives at this size. */
const SCORE_SIDE = 1024;
/** Pictures scored at once. */
const AT_ONCE = 3;
/** One picture takes a few seconds; leave room to finish the ones in hand. */
const NEEDS_MS = 20_000;

type Waiting = { id: string; storage_path: string };

/** The project's pictures Claude hasn't scored (and hasn't failed on). */
async function waiting(db: SupabaseClient, projectId: string) {
  const { data, error } = await db
    .from("project_media")
    .select("id, storage_path")
    .eq("project_id", projectId)
    .eq("kind", "image")
    .is("scored_at", null)
    .is("score_error", null)
    .order("sort")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Waiting[];
}

/** Forget Claude's scores for the project (not the studio's corrections), so everything is scored again. */
export async function clearScores(db: SupabaseClient, projectId: string, { failedOnly = false } = {}) {
  let query = db.from("project_media").update({ scored_at: null, score_error: null }).eq("project_id", projectId).eq("kind", "image");
  if (failedOnly) query = query.not("score_error", "is", null);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

/**
 * Score what's waiting, until `deadline`. Returns how many were scored, how
 * many Claude couldn't do, and how many are still waiting (call again).
 */
export async function scoreProject(db: SupabaseClient, studioId: string, projectId: string, { deadline }: { deadline: number }) {
  const queue = await waiting(db, projectId);
  if (!queue.length) return { scored: 0, failed: 0, left: 0 };
  const context = await scoringContext(db, studioId);

  let scored = 0;
  let failed = 0;
  const one = async (media: Waiting) => {
    try {
      const file = await db.storage.from(PORTFOLIO_BUCKET).download(media.storage_path);
      if (file.error) throw new Error("Couldn't read the picture.");
      const webp = await sharp(Buffer.from(await file.data.arrayBuffer()), { animated: false })
        .rotate()
        .resize(SCORE_SIDE, SCORE_SIDE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      const scores = await scorePicture(db, context, webp);
      const { error } = await db
        .from("project_media")
        .update({ scores, scored_at: new Date().toISOString(), score_error: null })
        .eq("id", media.id);
      if (error) throw new Error(error.message);
      scored++;
    } catch (err) {
      failed++;
      const reason = err instanceof Error ? err.message : "Couldn't score this picture.";
      await db.from("project_media").update({ score_error: reason.slice(0, 300) }).eq("id", media.id);
    }
  };

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(AT_ONCE, queue.length) }, async () => {
      while (next < queue.length && Date.now() + NEEDS_MS < deadline) await one(queue[next++]);
    }),
  );
  return { scored, failed, left: queue.length - scored - failed };
}
