/**
 * The brief's adaptive engine. Pure functions, no database: easy to test with
 * a simulated client.
 *
 * Each dimension holds a belief about where the client's taste sits on it,
 * as weights over the nine score steps from −2 to +2. Warm-up swipes nudge
 * every dimension a little. A pair tests one dimension: two images far apart
 * on it and close on the rest, so the choice says mostly one thing. The next
 * pair goes to the dimension we're least sure about. A few pairs repeat an
 * earlier one with the sides swapped, to see whether choices hold.
 */

export const GRID = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];

export type RubricEntry = { key: string; left: string; right: string; leftDefinition: string; rightDefinition: string };

export type PlanImage = {
  id: string;
  medium: string | null;
  /** Scores in rubric order; 0 where missing. */
  scores: number[];
  /** A short, normalised version of the image's embedding, or null. */
  vec: number[] | null;
};

export type Plan = {
  version: 1;
  createdAt: string;
  rubric: RubricEntry[];
  medium: string | null;
  pins: string[];
  warmup: string[];
  pairCount: number;
  images: PlanImage[];
};

export type Reaction = {
  seq: number;
  kind: "swipe" | "pair";
  a: string;
  b: string | null;
  target: string | null;
  probe: boolean;
  choice: "keep" | "skip" | "a" | "b" | "both" | "neither";
  ms: number | null;
};

/* ------------------------------------------------------------- randomness */

/** Small seeded generator, so the same brief and step always give the same pair. */
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], random: () => number) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Reduce a long embedding to a few numbers with a fixed random projection, then normalise. */
const projections = new Map<string, Float64Array>();
export function project(embedding: number[], size = 32) {
  const id = `${embedding.length}x${size}`;
  let matrix = projections.get(id);
  if (!matrix) {
    const random = rng(`projection-${id}`);
    // Rough standard normals from three uniforms; the same matrix for every image.
    matrix = Float64Array.from({ length: embedding.length * size }, () => random() + random() + random() - 1.5);
    projections.set(id, matrix);
  }
  const out = new Array(size).fill(0);
  for (let i = 0; i < embedding.length; i++) {
    for (let j = 0; j < size; j++) out[j] += embedding[i] * matrix[i * size + j];
  }
  const norm = Math.hypot(...out) || 1;
  return out.map((v) => Math.round((v / norm) * 1e4) / 1e4);
}

const cosineDistance = (a: number[] | null, b: number[] | null) => {
  if (!a || !b) return 0.5;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, 1 - dot);
};

/* ------------------------------------------------------------------- plan */

const scoreDistance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

/**
 * Freeze what a brief will show. Pins always appear in the warm-up; the rest
 * of the warm-up spreads across the rubric, mostly from `preferred` (images
 * close to what the client described) or, failing that, the project's medium.
 */
export function buildPlan(input: {
  seed: string;
  rubric: RubricEntry[];
  images: PlanImage[];
  pins: string[];
  medium: string | null;
  preferred?: string[];
  warmupCount?: number;
  maxPairs?: number;
}): Plan {
  const random = rng(`plan-${input.seed}`);
  const warmupCount = input.warmupCount ?? 12;
  const byId = new Map(input.images.map((i) => [i.id, i]));
  const pins = input.pins.filter((id) => byId.has(id)).slice(0, warmupCount);

  // Farthest-point sampling: each pick is the image least like those already chosen.
  const chosen: PlanImage[] = pins.map((id) => byId.get(id)!);
  const preferred = new Set(input.preferred ?? []);
  const inMedium = preferred.size
    ? input.images.filter((i) => preferred.has(i.id))
    : input.images.filter((i) => input.medium && i.medium === input.medium);
  const fromMedium = Math.min(inMedium.length, Math.round((warmupCount - chosen.length) * 0.65));
  const pick = (from: PlanImage[], count: number) => {
    let left = shuffle(from.filter((i) => !chosen.includes(i)), random);
    for (let n = 0; n < count && left.length; n++) {
      let best = left[0];
      let bestDistance = -1;
      for (const candidate of left) {
        const nearest = chosen.length
          ? Math.min(...chosen.map((c) => scoreDistance(c.scores, candidate.scores)))
          : random();
        if (nearest > bestDistance) {
          bestDistance = nearest;
          best = candidate;
        }
      }
      chosen.push(best);
      left = left.filter((i) => i !== best);
    }
  };
  pick(inMedium, fromMedium);
  pick(input.images, warmupCount - chosen.length);

  const plan: Plan = {
    version: 1,
    createdAt: new Date().toISOString(),
    rubric: input.rubric,
    medium: input.medium,
    pins,
    warmup: shuffle(
      chosen.map((i) => i.id),
      random,
    ),
    pairCount: 0,
    images: input.images,
  };
  plan.pairCount = Math.min(input.maxPairs ?? 20, pairCapacity(plan));
  return plan;
}

/** How many useful pairs the pool can make, roughly: none below six images. */
export function pairCapacity(plan: Plan) {
  if (plan.images.length < 6) return 0;
  let testable = 0;
  for (let d = 0; d < plan.rubric.length; d++) {
    const values = plan.images.map((i) => i.scores[d]);
    if (Math.max(...values) - Math.min(...values) >= 1) testable++;
  }
  return Math.min(testable * 3, Math.floor(plan.images.length * 1.2));
}

/* ------------------------------------------------------------- belief */

export type Belief = { key: string; weights: number[]; mean: number; sd: number; asked: number };

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const SHARPNESS = 2.2;

/** Likelihood of the client's ideal sitting at x, given one reaction on one dimension. */
function likelihood(x: number, a: number, b: number | null, choice: Reaction["choice"]) {
  if (b === null) {
    // A swipe: keeping suggests the ideal is near the image; skipping, away from it.
    const near = Math.exp(-((x - a) ** 2) / (2 * 1.2 ** 2));
    return choice === "keep" ? 0.5 + 0.5 * near : 1 - 0.4 * near;
  }
  const da = Math.abs(x - a);
  const db = Math.abs(x - b);
  switch (choice) {
    case "a":
      return sigmoid(SHARPNESS * (db - da));
    case "b":
      return sigmoid(SHARPNESS * (da - db));
    case "both":
      return Math.exp(-((da - db) ** 2) / 2);
    case "neither":
      return 0.35 + 0.65 * sigmoid(SHARPNESS * (Math.min(da, db) - 0.75));
    default:
      return 1;
  }
}

/** Where we think the client sits on each dimension, and how sure we are. */
export function beliefs(plan: Plan, reactions: Reaction[]): Belief[] {
  const byId = new Map(plan.images.map((i) => [i.id, i]));
  return plan.rubric.map((dimension, d) => {
    // A gentle pull towards the middle until there's evidence.
    let weights = GRID.map((x) => Math.exp(-(x ** 2) / (2 * 1.4 ** 2)));
    let asked = 0;
    for (const r of reactions) {
      const a = byId.get(r.a);
      if (!a) continue;
      const b = r.b ? byId.get(r.b) : null;
      if (r.b && !b) continue;
      const own = r.kind === "pair" && r.target === dimension.key;
      if (own && !r.probe) asked++;
      // Swipes and other dimensions' pairs say less about this one.
      const weight = r.kind === "swipe" ? 0.35 : own ? 1 : 0.2;
      weights = weights.map(
        (w, i) => w * likelihood(GRID[i], a.scores[d], b ? b.scores[d] : null, r.choice) ** weight,
      );
      const total = weights.reduce((s, w) => s + w, 0) || 1;
      weights = weights.map((w) => w / total);
    }
    const total = weights.reduce((s, w) => s + w, 0) || 1;
    weights = weights.map((w) => w / total);
    const mean = weights.reduce((s, w, i) => s + w * GRID[i], 0);
    const sd = Math.sqrt(weights.reduce((s, w, i) => s + w * (GRID[i] - mean) ** 2, 0));
    return { key: dimension.key, weights, mean, sd, asked };
  });
}

/* ------------------------------------------------------------ next pair */

/** After these pairs (counting from 0), repeat an earlier one with sides swapped. */
const PROBE_AT = [7, 13, 18];

export type PairPick = { a: string; b: string; target: string; probe: boolean };

export function nextPair(plan: Plan, reactions: Reaction[], seed: string): PairPick | null {
  const pairs = reactions.filter((r) => r.kind === "pair");
  if (pairs.length >= plan.pairCount) return null;
  const random = rng(`${seed}-pair-${pairs.length}`);

  // Repeat an earlier clear choice, sides swapped.
  if (PROBE_AT.includes(pairs.length)) {
    const probed = new Set(pairs.filter((p) => p.probe).map((p) => `${p.b}|${p.a}`));
    const earlier = pairs.filter(
      (p) => !p.probe && p.b && (p.choice === "a" || p.choice === "b") && !probed.has(`${p.a}|${p.b}`),
    );
    const repeat = earlier[Math.floor(random() * earlier.length)];
    if (repeat?.b && repeat.target) return { a: repeat.b, b: repeat.a, target: repeat.target, probe: true };
  }

  const belief = beliefs(plan, reactions);
  const shown = new Map<string, number>();
  for (const r of reactions) {
    shown.set(r.a, (shown.get(r.a) ?? 0) + (r.kind === "swipe" ? 0.5 : 1));
    if (r.b) shown.set(r.b, (shown.get(r.b) ?? 0) + 1);
  }
  const asked = new Set(pairs.map((p) => [p.a, p.b].sort().join("|")));

  // Dimensions to try, most uncertain first; every one gets two pairs before any gets a third.
  const minAsked = Math.min(...belief.map((b) => b.asked));
  const order = belief
    .map((b, d) => ({ d, b, rank: b.sd - 0.12 * b.asked + (b.asked === minAsked ? 1 : 0) + random() * 0.02 }))
    .sort((x, y) => y.rank - x.rank);

  for (const { d, b } of order) {
    let best: { i: PlanImage; j: PlanImage; value: number } | null = null;
    for (let x = 0; x < plan.images.length; x++) {
      for (let y = x + 1; y < plan.images.length; y++) {
        const i = plan.images[x];
        const j = plan.images[y];
        const gap = Math.abs(i.scores[d] - j.scores[d]);
        if (gap < 1) continue;
        if (asked.has([i.id, j.id].sort().join("|"))) continue;

        let others = 0;
        for (let k = 0; k < plan.rubric.length; k++) if (k !== d) others += Math.abs(i.scores[k] - j.scores[k]);
        others /= Math.max(1, plan.rubric.length - 1);

        // Most informative when the two sit either side of where we think the client is.
        const straddles = (i.scores[d] - b.mean) * (j.scores[d] - b.mean) < 0 ? 0.6 : 0;
        const medium = plan.medium && i.medium === plan.medium && j.medium === plan.medium ? 0.3 : 0;
        const value =
          Math.min(gap, 3) -
          0.7 * others -
          0.8 * cosineDistance(i.vec, j.vec) +
          straddles +
          medium -
          0.9 * ((shown.get(i.id) ?? 0) + (shown.get(j.id) ?? 0)) +
          random() * 0.15;
        if (!best || value > best.value) best = { i, j, value };
      }
    }
    if (best) {
      // Show the two in a random order so position doesn't tell anything.
      const flip = random() < 0.5;
      return {
        a: flip ? best.j.id : best.i.id,
        b: flip ? best.i.id : best.j.id,
        target: plan.rubric[d].key,
        probe: false,
      };
    }
  }
  return null;
}

/** Ask "what caught your eye?" on these pairs (counting from 0). */
export const ASK_CAUGHT_AT = [2, 6, 10, 15];

/* -------------------------------------------------------------- results */

/** How often a repeated pair got the same answer (sides swapped back). */
export function consistency(reactions: Reaction[]) {
  const pairs = reactions.filter((r) => r.kind === "pair");
  const probes = pairs.filter((p) => p.probe);
  let same = 0;
  for (const probe of probes) {
    const original = pairs.find((p) => !p.probe && p.a === probe.b && p.b === probe.a);
    if (!original) continue;
    const pickedOriginal = original.choice === "a" ? original.a : original.choice === "b" ? original.b : null;
    const pickedProbe = probe.choice === "a" ? probe.a : probe.choice === "b" ? probe.b : null;
    if (pickedOriginal && pickedOriginal === pickedProbe) same++;
  }
  return { probes: probes.length, same };
}
