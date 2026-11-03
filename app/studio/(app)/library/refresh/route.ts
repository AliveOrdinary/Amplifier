import { after, NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processQueue, scoringProgress } from "@/lib/library/score-queue";
import { getImages, getImagesSince, libraryCounts, stuckImages } from "@/lib/library/queries";
import { finishUnfinished } from "@/lib/library/unfinished";

export const maxDuration = 120;

/**
 * The library's refresh, every 15 seconds while it's open: new images (from
 * the extension or a phone), images still being scored, the tab counts and
 * any images that couldn't be added.
 *
 * A route, not a server action: the browser runs a page's server actions one
 * at a time, so a slow refresh used to hold up approvals queued behind it.
 */
export async function POST(request: NextRequest) {
  const member = await getMember();
  const body = (await request.json().catch(() => ({}))) as { since?: unknown; pending?: unknown };
  const since = typeof body.since === "string" ? body.since : "1970-01-01T00:00:00Z";
  const pending = Array.isArray(body.pending) ? body.pending.filter((id): id is string => typeof id === "string").slice(0, 50) : [];

  try {
    const db = await createClient();
    const [fresh, updated, counts, progress] = await Promise.all([
      getImagesSince(db, member.studioId, since, 100),
      getImages(db, pending),
      libraryCounts(db, member.studioId),
      scoringProgress(db, member.studioId),
    ]);
    // Only while there's scoring to do: read back finished batches and send waiting
    // images (one run at a time per studio). With nothing queued this costs nothing.
    if (progress.waiting || progress.packing || progress.batches.length) {
      after(() =>
        processQueue(createAdminClient(), member.studioId, { budgetMs: 60_000 }).catch((err) => console.error("queue processing failed", err)),
      );
    }
    // Images whose adding was cut off part-way: try again (lib/library/unfinished.ts).
    if (counts.unfinished) {
      after(() =>
        finishUnfinished(createAdminClient(), member.studioId, { deadline: Date.now() + 60_000 }).catch((err) =>
          console.error("couldn't finish stranded images", err),
        ),
      );
    }
    const stuck = counts.stuck ? await stuckImages(db, member.studioId) : [];
    const byId = new Map([...updated, ...fresh].map((image) => [image.id, image]));
    return NextResponse.json({ ok: true, images: [...byId.values()], counts, progress, stuck });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't refresh." }, { status: 500 });
  }
}
