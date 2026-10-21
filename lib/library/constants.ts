/** Shared between server and client: the library's fixed vocabularies. */

export const DIMENSIONS = [
  { key: "density", left: "Minimal", right: "Rich" },
  { key: "volume", left: "Quiet", right: "Loud" },
  { key: "temperature", left: "Warm", right: "Cool" },
  { key: "era", left: "Classic", right: "Contemporary" },
  { key: "form", left: "Organic", right: "Geometric" },
  { key: "tone", left: "Serious", right: "Playful" },
  { key: "finish", left: "Crafted", right: "Polished" },
  { key: "abstraction", left: "Literal", right: "Abstract" },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];
export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key) as DimensionKey[];

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
