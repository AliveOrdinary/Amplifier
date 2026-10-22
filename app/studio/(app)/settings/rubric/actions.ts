"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MAX_DIMENSIONS } from "@/lib/library/constants";
import { dimensionKey, listDimensions } from "@/lib/library/rubric";
import { scoreImage } from "@/lib/library/score";
import { enqueue, submitQueued } from "@/lib/library/score-queue";

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

type Db = Awaited<ReturnType<typeof createClient>>;

/** Images with dimensions changed since Claude scored them, and which dimensions. */
async function staleImages(db: Db, studioId: string, limit: number) {
  const { data, error } = await db.rpc("stale_scores", { p_studio: studioId, p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { image_id: string; dimensions: string[] }[]).map((r) => ({ id: r.image_id, dimensions: r.dimensions }));
}

async function staleCount(db: Db, studioId: string) {
  const { data, error } = await db.rpc("stale_score_count", { p_studio: studioId });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/**
 * Rescore a few out-of-date images now, only on the dimensions that changed.
 * The rubric page calls this in a loop while it's open.
 */
export async function rescoreStale(): Promise<{ ok: true; remaining: number; failed: number } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    const stale = await staleImages(db, member.studioId, 4);
    const results = await Promise.allSettled(stale.map((s) => scoreImage(db, s.id, { only: s.dimensions })));
    const failed = results.filter((r) => r.status === "rejected");
    // A failed image keeps its old scores and its error, so the loop moves on.
    await Promise.all(
      stale.map(async (s, i) => {
        const r = results[i];
        if (r.status !== "rejected") return;
        await db
          .from("image_scores")
          .update({ ai_scored_at: now() })
          .eq("image_id", s.id)
          .in("dimension", s.dimensions);
        await db
          .from("images")
          .update({ score_error: String((r.reason as Error | undefined)?.message ?? "Scoring failed").slice(0, 500) })
          .eq("id", s.id);
      }),
    );
    return { ok: true, remaining: await staleCount(db, member.studioId), failed: failed.length };
  } catch (error) {
    return fail(error);
  }
}

/** Queue every out-of-date image for rescoring through the Batch API (half price). */
export async function queueStale(): Promise<{ ok: true; queued: number } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    let queued = 0;
    for (let round = 0; round < 50; round++) {
      const stale = await staleImages(db, member.studioId, 1000);
      if (!stale.length) break;
      await enqueue(
        db,
        stale.map((s) => ({ imageId: s.id, studioId: member.studioId, dimensions: s.dimensions })),
      );
      queued += stale.length;
    }
    await submitQueued(db, member.studioId, { force: true });
    refresh();
    return { ok: true, queued };
  } catch (error) {
    return fail(error);
  }
}
