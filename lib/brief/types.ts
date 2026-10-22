/** Shared between the server, the studio and the client's brief. */

export type QuestionFormat = "long" | "short" | "three_words" | "chips" | "link";

export type Question = {
  id: string;
  prompt: string;
  help?: string;
  format: QuestionFormat;
  options?: string[];
  optional?: boolean;
};

export type AnswerValue =
  | { text: string; why?: string }
  | { words: string[] }
  | { chips: string[] }
  | { skipped: true };

export type BriefStatus = "draft" | "sent" | "in_progress" | "completed" | "archived";

/** What caught the client's eye in a pair, when asked. */
export const CAUGHT = ["Colour", "Type", "Layout", "Image", "Texture", "Mood"] as const;

export type ShownImage = { id: string; url: string; thumb: string | null; width: number | null; height: number | null };

/** One screen of the client's brief. `seq` is the reaction number the answer should carry. */
export type Step =
  | { kind: "welcome"; client: string; project: string | null; note: string | null; minutes: number }
  | { kind: "question"; question: Question; value: AnswerValue | null; part: "first" | "last"; index: number; total: number }
  /** `upcoming` is the rest of the warm-up, so the next image can show without waiting for the server. */
  | { kind: "swipe"; seq: number; image: ShownImage; upcoming: ShownImage[]; index: number; total: number }
  | { kind: "pair"; seq: number; a: ShownImage; b: ShownImage; index: number; total: number; askCaught: boolean }
  | { kind: "done"; meetingAt: string | null }
  | { kind: "closed"; reason: "expired" | "archived" | "not-ready" };

export type Progress = { done: number; total: number };

/** What the client sends back. */
export type BriefInput =
  | { kind: "start" }
  | { kind: "answer"; questionId: string; value: AnswerValue }
  | { kind: "swipe"; seq: number; imageId: string; choice: "keep" | "skip"; ms: number }
  | { kind: "pair"; seq: number; choice: "a" | "b" | "both" | "neither"; caught: string[]; ms: number };

/** Pins always appear in the client's warm-up, so keep them few. */
export const MAX_PINS = 8;

/** Medium that suits each project type, as the default for a new brief. */
export const MEDIUM_FOR_TYPE: Record<string, string> = {
  musician_identity: "identity",
  album_artwork: "album_art",
  film_key_art: "poster_key_art",
  event_festival: "poster_key_art",
  exhibition: "exhibition_spatial",
  brand_identity: "identity",
  website: "web",
};
