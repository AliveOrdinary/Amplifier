/**
 * The homepage desk: each featured project is a channel, and four faders
 * (four of the studio's taste dimensions) bring up the work that fits.
 *
 * The faders are four dimensions of the studio's rubric (same keys). Every
 * portfolio picture is scored on the rubric by Claude and corrected in
 * Studio › Portfolio (lib/portfolio/scores.ts); a project sits at the average
 * of its pictures. -2 is fully left (Minimal, Quiet…), 2 fully right.
 */

export type FaderKey = "density" | "volume" | "tone" | "form";

export type Fader = { key: FaderKey; name: string; left: string; right: string };

export const FADERS: Fader[] = [
  { key: "density", name: "Density", left: "Minimal", right: "Rich" },
  { key: "volume", name: "Volume", left: "Quiet", right: "Loud" },
  { key: "tone", name: "Tone", left: "Serious", right: "Playful" },
  { key: "form", name: "Form", left: "Organic", right: "Geometric" },
];

export type Mix = Record<FaderKey, number>;

export const FLAT_MIX: Mix = { density: 0, volume: 0, tone: 0, form: 0 };

/** Rubric scores by dimension key (-2…2), as a picture or a project carries them. */
export type Scores = Record<string, number>;

/** Where a picture (or a project) sits on the faders. Null: not scored yet, so it sits nowhere. */
export function mixOf(scores: Scores | null | undefined): Mix | null {
  if (!scores) return null;
  return Object.fromEntries(FADERS.map((f) => [f.key, scores[f.key] ?? 0])) as Mix;
}

/** The average of several pictures' scores, per dimension. Null when there are none. */
export function averageScores(list: Scores[]): Scores | null {
  if (!list.length) return null;
  const sums: Record<string, { total: number; n: number }> = {};
  for (const scores of list)
    for (const [key, value] of Object.entries(scores)) {
      const s = (sums[key] ??= { total: 0, n: 0 });
      s.total += value;
      s.n += 1;
    }
  return Object.fromEntries(Object.entries(sums).map(([key, s]) => [key, Math.round((s.total / s.n) * 100) / 100]));
}

/** 1 when it sits exactly where the faders are, 0 at the far opposite corner (or when it isn't scored). */
export function match(mix: Mix, project: Mix | null) {
  if (!project) return 0;
  const keys = FADERS.map((f) => f.key);
  const distance = Math.sqrt(keys.reduce((sum, k) => sum + (mix[k] - project[k]) ** 2, 0));
  const furthest = Math.sqrt(keys.length * 16);
  return Math.max(0, 1 - distance / furthest);
}

/** Desk slots: channels in use, then empty ones up to this many. */
export const DESK_SLOTS = 5;
