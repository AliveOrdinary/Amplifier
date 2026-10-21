import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestBytes, IngestError } from "@/lib/library/pipeline";
import { fetchRemoteImage, RemoteFetchError } from "@/lib/library/fetch-remote";

// Images are resized and scored before the response is sent.
export const maxDuration = 120;

/**
 * Endpoint for the Amplifier browser extension. Authenticated with a member's
 * personal key (Authorization: Bearer amp_…), created in Studio > Library.
 *
 * GET  checks a key.
 * POST multipart: `file` (the image bytes) and/or `url` (the image's address),
 *      plus optional `pageUrl` (the page it was found on).
 */
export async function GET(request: NextRequest) {
  const member = await authenticate(request);
  if (!member) return unauthorized();
  return NextResponse.json({ ok: true, studio: member.studioName });
}

export async function POST(request: NextRequest) {
  const member = await authenticate(request);
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
  const admin = createAdminClient();

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
      });
    } else {
      return NextResponse.json({ ok: false, error: "No image was sent." }, { status: 400 });
    }
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

async function authenticate(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!/^amp_[A-Za-z0-9_-]{20,}$/.test(key)) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("member_keys")
    .select("id, user_id, studio_id")
    .eq("key_hash", createHash("sha256").update(key).digest("hex"))
    .is("revoked_at", null)
    .maybeSingle();
  if (!row) return null;

  // The key only works while its owner is still a member of that studio.
  const { data: member } = await admin
    .from("members")
    .select("studio_id, studios ( name )")
    .eq("user_id", row.user_id)
    .eq("studio_id", row.studio_id)
    .maybeSingle();
  if (!member) return null;

  await admin.from("member_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  const studio = member.studios as unknown as { name: string } | null;
  return { userId: row.user_id as string, studioId: row.studio_id as string, studioName: studio?.name ?? "Studio" };
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "That key isn't valid. Create a new one in Studio > Library." },
    { status: 401 },
  );
}

function stringField(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 2000) : null;
}
