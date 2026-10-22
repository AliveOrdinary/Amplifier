import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processQueue } from "@/lib/library/score-queue";

export const maxDuration = 300;

/** Stop starting new work after this, so the run ends cleanly within its time limit. */
const BUDGET_MS = 240_000;

/**
 * Once a day (vercel.json, around 09:00 UTC): read back finished scoring
 * batches and send anything still waiting, for every studio. A safety net:
 * the library, the rubric page and board imports already do this whenever
 * someone is around. Vercel calls it with `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const started = Date.now();
  const db = createAdminClient();
  const [queued, open] = await Promise.all([
    db.from("score_queue").select("studio_id"),
    db.from("score_batches").select("studio_id").is("ended_at", null),
  ]);
  const studios = [...new Set([...(queued.data ?? []), ...(open.data ?? [])].map((r) => r.studio_id as string))];

  const results: Record<string, unknown> = {};
  for (const studio of studios) {
    // A few rounds: each reads back up to three batches and sends up to two.
    for (let round = 0; round < 5 && Date.now() - started < BUDGET_MS; round++) {
      try {
        const r = await processQueue(db, studio, { force: true });
        results[studio] = r;
        if (!r.applied && !r.submitted) break;
      } catch (error) {
        console.error("daily scoring check failed", studio, error);
        results[studio] = { error: error instanceof Error ? error.message : "failed" };
        break;
      }
    }
  }
  return Response.json({ ok: true, studios: studios.length, results });
}
