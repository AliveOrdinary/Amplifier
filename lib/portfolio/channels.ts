/**
 * The homepage desk: each featured project is a channel, and four faders
 * (four of the studio's taste dimensions) bring up the work that fits.
 *
 * Where each project sits on the faders lives here for now, by address.
 * -2 is fully left (Minimal, Quiet…), 2 fully right (Rich, Loud…).
 * A project not listed sits in the middle on everything.
 * TODO: move these into Studio › Portfolio so they're edited with the project.
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

/** Placeholder positions until the studio sets them. */
export const CHANNEL_MIX: Record<string, Partial<Mix>> = {
  crums: { density: 1, volume: 1.5, tone: 1.5, form: -0.5 },
  "sanjo-construction": { density: -1, volume: 0, tone: -1.5, form: 2 },
  teeta: { density: 0.5, volume: 0.5, tone: 1, form: -1 },
  izanagi: { density: 1.5, volume: 2, tone: -0.5, form: 1 },
};

export function mixFor(slug: string): Mix {
  return { ...FLAT_MIX, ...CHANNEL_MIX[slug] };
}

/** 1 when a project sits exactly where the faders are, 0 at the far opposite corner. */
export function match(mix: Mix, project: Mix) {
  const keys = FADERS.map((f) => f.key);
  const distance = Math.sqrt(keys.reduce((sum, k) => sum + (mix[k] - project[k]) ** 2, 0));
  const furthest = Math.sqrt(keys.length * 16);
  return Math.max(0, 1 - distance / furthest);
}

/** Desk slots: channels in use, then empty ones up to this many. */
export const DESK_SLOTS = 5;
