import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp, { type Sharp } from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "./constants";
import { scoreImage } from "./score";
import { NEAR_DUPLICATE_DISTANCE, embedAndStore, similarImages } from "./embed";

const BUCKET = "library";
const DISPLAY_EDGE = 1600;
const THUMB_EDGE = 480;
const NEAR_DUPLICATE_BITS = 6;

export class IngestError extends Error {}

export type IngestResult =
  | { status: "duplicate"; imageId: string }
  | { status: "added"; imageId: string; nearDuplicates: string[]; scored: boolean };

export const extensionFor = (mime: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" })[
    mime
  ] ?? "bin";

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertAcceptable(mime: string, size: number) {
  if (!ACCEPTED_TYPES.includes(mime)) {
    throw new IngestError("Unsupported format. Use JPEG, PNG, WebP, GIF or AVIF.");
  }
  if (size > MAX_UPLOAD_BYTES) throw new IngestError("That file is larger than 25 MB.");
  if (size === 0) throw new IngestError("That file is empty.");
}

/**
 * Add an image whose bytes are already on the server (a pasted link, the
 * browser extension, the phone share sheet). `db` decides whose rights apply:
 * the member's own client, or the admin client for the extension.
 */
export async function ingestBytes(
  db: SupabaseClient,
  input: {
    studioId: string;
    addedBy: string | null;
    bytes: Buffer;
    mime: string;
    name: string;
    sourceUrl?: string | null;
    pageUrl?: string | null;
  },
): Promise<IngestResult> {
  assertAcceptable(input.mime, input.bytes.byteLength);
  const fileHash = sha256(input.bytes);

  const existing = await findByHash(db, input.studioId, fileHash);
  if (existing) return { status: "duplicate", imageId: existing };

  const id = randomUUID();
  const storagePath = `${input.studioId}/${id}/original.${extensionFor(input.mime)}`;

  const upload = await db.storage
    .from(BUCKET)
    .upload(storagePath, input.bytes, { contentType: input.mime, upsert: false });
  if (upload.error) throw new IngestError(`Upload failed: ${upload.error.message}`);

  const insert = await db.from("images").insert({
    id,
    studio_id: input.studioId,
    added_by: input.addedBy,
    storage_path: storagePath,
    original_name: input.name.slice(0, 200),
    mime_type: input.mime,
    bytes: input.bytes.byteLength,
    file_hash: fileHash,
    source_url: input.sourceUrl ?? null,
    page_url: input.pageUrl ?? null,
  });
  if (insert.error) {
    await db.storage.from(BUCKET).remove([storagePath]);
    if (insert.error.code === "23505") {
      const dup = await findByHash(db, input.studioId, fileHash);
      if (dup) return { status: "duplicate", imageId: dup };
    }
    throw new IngestError(`Couldn't save the image: ${insert.error.message}`);
  }

  return finishImage(db, id, input.bytes);
}

/**
 * Turn a stored original into display and thumbnail versions, record its
 * size and perceptual hash, flag near-duplicates, then score it with Claude.
 * Removes the image again if the file can't be read as an image.
 */
export async function finishImage(db: SupabaseClient, imageId: string, knownBytes?: Buffer): Promise<IngestResult> {
  const { data: image, error } = await db
    .from("images")
    .select("id, studio_id, storage_path")
    .eq("id", imageId)
    .single();
  if (error || !image) throw new IngestError("That image no longer exists.");

  let original = knownBytes;
  if (!original) {
    const download = await db.storage.from(BUCKET).download(image.storage_path);
    if (download.error) throw new IngestError("The upload didn't arrive. Try again.");
    original = Buffer.from(await download.data.arrayBuffer());
  }

  let derived: Awaited<ReturnType<typeof deriveVersions>>;
  try {
    derived = await deriveVersions(original);
  } catch {
    await removeImage(db, image.id, image.studio_id);
    throw new IngestError("That file couldn't be read as an image.");
  }

  const base = `${image.studio_id}/${image.id}`;
  const displayPath = `${base}/display.webp`;
  const thumbPath = `${base}/thumb.webp`;
  const uploads = await Promise.all([
    db.storage.from(BUCKET).upload(displayPath, derived.display, { contentType: "image/webp", upsert: true }),
    db.storage.from(BUCKET).upload(thumbPath, derived.thumb, { contentType: "image/webp", upsert: true }),
  ]);
  const failed = uploads.find((u) => u.error);
  if (failed?.error) throw new IngestError(`Couldn't store the resized image: ${failed.error.message}`);

  const update = await db
    .from("images")
    .update({
      width: derived.width,
      height: derived.height,
      bytes: original.byteLength,
      file_hash: sha256(original),
      perceptual_hash: derived.dhash,
      display_path: displayPath,
      thumb_path: thumbPath,
    })
    .eq("id", image.id);
  if (update.error) throw new IngestError(`Couldn't save the image details: ${update.error.message}`);

  // Embedding takes about a second; scoring several. Run them side by side.
  let scored = true;
  await Promise.all([
    embedAndStore(db, [{ id: image.id, display: derived.display }]),
    scoreImage(db, image.id).catch(async (err) => {
      scored = false;
      await db
        .from("images")
        .update({ score_error: err instanceof Error ? err.message.slice(0, 500) : "Scoring failed" })
        .eq("id", image.id);
    }),
  ]);

  // Near-duplicates: the same picture resized (perceptual hash), or a crop,
  // recolour or alternate version (embedding).
  const [byHash, bySimilarity] = await Promise.all([
    findNearDuplicates(db, image.studio_id, image.id, derived.dhash),
    similarImages(db, image.id, 3)
      .then((rows) => rows.filter((r) => r.distance <= NEAR_DUPLICATE_DISTANCE).map((r) => r.id))
      .catch(() => [] as string[]),
  ]);
  const nearDuplicates = [...new Set([...byHash, ...bySimilarity])];

  return { status: "added", imageId: image.id, nearDuplicates, scored };
}

async function deriveVersions(original: Buffer) {
  const source = sharp(original, { animated: false, failOn: "error" }).rotate();
  const meta = await source.metadata();
  const oriented = meta.orientation && meta.orientation >= 5;
  const width = (oriented ? meta.height : meta.width) ?? 0;
  const height = (oriented ? meta.width : meta.height) ?? 0;

  const [display, thumb, dhash] = await Promise.all([
    source
      .clone()
      .resize(DISPLAY_EDGE, DISPLAY_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
    source
      .clone()
      .resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76 })
      .toBuffer(),
    differenceHash(source.clone()),
  ]);
  return { width, height, display, thumb, dhash };
}

/** 64-bit difference hash: robust to resizing and recompression. */
async function differenceHash(image: Sharp) {
  const pixels = await image.greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      bits += pixels[row * 9 + col] < pixels[row * 9 + col + 1] ? "1" : "0";
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (x) {
    count += Number(x & BigInt(1));
    x >>= BigInt(1);
  }
  return count;
}

async function findNearDuplicates(db: SupabaseClient, studioId: string, imageId: string, dhash: string) {
  const { data } = await db
    .from("images")
    .select("id, perceptual_hash")
    .eq("studio_id", studioId)
    .neq("id", imageId)
    .neq("status", "rejected")
    .not("perceptual_hash", "is", null);
  return (data ?? [])
    .filter((row) => hammingDistance(row.perceptual_hash as string, dhash) <= NEAR_DUPLICATE_BITS)
    .map((row) => row.id as string);
}

async function findByHash(db: SupabaseClient, studioId: string, fileHash: string) {
  const { data } = await db
    .from("images")
    .select("id")
    .eq("studio_id", studioId)
    .eq("file_hash", fileHash)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Delete an image's files and row. */
export async function removeImage(db: SupabaseClient, imageId: string, studioId: string) {
  const prefix = `${studioId}/${imageId}`;
  const { data: files } = await db.storage.from(BUCKET).list(prefix);
  if (files?.length) {
    await db.storage.from(BUCKET).remove(files.map((f) => `${prefix}/${f.name}`));
  }
  await db.from("images").delete().eq("id", imageId).eq("studio_id", studioId);
}
