import type { DimensionKey } from "./constants";

export type ImageStatus = "pending" | "approved" | "rejected";

export type ImageScore = { score: number; source: "ai" | "human"; confidence: number | null };

/** What the studio UI knows about a library image. */
export type LibraryImage = {
  id: string;
  status: ImageStatus;
  medium: string | null;
  description: string | null;
  name: string | null;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  displayUrl: string | null;
  sourceUrl: string | null;
  scoreError: string | null;
  scored: boolean;
  /** Resized and scored (or scoring failed): ready to review. */
  ready: boolean;
  createdAt: string;
  scores: Partial<Record<DimensionKey, ImageScore>>;
};
