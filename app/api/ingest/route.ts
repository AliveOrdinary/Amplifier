import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateKey, unauthorized } from "@/lib/library/member-key";
import { ingestBytes, IngestError } from "@/lib/library/pipeline";
import { fetchRemoteImage, RemoteFetchError } from "@/lib/library/fetch-remote";
import { submitQueued } from "@/lib/library/score-queue";

// Images are resized and scored before the response is sent.
export const maxDuration = 120;

/**
 * Endpoint for the Amplifier browser extension. Authenticated with a member's
 * personal key (Authorization: Bearer amp_…), created in Studio > Library.
 *
 * GET  checks a key.
 * POST multipart: `file` (the image bytes) and/or `url` (the image's address),
 *      plus optional `pageUrl` (the page it was found on). A board import also
 *      sends `board` (the board's name) and `queue=1`: the image is scored later
 *      through the Batch API and goes straight to the library unless flagged.
 */
export async function GET(request: NextRequest) {
  const member = await authenticateKey(request);
  if (!member) return unauthorized();
  return NextResponse.json({ ok: true, studio: member.studioName });
}

export async function POST(request: NextRequest) {
  const member = await authenticateKey(request);
  if (!member) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Send the image as multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  const url = stringField(form.get("url"));
  const pageUrl = stringField(form.get("pageUrl"));
  const board = stringField(form.get("board"))?.slice(0, 80) ?? null;
  const queue = form.get("queue") === "1";
  const collection = board ? `${member.name} · ${board}` : null;
  const admin = createAdminClient();
  const later = { collection, queue, autoApprove: queue };

  try {
    let result;
    if (file instanceof File && file.size > 0) {
      result = await ingestBytes(admin, {
        studioId: member.studioId,
        addedBy: member.userId,
        bytes: Buffer.from(await file.arrayBuffer()),
        mime: file.type,
        name: file.name || "image",
        sourceUrl: url,
        pageUrl,
        ...later,
      });
    } else if (url) {
      const remote = await fetchRemoteImage(url);
      result = await ingestBytes(admin, {
        studioId: member.studioId,
        addedBy: member.userId,
        bytes: remote.bytes,
        mime: remote.mime,
        name: remote.name,
        sourceUrl: remote.sourceUrl,
        pageUrl: pageUrl ?? remote.pageUrl,
        ...later,
      });
    } else {
      return NextResponse.json({ ok: false, error: "No image was sent." }, { status: 400 });
    }
    // Full batches go out as soon as there are enough; the rest when the import ends.
    if (queue) after(() => submitQueued(admin, member.studioId).catch((err) => console.error("batch submit failed", err)));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const known = error instanceof IngestError || error instanceof RemoteFetchError;
    if (!known) console.error("ingest failed", error);
    return NextResponse.json(
      { ok: false, error: known ? (error as Error).message : "Something went wrong adding that image." },
      { status: known ? 422 : 500 },
    );
  }
}

function stringField(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 2000) : null;
}
