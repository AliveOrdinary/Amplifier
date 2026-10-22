"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MAX_DIMENSIONS } from "@/lib/library/constants";
import { dimensionKey, listDimensions, rubricRevision } from "@/lib/library/rubric";
import { scoreImage } from "@/lib/library/score";

type Fail = { ok: false; error: string };
const fail = (error: unknown): Fail => ({
  ok: false,
  error: error instanceof z.ZodError ? error.issues[0]?.message ?? "Check the form." : error instanceof Error ? error.message : "Something went wrong.",
});

/** Anchors per end of a dimension. More cost tokens without helping much. */
const MAX_ANCHORS = 3;

const DimensionInput = z.object({
  key: z.string().optional(),
  left: z.string().trim().min(1, "Name both ends.").max(24, "Keep names under 24 characters."),
  right: z.string().trim().min(1, "Name both ends.").max(24, "Keep names under 24 characters."),
  leftDefinition: z.string().trim().max(300, "Keep definitions under 300 characters."),
  rightDefinition: z.string().trim().max(300, "Keep definitions under 300 characters."),
});

const now = () => new Date().toISOString();

/**
 * Create a dimension, or change one. A change to its names or definitions
 * marks the library for rescoring and flags corrections made under the old
 * meaning, so they can be checked.
 */
export async function saveDimension(input: z.input<typeof DimensionInput>): Promise<{ ok: true; key: string } | Fail> {
  const member = await getMember();
  try {
    const d = DimensionInput.parse(input);
    const db = await createClient();
    const all = await listDimensions(db, member.studioId, { retired: true });

    if (!d.key) {
      if (all.filter((x) => !x.retiredAt).length >= MAX_DIMENSIONS) {
        throw new Error(`The rubric holds up to ${MAX_DIMENSIONS} dimensions. Retire one first.`);
      }
      const key = dimensionKey(d.left, d.right);
      const { error } = await db.from("dimensions").insert({
        key,
        studio_id: member.studioId,
        left_label: d.left,
        right_label: d.right,
        left_definition: d.leftDefinition,
        right_definition: d.rightDefinition,
        sort: Math.max(0, ...all.map((x) => x.sort)) + 1,
        revised_at: now(),
      });
      if (error) throw new Error(error.message);
      refresh();
      return { ok: true, key };
    }

    const current = all.find((x) => x.key === d.key);
    if (!current) throw new Error("That dimension no longer exists.");
    const changed =
      current.left !== d.left ||
      current.right !== d.right ||
      current.leftDefinition !== d.leftDefinition ||
      current.rightDefinition !== d.rightDefinition;
    if (!changed) return { ok: true, key: d.key };

    const { error } = await db
      .from("dimensions")
      .update({
        left_label: d.left,
        right_label: d.right,
        left_definition: d.leftDefinition,
        right_definition: d.rightDefinition,
        revised_at: now(),
      })
      .eq("key", d.key);
    if (error) throw new Error(error.message);

    await db.from("image_scores").update({ needs_check: true }).eq("dimension", d.key).eq("source", "human");
    refresh();
    return { ok: true, key: d.key };
  } catch (error) {
    return fail(error);
  }
}

/** Swap a dimension with its neighbour. */
export async function moveDimension(key: string, direction: -1 | 1): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    const active = await listDimensions(db, member.studioId);
    const index = active.findIndex((d) => d.key === key);
    const other = active[index + direction];
    if (index < 0 || !other) return { ok: true };
    const a = active[index];
    const results = await Promise.all([
      db.from("dimensions").update({ sort: other.sort }).eq("key", a.key),
      db.from("dimensions").update({ sort: a.sort }).eq("key", other.key),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Retired dimensions keep their scores but leave scoring, the library and briefs. */
export async function retireDimension(key: string, retire: boolean): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    if (!retire) {
      const active = await listDimensions(db, member.studioId);
      if (active.length >= MAX_DIMENSIONS) {
        throw new Error(`The rubric holds up to ${MAX_DIMENSIONS} dimensions. Retire one first.`);
      }
    }
    const { error } = await db
      .from("dimensions")
      .update(retire ? { retired_at: now() } : { retired_at: null, revised_at: now() })
      .eq("key", key)
      .eq("studio_id", member.studioId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addAnchor(key: string, imageId: string, side: "left" | "right"): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    if (side !== "left" && side !== "right") throw new Error("Unknown side.");
    const db = await createClient();
    const { count } = await db
      .from("dimension_anchors")
      .select("image_id", { count: "exact", head: true })
      .eq("dimension", key)
      .eq("side", side);
    if ((count ?? 0) >= MAX_ANCHORS) throw new Error(`Up to ${MAX_ANCHORS} anchors for each end.`);

    const { error } = await db
      .from("dimension_anchors")
      .upsert({ dimension: key, image_id: imageId, side }, { onConflict: "dimension,image_id" });
    if (error) throw new Error(error.message);
    await db.from("dimensions").update({ revised_at: now() }).eq("key", key).eq("studio_id", member.studioId);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeAnchor(key: string, imageId: string): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    const { error } = await db.from("dimension_anchors").delete().eq("dimension", key).eq("image_id", imageId);
    if (error) throw new Error(error.message);
    await db.from("dimensions").update({ revised_at: now() }).eq("key", key).eq("studio_id", member.studioId);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Images (not rejected) scored before the rubric last changed. */
async function staleImages(db: Awaited<ReturnType<typeof createClient>>, studioId: string, limit?: number) {
  const revision = rubricRevision(await listDimensions(db, studioId));
  let query = db
    .from("images")
    .select("id", { count: "exact" })
    .eq("studio_id", studioId)
    .neq("status", "rejected")
    .not("display_path", "is", null)
    .lt("scored_at", revision)
    .order("scored_at");
  if (limit) query = query.limit(limit);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { ids: (data ?? []).map((r) => r.id as string), count: count ?? 0 };
}

/**
 * Rescore a few out-of-date images. The rubric page calls this in a loop
 * while it's open, so a large library doesn't hit a time limit.
 */
export async function rescoreStale(): Promise<{ ok: true; remaining: number; failed: number } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    const { ids } = await staleImages(db, member.studioId, 4);
    const results = await Promise.allSettled(ids.map((id) => scoreImage(db, id)));
    const failed = results.filter((r) => r.status === "rejected");
    // A failed image is marked scored with its error, so the loop moves on.
    await Promise.all(
      ids.map((id, i) =>
        results[i].status === "rejected"
          ? db
              .from("images")
              .update({ scored_at: now(), score_error: String((results[i] as PromiseRejectedResult).reason?.message ?? "Scoring failed") })
              .eq("id", id)
          : null,
      ),
    );
    const { count } = await staleImages(db, member.studioId);
    return { ok: true, remaining: count, failed: failed.length };
  } catch (error) {
    return fail(error);
  }
}
