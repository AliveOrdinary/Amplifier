/** Shared between server and client. Dimensions live in the database (Settings › Rubric). */

/** More dimensions make briefs longer: each needs two or three pairs. */
export const MAX_DIMENSIONS = 10;

export const MEDIA = [
  { key: "identity", label: "Identity" },
  { key: "typography", label: "Typography" },
  { key: "album_art", label: "Album and cover art" },
  { key: "poster_key_art", label: "Poster and key art" },
  { key: "motion_titles", label: "Motion and titles" },
  { key: "web", label: "Web" },
  { key: "packaging", label: "Packaging" },
  { key: "photography", label: "Photography" },
  { key: "exhibition_spatial", label: "Exhibition and spatial" },
  { key: "signage_wayfinding", label: "Signage and wayfinding" },
  { key: "interiors", label: "Interiors" },
  { key: "print_editorial", label: "Print and editorial" },
  { key: "illustration", label: "Illustration" },
] as const;

export type MediumKey = (typeof MEDIA)[number]["key"];
export const MEDIUM_KEYS = MEDIA.map((m) => m.key) as MediumKey[];
export const mediumLabel = (key: string | null | undefined) =>
  MEDIA.find((m) => m.key === key)?.label ?? "No medium";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Scores live on a −2…+2 scale in half steps. */
export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-2, Math.min(2, Math.round(value * 2) / 2));
}

/** A coverage bin under this many approved images is flagged as thin. */
export const THIN_BIN = 10;
