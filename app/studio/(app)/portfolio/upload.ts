"use client";

import { IMAGE_TYPES, MAX_UPLOAD_BYTES, PORTFOLIO_BUCKET, VIDEO_TYPES } from "@/lib/portfolio/blocks";
import { createClient } from "@/lib/supabase/client";
import { addMedia, prepareUpload } from "./actions";

export const fileSize = (bytes: number | null) =>
  bytes === null ? "" : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Pixel size of an image or video file, read in the browser. */
export async function measure(file: Blob): Promise<{ width: number | null; height: number | null }> {
  try {
    if (file.type.startsWith("image/")) {
      const bitmap = await createImageBitmap(file);
      const result = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return result;
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => resolve({ width: video.videoWidth || null, height: video.videoHeight || null });
        video.onerror = () => resolve({ width: null, height: null });
        video.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { width: null, height: null };
  }
}

/**
 * Uploads one file straight from the browser to the project's storage (the
 * server only hands out the address), then records it. Returns the media id.
 */
export async function uploadFile(projectId: string, file: Blob): Promise<string> {
  if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(file.type)) {
    throw new Error("Use JPG, PNG, WebP, AVIF or GIF, or MP4 or WebM video.");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${fileSize(file.size)}: files can be up to 50 MB.`);
  const [dims, prepared] = await Promise.all([measure(file), prepareUpload(projectId, { type: file.type, size: file.size })]);
  if (!prepared.ok) throw new Error(prepared.error);
  const { error } = await createClient()
    .storage.from(PORTFOLIO_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  const added = await addMedia(projectId, { path: prepared.path, type: file.type, bytes: file.size, ...dims });
  if (!added.ok) throw new Error(added.error);
  return added.id;
}
