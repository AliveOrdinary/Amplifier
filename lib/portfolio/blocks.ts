import { z } from "zod";

/** Checks blocks before they're saved. Shared so the editor and the server agree. */
export const StoredBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("text"),
    text: z.string().max(20000, "A text block can hold up to 20,000 characters."),
    label: z.string().trim().max(40, "Keep section labels short (40 characters).").nullish(),
  }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("media"),
    media: z.array(z.uuid()).min(1, "Pick at least one image or video.").max(3, "Up to three side by side."),
    caption: z.string().max(400).nullish(),
  }),
]);

export const StoredBlocksSchema = z.array(StoredBlockSchema).max(80, "Up to 80 blocks per project.");

/** "Crums: a new look" → "crums-a-new-look". */
export function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Short random id for a new block. */
export function blockId() {
  return Math.random().toString(36).slice(2, 10);
}

export const PORTFOLIO_BUCKET = "portfolio";

/** Supabase's default upload limit on the free plan. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm"];
