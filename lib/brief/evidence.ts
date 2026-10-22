/**
 * What a client's choices show, in numbers the prep page and Claude can use.
 * Pure functions over the frozen plan and the reactions.
 */
import { beliefs, type Plan, type Reaction } from "./engine";

export type DimensionEvidence = {
  key: string;
  left: string;
  right: string;
  /** Where their choices put them, −2…+2, and how unsure that is. */
  mean: number;
  sd: number;
  confidence: "high" | "medium" | "low";
  /** Pairs that tested this dimension, and which way they went. */
  pairs: number;
  towardLeft: number;
  towardRight: number;
  /** Average score of the warm-up images they kept and skipped. */
  keptAvg: number | null;
  skippedAvg: number | null;
};

export type Hesitation = {
  seq: number;
  index: number;
  a: string;
  b: string;
  target: string | null;
  choice: Reaction["choice"];
  ms: number;
};

export type Evidence = {
  dimensions: DimensionEvidence[];
  /** Images they leaned towards and away from, strongest first. */
  chosen: { id: string; weight: number }[];
  rejected: { id: string; weight: number }[];
  hesitations: Hesitation[];
  /** Repeated pairs answered differently the second time. */
  changed: { first: Hesitation; second: Hesitation }[];
  medianMs: number | null;
  pairCount: number;
  swipeCount: number;
};

export const confidenceOf = (sd: number): DimensionEvidence["confidence"] => (sd < 0.55 ? "high" : sd < 0.8 ? "medium" : "low");

const average = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

export function evidence(plan: Plan, reactions: Reaction[]): Evidence {
  const byId = new Map(plan.images.map((i) => [i.id, i]));
  const belief = beliefs(plan, reactions);
  const pairs = reactions.filter((r) => r.kind === "pair" && r.b);
  const swipes = reactions.filter((r) => r.kind === "swipe");

  const dimensions = plan.rubric.map((d, k): DimensionEvidence => {
    let towardLeft = 0;
    let towardRight = 0;
    let count = 0;
    for (const p of pairs) {
      if (p.target !== d.key || p.probe) continue;
      const a = byId.get(p.a)?.scores[k];
      const b = byId.get(p.b!)?.scores[k];
      if (a === undefined || b === undefined) continue;
      count++;
      if (p.choice !== "a" && p.choice !== "b") continue;
      const picked = p.choice === "a" ? a : b;
      const other = p.choice === "a" ? b : a;
      if (picked > other) towardRight++;
      else if (picked < other) towardLeft++;
    }
    const scoreOf = (r: Reaction) => byId.get(r.a)?.scores[k];
    const kept = swipes.filter((s) => s.choice === "keep").map(scoreOf).filter((v): v is number => v !== undefined);
    const skipped = swipes.filter((s) => s.choice === "skip").map(scoreOf).filter((v): v is number => v !== undefined);
    return {
      key: d.key,
      left: d.left,
      right: d.right,
      mean: belief[k].mean,
      sd: belief[k].sd,
      confidence: confidenceOf(belief[k].sd),
      pairs: count,
      towardLeft,
      towardRight,
      keptAvg: average(kept),
      skippedAvg: average(skipped),
    };
  });

  // Leaning towards (+) and away from (−) each image.
  const lean = new Map<string, number>();
  const add = (id: string, value: number) => lean.set(id, (lean.get(id) ?? 0) + value);
  for (const s of swipes) add(s.a, s.choice === "keep" ? 1 : -1);
  for (const p of pairs) {
    const [a, b] = [p.a, p.b!];
    const [forA, forB] =
      p.choice === "a" ? [1.5, -1] : p.choice === "b" ? [-1, 1.5] : p.choice === "both" ? [0.75, 0.75] : [-0.75, -0.75];
    add(a, forA);
    add(b, forB);
  }
  const ranked = [...lean].map(([id, weight]) => ({ id, weight }));
  const chosen = ranked.filter((r) => r.weight > 0).sort((x, y) => y.weight - x.weight);
  const rejected = ranked.filter((r) => r.weight < 0).sort((x, y) => x.weight - y.weight);

  // Slow choices: well above their own typical pace.
  const asHesitation = (p: Reaction, index: number): Hesitation => ({
    seq: p.seq,
    index,
    a: p.a,
    b: p.b!,
    target: p.target,
    choice: p.choice,
    ms: p.ms ?? 0,
  });
  const indexed = pairs.map((p, i) => asHesitation(p, i));
  const times = indexed.map((p) => p.ms).filter((ms) => ms > 0).sort((x, y) => x - y);
  const medianMs = times.length ? times[Math.floor(times.length / 2)] : null;
  const hesitations = medianMs
    ? indexed
        .filter((p) => p.ms >= Math.max(medianMs * 1.8, medianMs + 2500))
        .sort((x, y) => y.ms - x.ms)
        .slice(0, 4)
    : [];

  const changed: Evidence["changed"] = [];
  for (const probe of indexed.filter((_, i) => pairs[i].probe)) {
    const first = indexed.find((p, i) => !pairs[i].probe && p.a === probe.b && p.b === probe.a);
    if (!first) continue;
    const pick = (p: Hesitation) => (p.choice === "a" ? p.a : p.choice === "b" ? p.b : p.choice);
    if (pick(first) !== pick(probe)) changed.push({ first, second: probe });
  }

  return {
    dimensions,
    chosen,
    rejected,
    hesitations,
    changed,
    medianMs,
    pairCount: pairs.length,
    swipeCount: swipes.length,
  };
}
