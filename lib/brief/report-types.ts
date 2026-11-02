/** The prep page's report, shared between the server and the studio's screens. */

export type SaidPosition = {
  key: string;
  /** Where their words put them, −2…+2, or null when their words say nothing about it. */
  position: number | null;
  confidence: "low" | "medium" | "high";
  /** The words it rests on. */
  evidence: string;
};

/** The reading of the client as a whole: what they're asking for, before any numbers. */
export type ReportReading = {
  /** Two or three sentences: what they're making, for whom, and what it should feel like and do. */
  summary: string;
  /** A few short notes: the project, a reference they named, their character, how their picks fit. */
  points: { title: string; text: string }[];
  /** Questions for the meeting, from the whole brief. */
  questions: string[];
};

export type ReportContent = {
  headline: string;
  /** Missing on reports made before the reading was added. */
  reading?: ReportReading;
  /** `tentative`: few pairs tested it, so it's a hint to check rather than a finding. */
  contradictions: { key: string; line: string; ask: string; tentative?: boolean }[];
  directions: { chose: string[]; rejected: string[] };
  /** Made before the client finished. */
  partial: boolean;
  editedAt: string | null;
};

export type Report = {
  said: SaidPosition[];
  content: ReportContent;
  model: string | null;
  generatedAt: string;
};

/** Words and choices this far apart (on −2…+2) count as a contradiction. */
export const GAP = 1.25;
