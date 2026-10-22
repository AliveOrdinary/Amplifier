export type ImageStatus = "pending" | "approved" | "rejected";

export type ImageScore = {
  score: number;
  source: "ai" | "human";
  confidence: number | null;
  /** A correction made before the dimension's definition last changed. */
  check: boolean;
};

/** One dimension of the studio's rubric. */
export type Dimension = {
  key: string;
  left: string;
  right: string;
  leftDefinition: string;
  rightDefinition: string;
};

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
  /** "Ana · Wayfinding": who imported it, from which Pinterest board. */
  collection: string | null;
  /** Why an imported image is waiting for a person instead of going straight to the library. */
  reviewReason: string | null;
  scoreError: string | null;
  scored: boolean;
  /** Resized and scored (or scoring failed): ready to review. */
  ready: boolean;
  createdAt: string;
  scores: Partial<Record<string, ImageScore>>;
};
