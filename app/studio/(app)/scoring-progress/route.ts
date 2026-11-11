import { after, NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processQueue, scoringProgress } from "@/lib/library/score-queue";

export const maxDuration = 120;

/**
 * The studio menu asks this about once a minute. While anything is being
 * scored it also starts a run (one per studio at a time), so scores come back
 * whenever someone has any studio page open, not only the library. Checking
 * with Anthropic costs nothing.
 *
 * A route rather than a server action, so it never holds up approvals.
 */
export async function GET() {
  const member = await getMember();
  try {
    const progress = await scoringProgress(await createClient(), member.studioId);
    if (progress.waiting || progress.packing || progress.batches.length) {
      after(() =>
        processQueue(createAdminClient(), member.studioId, { budgetMs: 60_000 }).catch((err) => console.error("queue processing failed", err)),
      );
    }
    return NextResponse.json({ ok: true, progress }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't check." }, { status: 500 });
  }
}
