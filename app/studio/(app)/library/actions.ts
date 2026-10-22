"use server";

import { randomUUID } from "node:crypto";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MEDIUM_KEYS, clampScore } from "@/lib/library/constants";
import {
  assertAcceptable,
  extensionFor,
  finishImage,
  ingestBytes,
  IngestError,
  removeImage,
  type IngestResult,
} from "@/lib/library/pipeline";
import { fetchRemoteImage, RemoteFetchError } from "@/lib/library/fetch-remote";
import { scoreImage } from "@/lib/library/score";
import { embedByIds, embeddingsEnabled, similarImages } from "@/lib/library/embed";
import { getImages, getImagesSince } from "@/lib/library/queries";
import type { ImageStatus, LibraryImage } from "@/lib/library/types";

type Fail = { ok: false; error: string };
const fail = (error: unknown, fallback = "Something went wrong."): Fail => ({
  ok: false,
  error: error instanceof IngestError || error instanceof RemoteFetchError || error instanceof Error ? error.message : fallback,
});

export type AddResult =
  | { ok: true; status: "duplicate"; image: LibraryImage | null }
  | { ok: true; status: "added"; image: LibraryImage | null; nearDuplicate: boolean; scored: boolean }
  | Fail;

async function withImage(db: Awaited<ReturnType<typeof createClient>>, result: IngestResult): Promise<AddResult> {
  const [image] = await getImages(db, [result.imageId]);
  return result.status === "duplicate"
    ? { ok: true, status: "duplicate", image: image ?? null }
    : { ok: true, status: "added", image: image ?? null, nearDuplicate: result.nearDuplicates.length > 0, scored: result.scored };
}

/* ------------------------------------------------------------------ Adding */

export type PreparedUpload =
  | { ok: true; status: "ready"; imageId: string; path: string; token: string }
  | { ok: true; status: "duplicate"; imageId: string }
  | Fail;

/** Step 1 of a browser upload: reserve a row and a signed upload URL. */
export async function prepareUpload(file: { name: string; type: string; size: number; sha256: string }): Promise<PreparedUpload> {
  const member = await getMember();
  try {
    assertAcceptable(file.type, file.size);
    if (!/^[0-9a-f]{64}$/.test(file.sha256)) throw new IngestError("Invalid file fingerprint.");
    const db = await createClient();

    const { data: existing } = await db
      .from("images")
      .select("id")
      .eq("studio_id", member.studioId)
      .eq("file_hash", file.sha256)
      .maybeSingle();
    if (existing) return { ok: true, status: "duplicate", imageId: existing.id };

    const imageId = randomUUID();
    const path = `${member.studioId}/${imageId}/original.${extensionFor(file.type)}`;
    const insert = await db.from("images").insert({
      id: imageId,
      studio_id: member.studioId,
      storage_path: path,
      original_name: file.name.slice(0, 200),
      mime_type: file.type,
      bytes: file.size,
      file_hash: file.sha256,
    });
    if (insert.error) throw new IngestError(insert.error.message);

    const signed = await db.storage.from("library").createSignedUploadUrl(path);
    if (signed.error) throw new IngestError(signed.error.message);
    return { ok: true, status: "ready", imageId, path, token: signed.data.token };
  } catch (error) {
    return fail(error);
  }
}

/** Step 2: the file is in storage; resize, check for near-duplicates, score. */
export async function finishUpload(imageId: string): Promise<AddResult> {
  await getMember();
  try {
    const db = await createClient();
    return await withImage(db, await finishImage(db, imageId));
  } catch (error) {
    return fail(error);
  }
}

/** Cancel a reserved upload that never arrived. */
export async function abandonUpload(imageId: string) {
  const member = await getMember();
  await removeImage(await createClient(), imageId, member.studioId);
}

/** Add an image from a link: a direct image URL, or a page with a preview image. */
export async function addFromLink(url: string): Promise<AddResult> {
  const member = await getMember();
  try {
    const remote = await fetchRemoteImage(url);
    const db = await createClient();
    const result = await ingestBytes(db, {
      studioId: member.studioId,
      addedBy: member.userId,
      bytes: remote.bytes,
      mime: remote.mime,
      name: remote.name,
      sourceUrl: remote.sourceUrl,
      pageUrl: remote.pageUrl,
    });
    return await withImage(db, result);
  } catch (error) {
    return fail(error);
  }
}

/** New images (from the extension or a phone) and updates to ones still being scored. */
export async function pollImages(since: string, pendingIds: string[]): Promise<{ ok: true; images: LibraryImage[] } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    const [fresh, updated] = await Promise.all([
      getImagesSince(db, member.studioId, since),
      getImages(db, pendingIds.slice(0, 50)),
    ]);
    const byId = new Map([...updated, ...fresh].map((image) => [image.id, image]));
    return { ok: true, images: [...byId.values()] };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- Reviewing */

export async function rescore(imageId: string): Promise<{ ok: true; image: LibraryImage | null } | Fail> {
  await getMember();
  try {
    const db = await createClient();
    await scoreImage(db, imageId);
    const [image] = await getImages(db, [imageId]);
    return { ok: true, image: image ?? null };
  } catch (error) {
    return fail(error);
  }
}

export async function saveScore(imageId: string, dimension: string, score: number): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const db = await createClient();
    const { data: known } = await db
      .from("dimensions")
      .select("key")
      .eq("studio_id", member.studioId)
      .eq("key", dimension)
      .is("retired_at", null)
      .maybeSingle();
    if (!known) throw new Error("Unknown dimension.");

    // Keep Claude's score so the correction can teach future scoring.
    const { data: current } = await db
      .from("image_scores")
      .select("score, source, ai_score")
      .eq("image_id", imageId)
      .eq("dimension", dimension)
      .maybeSingle();
    const aiScore = current ? (current.source === "ai" ? current.score : current.ai_score) : null;

    const { error } = await db.from("image_scores").upsert(
      {
        image_id: imageId,
        dimension,
        score: clampScore(score),
        source: "human",
        confidence: null,
        ai_score: aiScore,
        needs_check: false,
      },
      { onConflict: "image_id,dimension" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setStatus(imageId: string, status: ImageStatus): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    if (!["pending", "approved", "rejected"].includes(status)) throw new Error("Unknown status.");
    const db = await createClient();
    const { error } = await db.from("images").update({ status }).eq("id", imageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setMedium(imageId: string, medium: string): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    if (!(MEDIUM_KEYS as string[]).includes(medium)) throw new Error("Unknown medium.");
    const db = await createClient();
    const { error } = await db.from("images").update({ medium }).eq("id", imageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteImage(imageId: string): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    await removeImage(await createClient(), imageId, member.studioId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- Similarity */

/**
 * Embed a few images added before embeddings existed (or whose embedding
 * failed earlier). The library calls this quietly in a loop when it opens.
 */
export async function embedMissing(): Promise<{ ok: true; remaining: number } | Fail> {
  const member = await getMember();
  try {
    if (!embeddingsEnabled()) return { ok: true, remaining: 0 };
    const db = await createClient();
    const missing = () =>
      db
        .from("images")
        .select("id", { count: "exact" })
        .eq("studio_id", member.studioId)
        .is("embedding", null)
        .is("embed_error", null)
        .not("display_path", "is", null)
        .order("created_at")
        .limit(8);
    const { data, error } = await missing();
    if (error) throw new Error(error.message);
    await embedByIds(db, (data ?? []).map((r) => r.id as string));
    const { count } = await missing();
    return { ok: true, remaining: count ?? 0 };
  } catch (error) {
    return fail(error);
  }
}

/** Images that look most like this one, closest first. */
export async function findSimilar(imageId: string): Promise<{ ok: true; ids: string[] } | Fail> {
  await getMember();
  try {
    const db = await createClient();
    const { data: image, error } = await db.from("images").select("embedded_at, embed_error").eq("id", imageId).maybeSingle();
    if (error) {
      throw new Error(
        /embedded_at|embed_error/.test(error.message)
          ? "Similarity needs the embeddings migration (07) to be run in Supabase."
          : error.message,
      );
    }
    if (image?.embed_error) throw new Error(`Couldn't analyse this image: ${image.embed_error}`);
    if (!embeddingsEnabled()) throw new Error("Similarity needs VOYAGE_API_KEY in Vercel.");
    if (!image?.embedded_at) throw new Error("This image hasn't been analysed for similarity yet. Try again in a minute.");
    return { ok: true, ids: (await similarImages(db, imageId, 30)).map((r) => r.id) };
  } catch (error) {
    return fail(error);
  }
}
