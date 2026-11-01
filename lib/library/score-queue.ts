import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anthropic,
  applyScores,
  buildScoreRequest,
  readAnswer,
  scoringContext,
  signedLinks,
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
/**
 * Without the lease (before migration 17): images picked up by a run that was
 * cut off are freed after this. With it, a run frees them at once, since only
 * one run can be going.
 */
const CLAIM_EXPIRES_MS = 3 * 60 * 1000;
/** Time limits on Anthropic calls, so a slow one fails (and is retried next run) instead of hanging. */
const SEND_TIMEOUT_MS = 60_000;
const CHECK_TIMEOUT_MS = 20_000;
const RESULTS_TIMEOUT_MS = 60_000;
/** The default time a run may take: well inside the 120 seconds a page or route gets. */
const DEFAULT_BUDGET_MS = 60_000;
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
  {
    force = false,
    maxBatches = 2,
    deadline = Date.now() + DEFAULT_BUDGET_MS,
    leased = false,
  }: { force?: boolean; maxBatches?: number; deadline?: number; leased?: boolean } = {},
) {
  let submitted = 0;
  let context: Awaited<ReturnType<typeof scoringContext>> | null = null;

  // A run that was cut off leaves its images picked up but never sent. Holding
  // the lease means no other run is going, so they can all go back now.
  let free = db.from("score_queue").update({ batch_id: null, submitted_at: null }).eq("studio_id", studioId).like("batch_id", "claim:%");
  if (!leased) free = free.lt("submitted_at", new Date(Date.now() - CLAIM_EXPIRES_MS).toISOString());
  await free;

  for (let round = 0; round < maxBatches; round++) {
    // Leave time to finish cleanly: packing and sending a batch takes a few seconds, sending can take up to a minute.
    if (Date.now() > deadline - SEND_TIMEOUT_MS) break;
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
      context ??= await scoringContext(db, studioId, { links: true });
      const ctx = context;
      // Links Claude fetches itself, signed in one go: nothing to download here.
      const { data: files, error: filesError } = await db
        .from("images")
        .select("id, display_path")
        .in(
          "id",
          claimed.map((c) => c.image_id as string),
        );
      if (filesError) throw new Error(filesError.message);
      const pathOf = new Map((files ?? []).map((f) => [f.id as string, f.display_path as string | null]));
      const links = await signedLinks(db, [...pathOf.values()].filter((p): p is string => Boolean(p)));
      const built = await mapLimit(claimed, 8, async (row) => {
        const link = links.get(pathOf.get(row.image_id as string) ?? "");
        if (!link) throw new Error("The image hasn't been processed yet.");
        return buildScoreRequest(db, row.image_id as string, ctx, (row.dimensions as string[] | null) ?? null, link);
      });

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

      const batch = await anthropic().messages.batches.create(
        { requests: requests.map((r) => ({ custom_id: r.imageId, params: r.params })) },
        { timeout: SEND_TIMEOUT_MS, maxRetries: 0 },
      );
      // Record it before anything else. If that fails, cancel it: a batch we can't
      // read back would be paid for and then sent again.
      const { error: recordError } = await db
        .from("score_batches")
        .insert({ id: batch.id, studio_id: studioId, request_count: requests.length });
      if (recordError) {
        await anthropic()
          .messages.batches.cancel(batch.id, {}, { timeout: CHECK_TIMEOUT_MS })
          .catch((err) => console.error("couldn't cancel an unrecorded batch", batch.id, err));
        throw new Error(`Couldn't record the batch: ${recordError.message}`);
      }
      // Mark the images as sent, a few updates instead of one per image (most ask for the same dimensions).
      const byKeys = new Map<string, { keys: string[]; ids: string[] }>();
      for (const r of requests) {
        const k = r.keys.join(",");
        const group = byKeys.get(k) ?? { keys: r.keys, ids: [] };
        group.ids.push(r.imageId);
        byKeys.set(k, group);
      }
      for (const group of byKeys.values()) {
        const { error: markError } = await db.from("score_queue").update({ batch_id: batch.id, asked: group.keys }).in("image_id", group.ids);
        if (markError) console.error("couldn't mark images as sent", batch.id, markError.message);
      }
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
export async function collectBatches(
  db: SupabaseClient,
  studioId: string,
  { force = false, deadline = Date.now() + DEFAULT_BUDGET_MS }: { force?: boolean; deadline?: number } = {},
) {
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
    // Reading a finished batch back takes a while; don't start one without time to finish it.
    if (Date.now() > deadline - RESULTS_TIMEOUT_MS) break;
    // Taking the check is also the lock: two pages open at once won't both read a batch.
    const cutoff = new Date(Date.now() - (force ? 5_000 : CHECK_EVERY_MS)).toISOString();
    const { data: mine } = await db
      .from("score_batches")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", b.id)
      .or(`checked_at.is.null,checked_at.lt.${cutoff}`)
      .select("id");
    if (!mine?.length) continue;
    const batch = await anthropic().messages.batches.retrieve(b.id as string, {}, { timeout: CHECK_TIMEOUT_MS, maxRetries: 0 });
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
    for await (const item of await anthropic().messages.batches.results(b.id as string, {}, { timeout: RESULTS_TIMEOUT_MS, maxRetries: 0 })) {
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

let leaseMissing = false;

/**
 * Collect finished batches, then send what's waiting. Safe to call often:
 * only one run per studio goes at a time (the lease, migration 17); anyone
 * else who calls meanwhile just gets the queue's status. `budgetMs` is how
 * long this run may take; keep it well inside the caller's time limit.
 */
export async function processQueue(
  db: SupabaseClient,
  studioId: string,
  { force = false, budgetMs = DEFAULT_BUDGET_MS }: { force?: boolean; budgetMs?: number } = {},
) {
  const deadline = Date.now() + budgetMs;
  const holder = randomUUID();
  let leased = false;
  if (!leaseMissing) {
    const { data, error } = await db.rpc("take_score_run", {
      p_studio: studioId,
      p_holder: holder,
      // The lease outlasts the run's own budget, so a run that's cut off still lets go soon after.
      p_seconds: Math.ceil(budgetMs / 1000) + 30,
    });
    if (error && /take_score_run|PGRST202|42883/.test(`${error.code} ${error.message}`)) {
      leaseMissing = true;
      console.warn("Scoring runs aren't locked yet: apply supabase/migrations/…17_score_runs.sql.");
    } else if (error) {
      throw new Error(error.message);
    } else if (!data) {
      return { applied: 0, failed: 0, submitted: 0, busy: true, ...(await queueStatus(db, studioId)) };
    } else {
      leased = true;
    }
  }
  try {
    const collected = await collectBatches(db, studioId, { force, deadline });
    const { submitted } = await submitQueued(db, studioId, { force, deadline, leased });
    return { ...collected, submitted, busy: false, ...(await queueStatus(db, studioId)) };
  } finally {
    if (leased) await db.rpc("end_score_run", { p_studio: studioId, p_holder: holder });
  }
}
