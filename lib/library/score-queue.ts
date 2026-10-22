import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anthropic,
  applyScores,
  buildScoreRequest,
  readAnswer,
  scoringContext,
  type ScoreOutcome,
  type ScoreRequest,
} from "./score";
import { recordClaude, sumUsage, type ClaudeUsage } from "@/lib/usage";

/**
 * Scoring many images at once (a Pinterest board, a rubric change) goes
 * through Anthropic's Message Batches API: half the price, results usually
 * within the hour. Images wait in `score_queue`; requests go out in batches
 * of BATCH_SIZE, and results are read back the next time anyone looks
 * (the library, the rubric page, the browser extension).
 */

const BATCH_SIZE = 100;
/** Send a part-full batch once its oldest image has waited this long. */
const SUBMIT_AFTER_MS = 2 * 60 * 1000;
/** How often to ask Anthropic whether a batch has finished. */
const CHECK_EVERY_MS = 60 * 1000;
/**
 * An imported image goes to Review when Claude's average confidence is below
 * this. Not any single dimension: Claude is told to give low confidence where
 * a dimension doesn't apply, which is normal.
 */
const FLAG_BELOW = 0.4;

export type QueueItem = { imageId: string; studioId: string; dimensions?: string[] | null; autoApprove?: boolean };

/** Add images to the queue. An image already waiting keeps its place. */
export async function enqueue(db: SupabaseClient, items: QueueItem[]) {
  if (!items.length) return;
  const { error } = await db.from("score_queue").upsert(
    items.map((i) => ({
      image_id: i.imageId,
      studio_id: i.studioId,
      dimensions: i.dimensions ?? null,
      auto_approve: i.autoApprove ?? false,
    })),
    { onConflict: "image_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Couldn't queue images for scoring: ${error.message}`);
}

/** How many images wait to be sent, and how many are with Claude now. */
export async function queueStatus(db: SupabaseClient, studioId: string) {
  const [waiting, scoring] = await Promise.all([
    db.from("score_queue").select("image_id", { count: "exact", head: true }).eq("studio_id", studioId).is("batch_id", null),
    db.from("score_queue").select("image_id", { count: "exact", head: true }).eq("studio_id", studioId).not("batch_id", "is", null),
  ]);
  return { waiting: waiting.count ?? 0, scoring: scoring.count ?? 0 };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
      }
    }),
  );
  return results;
}

const message = (err: unknown) => (err instanceof Error ? err.message : "Scoring failed").slice(0, 500);

/**
 * Send waiting images to the Batch API. A part-full batch waits a couple of
 * minutes for more images unless `force` is set (an import just finished).
 */
export async function submitQueued(
  db: SupabaseClient,
  studioId: string,
  { force = false, maxBatches = 2 }: { force?: boolean; maxBatches?: number } = {},
) {
  let submitted = 0;
  let context: Awaited<ReturnType<typeof scoringContext>> | null = null;

  // A request that died mid-send leaves its claim behind; free it after a while.
  await db
    .from("score_queue")
    .update({ batch_id: null, submitted_at: null })
    .eq("studio_id", studioId)
    .like("batch_id", "claim:%")
    .lt("submitted_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

  for (let round = 0; round < maxBatches; round++) {
    const { data: waiting, error } = await db
      .from("score_queue")
      .select("image_id, dimensions, queued_at")
      .eq("studio_id", studioId)
      .is("batch_id", null)
      .order("queued_at")
      .limit(BATCH_SIZE);
    if (error) throw new Error(error.message);
    if (!waiting?.length) break;
    const oldest = Date.parse(waiting[0].queued_at as string);
    if (!force && waiting.length < BATCH_SIZE && Date.now() - oldest < SUBMIT_AFTER_MS) break;

    // Claim the rows first, so two requests never send the same image twice.
    const claim = `claim:${randomUUID()}`;
    const { data: claimed } = await db
      .from("score_queue")
      .update({ batch_id: claim, submitted_at: new Date().toISOString() })
      .in(
        "image_id",
        waiting.map((w) => w.image_id as string),
      )
      .is("batch_id", null)
      .select("image_id, dimensions");
    if (!claimed?.length) break;

    try {
      context ??= await scoringContext(db, studioId);
      const ctx = context;
      const built = await mapLimit(claimed, 8, (row) =>
        buildScoreRequest(db, row.image_id as string, ctx, (row.dimensions as string[] | null) ?? null),
      );

      const requests: ScoreRequest[] = [];
      const broken: { id: string; error: string }[] = [];
      built.forEach((r, i) => {
        if (r.status === "fulfilled") requests.push(r.value);
        else broken.push({ id: claimed[i].image_id as string, error: message(r.reason) });
      });
      await Promise.all(
        broken.map(async (b) => {
          await db.from("images").update({ score_error: b.error }).eq("id", b.id);
          await db.from("score_queue").delete().eq("image_id", b.id);
        }),
      );
      if (!requests.length) continue;

      const batch = await anthropic().messages.batches.create({
        requests: requests.map((r) => ({ custom_id: r.imageId, params: r.params })),
      });
      await db.from("score_batches").insert({ id: batch.id, studio_id: studioId, request_count: requests.length });
      await Promise.all(
        requests.map((r) =>
          db.from("score_queue").update({ batch_id: batch.id, asked: r.keys }).eq("image_id", r.imageId),
        ),
      );
      submitted += requests.length;
    } catch (err) {
      // Put them back for the next try.
      await db.from("score_queue").update({ batch_id: null, submitted_at: null }).eq("batch_id", claim);
      throw err;
    }
  }
  return { submitted };
}

/** Read back finished batches: save scores, and decide where imported images go. */
export async function collectBatches(db: SupabaseClient, studioId: string, { force = false } = {}) {
  const { data: open, error } = await db
    .from("score_batches")
    .select("id, checked_at")
    .eq("studio_id", studioId)
    .is("ended_at", null)
    .order("created_at")
    .limit(3);
  if (error) throw new Error(error.message);

  let applied = 0;
  let failed = 0;
  const labels = await dimensionLabels(db, studioId);

  for (const b of open ?? []) {
    // Taking the check is also the lock: two pages open at once won't both read a batch.
    const cutoff = new Date(Date.now() - (force ? 5_000 : CHECK_EVERY_MS)).toISOString();
    const { data: mine } = await db
      .from("score_batches")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", b.id)
      .or(`checked_at.is.null,checked_at.lt.${cutoff}`)
      .select("id");
    if (!mine?.length) continue;
    const batch = await anthropic().messages.batches.retrieve(b.id as string);
    if (batch.processing_status !== "ended") continue;
    // Hold the lock while results are saved.
    await db
      .from("score_batches")
      .update({ checked_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
      .eq("id", b.id);

    const { data: rows } = await db
      .from("score_queue")
      .select("image_id, dimensions, asked, auto_approve")
      .eq("batch_id", b.id);
    const byId = new Map((rows ?? []).map((r) => [r.image_id as string, r]));

    const results: { id: string; outcome?: ScoreOutcome; error?: string; retry?: boolean }[] = [];
    const usage: ClaudeUsage[] = [];
    let model = "";
    for await (const item of await anthropic().messages.batches.results(b.id as string)) {
      if (item.result.type === "succeeded") {
        usage.push(item.result.message.usage);
        model ||= item.result.message.model;
      }
      results.push({ id: item.custom_id, ...(await readResult(db, item, byId.get(item.custom_id))) });
    }
    if (usage.length) {
      await recordClaude(db, {
        studioId,
        kind: "score_batch",
        model,
        usage: sumUsage(usage),
        images: usage.length,
        batch: true,
      });
    }

    await mapLimit(results, 6, async (r) => {
      const row = byId.get(r.id);
      if (!row) return;
      if (r.retry) {
        await db.from("score_queue").update({ batch_id: null, submitted_at: null, asked: null }).eq("image_id", r.id);
        return;
      }
      if (r.error) await db.from("images").update({ score_error: r.error }).eq("id", r.id);
      if (row.auto_approve) await settleImport(db, r.id, r.outcome, r.error, labels);
      await db.from("score_queue").delete().eq("image_id", r.id);
    });

    const ok = results.filter((r) => r.outcome).length;
    applied += ok;
    failed += results.length - ok;
    await db
      .from("score_batches")
      .update({ ended_at: new Date().toISOString(), succeeded: ok, failed: results.length - ok })
      .eq("id", b.id);
  }
  return { applied, failed };
}

type BatchItem = Awaited<ReturnType<ReturnType<typeof anthropic>["messages"]["batches"]["results"]>> extends AsyncIterable<infer I>
  ? I
  : never;

async function readResult(
  db: SupabaseClient,
  item: BatchItem,
  row: { dimensions: unknown; asked: unknown } | undefined,
): Promise<{ outcome?: ScoreOutcome; error?: string; retry?: boolean }> {
  if (!row) return {};
  const result = item.result;
  if (result.type === "expired" || result.type === "canceled") return { retry: true };
  if (result.type === "errored") return { error: `Scoring failed: ${result.error.error.message}`.slice(0, 500) };
  try {
    const keys = (row.asked as string[] | null) ?? [];
    const outcome = await applyScores(
      db,
      { imageId: item.custom_id, keys, full: row.dimensions === null },
      readAnswer(result.message),
    );
    return { outcome };
  } catch (err) {
    return { error: message(err) };
  }
}

async function dimensionLabels(db: SupabaseClient, studioId: string) {
  const { data } = await db.from("dimensions").select("key, left_label, right_label").eq("studio_id", studioId);
  return new Map((data ?? []).map((d) => [d.key as string, `${d.left_label} ↔ ${d.right_label}`]));
}

/** An imported image goes straight to the library unless something needs a person's eye. */
async function settleImport(
  db: SupabaseClient,
  imageId: string,
  outcome: ScoreOutcome | undefined,
  error: string | undefined,
  labels: Map<string, string>,
) {
  const { data: image } = await db.from("images").select("status, review_reason").eq("id", imageId).single();
  if (!image || image.status !== "pending") return;
  let reason = (image.review_reason as string | null) ?? null;
  if (!reason && error) reason = "Scoring failed";
  if (!reason && outcome?.averageConfidence !== null && outcome?.averageConfidence !== undefined && outcome.averageConfidence < FLAG_BELOW) {
    const least = outcome.leastSure ? labels.get(outcome.leastSure.key) ?? outcome.leastSure.key : null;
    reason = `Claude wasn't sure how to score it${least ? `, least of all ${least}` : ""}`;
  }
  await db
    .from("images")
    .update(reason ? { review_reason: reason } : { status: "approved", review_reason: null })
    .eq("id", imageId);
}

/** Collect finished batches, then send what's waiting. Safe to call often. */
export async function processQueue(db: SupabaseClient, studioId: string, { force = false } = {}) {
  const collected = await collectBatches(db, studioId, { force });
  const { submitted } = await submitQueued(db, studioId, { force });
  return { ...collected, submitted, ...(await queueStatus(db, studioId)) };
}
