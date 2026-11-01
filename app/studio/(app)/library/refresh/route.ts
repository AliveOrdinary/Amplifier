import { after, NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processQueue } from "@/lib/library/score-queue";
import { getImages, getImagesSince, libraryCounts } from "@/lib/library/queries";

export const maxDuration = 120;

/**
 * The library's refresh, every 15 seconds while it's open: new images (from
 * the extension or a phone), images still being scored, and the tab counts.
 *
 * A route, not a server action: the browser runs a page's server actions one
 * at a time, so a slow refresh used to hold up approvals queued behind it.
 */
export async function POST(request: NextRequest) {
  const member = await getMember();
  const body = (await request.json().catch(() => ({}))) as { since?: unknown; pending?: unknown };
  const since = typeof body.since === "string" ? body.since : "1970-01-01T00:00:00Z";
  const pending = Array.isArray(body.pending) ? body.pending.filter((id): id is string => typeof id === "string").slice(0, 50) : [];

  // While someone has the library open, read back finished batches and send waiting
  // images. One run at a time per studio; if one is going, this does nothing.
  after(() =>
    processQueue(createAdminClient(), member.studioId, { budgetMs: 60_000 }).catch((err) => console.error("queue processing failed", err)),
  );
  try {
    const db = await createClient();
    const [fresh, updated, counts] = await Promise.all([
      getImagesSince(db, member.studioId, since, 100),
      getImages(db, pending),
      libraryCounts(db, member.studioId),
    ]);
    const byId = new Map([...updated, ...fresh].map((image) => [image.id, image]));
    return NextResponse.json({ ok: true, images: [...byId.values()], counts });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't refresh." }, { status: 500 });
  }
}
