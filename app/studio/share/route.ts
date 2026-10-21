import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ingestBytes, IngestError } from "@/lib/library/pipeline";
import { fetchRemoteImage, RemoteFetchError } from "@/lib/library/fetch-remote";

export const maxDuration = 120;

/**
 * Share target for the installed studio app (Android). The phone's share
 * sheet posts an image file, or a link (e.g. a Pinterest pin) as `url` or
 * inside `text`. Adds it to the library, then opens the library.
 */
export async function POST(request: NextRequest) {
  const member = await getMember();
  const form = await request.formData().catch(() => null);
  const back = (outcome: string) =>
    NextResponse.redirect(new URL(`/studio/library?shared=${outcome}`, request.url), 303);
  if (!form) return back("error");

  const file = form.get("file");
  const link = firstLink(form.get("url"), form.get("text"));
  const db = await createClient();

  try {
    if (file instanceof File && file.size > 0) {
      await ingestBytes(db, {
        studioId: member.studioId,
        addedBy: member.userId,
        bytes: Buffer.from(await file.arrayBuffer()),
        mime: file.type,
        name: file.name || "shared image",
        sourceUrl: link,
      });
    } else if (link) {
      const remote = await fetchRemoteImage(link);
      await ingestBytes(db, {
        studioId: member.studioId,
        addedBy: member.userId,
        bytes: remote.bytes,
        mime: remote.mime,
        name: remote.name,
        sourceUrl: remote.sourceUrl,
        pageUrl: remote.pageUrl,
      });
    } else {
      return back("nothing");
    }
    return back("added");
  } catch (error) {
    if (!(error instanceof IngestError || error instanceof RemoteFetchError)) console.error("share failed", error);
    return back("error");
  }
}

function firstLink(...values: Array<FormDataEntryValue | null>) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const match = value.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }
  return null;
}
