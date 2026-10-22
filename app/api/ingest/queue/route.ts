import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateKey, unauthorized } from "@/lib/library/member-key";
import { processQueue, queueStatus } from "@/lib/library/score-queue";

export const maxDuration = 120;

/**
 * Board imports, from the browser extension.
 * GET  how many images wait to be scored, and how many are being scored.
 * POST the import is done: send everything waiting now, and read back any
 *      batches that have finished.
 */
export async function GET(request: NextRequest) {
  const member = await authenticateKey(request);
  if (!member) return unauthorized();
  return NextResponse.json({ ok: true, ...(await queueStatus(createAdminClient(), member.studioId)) });
}

export async function POST(request: NextRequest) {
  const member = await authenticateKey(request);
  if (!member) return unauthorized();
  try {
    const result = await processQueue(createAdminClient(), member.studioId, { force: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("queue processing failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't send the images for scoring. They'll go with the next batch." }, { status: 500 });
  }
}
