/** The prep page's report, shared between the server and the studio's screens. */

export type SaidPosition = {
  key: string;
  /** Where their words put them, −2…+2, or null when their words say nothing about it. */
  position: number | null;
  confidence: "low" | "medium" | "high";
  /** The words it rests on. */
  evidence: string;
};

export type ReportContent = {
  headline: string;
  contradictions: { key: string; line: string; ask: string }[];
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
