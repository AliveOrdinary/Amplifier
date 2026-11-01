import { NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { embedByIds, embeddingsEnabled } from "@/lib/library/embed";

export const maxDuration = 60;

/**
 * Embed a few images that don't have one yet; the library calls this quietly
 * after it opens. A route rather than a server action, so it never holds up
 * approvals (the browser runs a page's server actions one at a time).
 */
export async function POST() {
  const member = await getMember();
  try {
    if (!embeddingsEnabled()) return NextResponse.json({ ok: true, remaining: 0 });
    const db = await createClient();
    const missing = () =>
      db
        .from("images")
        .select("id", { count: "exact" })
        .eq("studio_id", member.studioId)
        .is("embedding", null)
        .or("embed_error.is.null,embed_error.like.Voyage returned 429*")
        .not("thumb_path", "is", null)
        .order("created_at")
        .limit(8);
    const { data, error } = await missing();
    if (error) throw new Error(error.message);
    await embedByIds(db, (data ?? []).map((r) => r.id as string), member.studioId);
    const { count } = await missing();
    return NextResponse.json({ ok: true, remaining: count ?? 0 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't embed." }, { status: 500 });
  }
}
