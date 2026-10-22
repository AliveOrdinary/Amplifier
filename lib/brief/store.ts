import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getImages } from "@/lib/library/queries";
import { listDimensions } from "@/lib/library/rubric";
import { embedText, embeddingsEnabled } from "@/lib/library/embed";
import {
  ASK_CAUGHT_AT,
  buildPlan,
  nextPair,
  project,
  rng,
  shuffle,
  type Plan,
  type PlanImage,
  type Reaction,
} from "./engine";
import { CAUGHT, type AnswerValue, type BriefInput, type Progress, type Question, type ShownImage, type Step } from "./types";

export type BriefRow = {
  id: string;
  studio_id: string;
  client_name: string;
  project_name: string | null;
  project_type: string;
  medium: string | null;
  questions: Question[];
  status: string;
  note: string | null;
  plan: Plan | null;
  expires_at: string | null;
  meeting_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

const BRIEF_COLUMNS =
  "id, studio_id, client_name, project_name, project_type, medium, questions, status, note, plan, expires_at, meeting_at, started_at, completed_at";

export async function briefByToken(db: SupabaseClient, token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await db.from("briefs").select(BRIEF_COLUMNS).eq("token", token).maybeSingle();
  return (data as BriefRow | null) ?? null;
}

/** "What are you making" comes before the images; the rest after. */
export function splitQuestions(questions: Question[]) {
  const first = questions.filter((q) => q.id === "making");
  const head = first.length ? first : questions.slice(0, 1);
  return { first: head, last: questions.filter((q) => !head.includes(q)) };
}

/* ------------------------------------------------------------------ plan */

/**
 * How many images a brief draws from. Most are the ones closest to what the
 * client said they're making; the rest are open to anything, because taste
 * crosses over (a clinic can love a hotel's identity). Bounded so a large
 * library doesn't slow the pairs down.
 */
const POOL_NEAR = 225;
const POOL_OPEN = 75;
/** A small nudge towards the brief's medium when ranking matches. */
const MEDIUM_BONUS = 0.03;

/** Every approved, scored image in the studio: just ids and media. */
async function approvedImages(db: SupabaseClient, studioId: string) {
  const all: { id: string; medium: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("images")
      .select("id, medium")
      .eq("studio_id", studioId)
      .eq("status", "approved")
      .not("display_path", "is", null)
      .not("scored_at", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as { id: string; medium: string | null }[]));
    if (!data || data.length < 1000) return all;
  }
}

/** The approved images closest to the client's own description, best first. */
async function matchDescription(db: SupabaseClient, brief: BriefRow, making: string) {
  if (!embeddingsEnabled()) return [];
  try {
    const vector = await embedText([brief.project_name, making].filter(Boolean).join(". "), brief.studio_id, db);
    const { data, error } = await db.rpc("images_near", {
      p_studio: brief.studio_id,
      p_query: JSON.stringify(vector),
      p_limit: 400,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as { id: string; medium: string | null; distance: number }[])
      .map((r) => ({ id: r.id, rank: r.distance - (brief.medium && r.medium === brief.medium ? MEDIUM_BONUS : 0) }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, POOL_NEAR)
      .map((r) => r.id);
  } catch (err) {
    // Matching is a nicety: without it the brief falls back to the medium.
    console.warn("Brief matching failed:", err);
    return [];
  }
}

/** Freeze the rubric, warm-up and pair pool once the client has said what they're making. */
export async function createPlan(db: SupabaseClient, brief: BriefRow, making?: string | null): Promise<Plan> {
  const rubric = (await listDimensions(db, brief.studio_id)).map(({ key, left, right, leftDefinition, rightDefinition }) => ({
    key,
    left,
    right,
    leftDefinition,
    rightDefinition,
  }));

  const { data: pinRows } = await db.from("brief_pins").select("image_id").eq("brief_id", brief.id);
  const pins = (pinRows ?? []).map((r) => r.image_id as string);

  const [all, near] = await Promise.all([
    approvedImages(db, brief.studio_id),
    making?.trim() ? matchDescription(db, brief, making) : Promise.resolve([] as string[]),
  ]);
  const random = rng(`pool-${brief.id}`);
  const nearSet = new Set(near);
  const rest = shuffle(
    all.filter((i) => !nearSet.has(i.id)),
    random,
  );
  let pool: string[];
  if (near.length) {
    pool = [...near, ...rest.slice(0, POOL_NEAR + POOL_OPEN - near.length).map((i) => i.id)];
  } else {
    // Nothing to match against: lean on the project's medium.
    const inMedium = rest.filter((i) => brief.medium && i.medium === brief.medium);
    const others = rest.filter((i) => !(brief.medium && i.medium === brief.medium));
    pool = [...inMedium.slice(0, POOL_NEAR), ...others, ...inMedium.slice(POOL_NEAR)]
      .slice(0, POOL_NEAR + POOL_OPEN)
      .map((i) => i.id);
  }
  const ids = [...new Set([...pins, ...pool])];

  const rows: {
    id: string;
    medium: string | null;
    embedding: unknown;
    image_scores: { dimension: string; score: number }[] | null;
  }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("images")
      .select("id, medium, embedding, image_scores ( dimension, score )")
      .in("id", ids.slice(i, i + 100))
      .not("display_path", "is", null)
      .not("scored_at", "is", null);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as typeof rows));
  }

  const images: PlanImage[] = rows.map((row) => {
    const scores = new Map((row.image_scores ?? []).map((s) => [s.dimension, Number(s.score)]));
    const embedding = typeof row.embedding === "string" ? (JSON.parse(row.embedding) as number[]) : null;
    return {
      id: row.id,
      medium: row.medium ?? null,
      scores: rubric.map((d) => scores.get(d.key) ?? 0),
      vec: embedding ? project(embedding) : null,
    };
  });

  const plan = buildPlan({
    seed: brief.id,
    rubric,
    images,
    pins,
    medium: brief.medium,
    preferred: near.length ? near : undefined,
  });
  const { error: saveError } = await db.from("briefs").update({ plan }).eq("id", brief.id).is("plan", null);
  if (saveError) throw new Error(saveError.message);
  // If two requests raced, use whichever plan was saved first.
  const { data: saved } = await db.from("briefs").select("plan").eq("id", brief.id).single();
  return (saved?.plan as Plan) ?? plan;
}

/** The client's answer to "What are you making?", for matching images to it. */
function makingText(questions: Question[], answers: Map<string, AnswerValue>) {
  const { first } = splitQuestions(questions);
  return first
    .map((q) => answers.get(q.id))
    .map((v) => (v && "text" in v ? v.text : ""))
    .filter(Boolean)
    .join(" ");
}

/* ----------------------------------------------------------- reactions */

export async function loadReactions(db: SupabaseClient, briefId: string): Promise<Reaction[]> {
  const { data, error } = await db
    .from("reactions")
    .select("seq, kind, image_a, image_b, target_dimension, is_probe, choice, response_ms")
    .eq("brief_id", briefId)
    .order("seq");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    seq: r.seq as number,
    kind: r.kind as Reaction["kind"],
    a: r.image_a as string,
    b: (r.image_b as string | null) ?? null,
    target: (r.target_dimension as string | null) ?? null,
    probe: Boolean(r.is_probe),
    choice: r.choice as Reaction["choice"],
    ms: (r.response_ms as number | null) ?? null,
  }));
}

async function loadAnswers(db: SupabaseClient, briefId: string) {
  const { data } = await db.from("answers").select("question_id, value").eq("brief_id", briefId);
  return new Map((data ?? []).map((r) => [r.question_id as string, r.value as AnswerValue]));
}

/* ------------------------------------------------------------------ steps */

const MINUTES = 8;

function closedReason(brief: BriefRow): Step | null {
  if (brief.status === "archived") return { kind: "closed", reason: "archived" };
  if (!brief.completed_at && brief.expires_at && Date.parse(brief.expires_at) < Date.now()) {
    return { kind: "closed", reason: "expired" };
  }
  return null;
}

async function shown(db: SupabaseClient, ids: string[]): Promise<Map<string, ShownImage>> {
  const images = await getImages(db, ids);
  return new Map(
    images.flatMap((i) =>
      i.displayUrl ? [[i.id, { id: i.id, url: i.displayUrl, thumb: i.thumbUrl, width: i.width, height: i.height }] as const] : [],
    ),
  );
}

/** Where the client is, as one screen, plus how far through they are. */
export async function currentStep(
  db: SupabaseClient,
  brief: BriefRow,
  known?: Reaction[],
): Promise<{ step: Step; progress: Progress }> {
  const closed = closedReason(brief);
  const { first, last } = splitQuestions(brief.questions ?? []);
  let plan = brief.plan;
  let total = first.length + last.length + (plan ? plan.warmup.length + plan.pairCount : 32);

  if (closed) return { step: closed, progress: { done: 0, total } };
  if (brief.completed_at) return { step: { kind: "done", meetingAt: brief.meeting_at }, progress: { done: total, total } };
  if (!brief.started_at) {
    return {
      step: { kind: "welcome", client: brief.client_name, project: brief.project_name, note: brief.note, minutes: MINUTES },
      progress: { done: 0, total },
    };
  }

  const [reactions, answers] = await Promise.all([known ?? loadReactions(db, brief.id), loadAnswers(db, brief.id)]);
  // The plan waits for "What are you making?", so the images can follow the answer.
  if (!plan && first.every((q) => answers.has(q.id))) {
    plan = brief.plan = await createPlan(db, brief, makingText(brief.questions ?? [], answers));
    total = first.length + last.length + plan.warmup.length + plan.pairCount;
  }
  const swipes = reactions.filter((r) => r.kind === "swipe").length;
  const pairs = reactions.filter((r) => r.kind === "pair").length;
  const answeredFirst = first.filter((q) => answers.has(q.id)).length;
  const answeredLast = last.filter((q) => answers.has(q.id)).length;
  const progress = { done: answeredFirst + swipes + pairs + answeredLast, total };

  const nextFirst = first.find((q) => !answers.has(q.id));
  if (nextFirst) {
    return {
      step: { kind: "question", question: nextFirst, value: null, part: "first", index: answeredFirst, total: first.length },
      progress,
    };
  }

  if (!plan) throw new Error("The brief couldn't be prepared.");

  if (swipes < plan.warmup.length) {
    const ids = plan.warmup.slice(swipes);
    const images = await shown(db, ids);
    const image = images.get(ids[0]);
    if (image) {
      return {
        step: {
          kind: "swipe",
          seq: reactions.length,
          image,
          upcoming: ids.slice(1).flatMap((id) => (images.has(id) ? [images.get(id)!] : [])),
          index: swipes,
          total: plan.warmup.length,
        },
        progress,
      };
    }
  }

  if (pairs < plan.pairCount) {
    const pick = nextPair(plan, reactions, brief.id);
    if (pick) {
      const images = await shown(db, [pick.a, pick.b]);
      const a = images.get(pick.a);
      const b = images.get(pick.b);
      if (a && b) {
        return {
          step: {
            kind: "pair",
            seq: reactions.length,
            a,
            b,
            index: pairs,
            total: plan.pairCount,
            askCaught: ASK_CAUGHT_AT.includes(pairs),
          },
          progress,
        };
      }
    }
  }

  const nextLast = last.find((q) => !answers.has(q.id));
  if (nextLast) {
    return {
      step: { kind: "question", question: nextLast, value: null, part: "last", index: answeredLast, total: last.length },
      progress,
    };
  }

  const completedAt = new Date().toISOString();
  await db.from("briefs").update({ completed_at: completedAt, status: "completed" }).eq("id", brief.id).is("completed_at", null);
  brief.completed_at = completedAt;
  return { step: { kind: "done", meetingAt: brief.meeting_at }, progress: { done: total, total } };
}

/* --------------------------------------------------------------- recording */

const Text = z.string().trim().max(2000);
const Answer = z.union([
  z.object({ skipped: z.literal(true) }),
  z.object({ words: z.array(z.string().trim().max(40)).length(3) }),
  z.object({ chips: z.array(z.string().max(60)).max(20) }),
  z.object({ text: Text, why: Text.optional() }),
]);

export class BriefError extends Error {}

/**
 * Save one thing the client did. Out-of-order or repeated input is ignored.
 * After a swipe or pair, returns the reactions so far (saves a query).
 */
export async function record(db: SupabaseClient, brief: BriefRow, input: BriefInput): Promise<Reaction[] | undefined> {
  if (closedReason(brief) || brief.completed_at) return;

  if (input.kind === "start") {
    if (!brief.started_at) {
      const startedAt = new Date().toISOString();
      await db.from("briefs").update({ started_at: startedAt, status: "in_progress" }).eq("id", brief.id).is("started_at", null);
      brief.started_at = startedAt;
    }
    return;
  }

  if (!brief.started_at) throw new BriefError("Start the brief first.");

  if (input.kind === "answer") {
    const question = (brief.questions ?? []).find((q) => q.id === input.questionId);
    if (!question) throw new BriefError("Unknown question.");
    const value = Answer.parse(input.value);
    if ("skipped" in value && !question.optional) throw new BriefError("This one needs an answer.");
    const { error } = await db
      .from("answers")
      .upsert({ brief_id: brief.id, question_id: question.id, value, answered_at: new Date().toISOString() });
    if (error) throw new BriefError(error.message);
    return;
  }

  const plan = brief.plan;
  if (!plan) throw new BriefError("Answer the first question first.");
  const reactions = await loadReactions(db, brief.id);
  if (input.seq !== reactions.length) return reactions; // already recorded (a double tap or a retry)
  const ms = Number.isFinite(input.ms) ? Math.max(0, Math.min(600_000, Math.round(input.ms))) : null;

  if (input.kind === "swipe") {
    const swipes = reactions.filter((r) => r.kind === "swipe").length;
    if (plan.warmup[swipes] !== input.imageId) return reactions;
    if (input.choice !== "keep" && input.choice !== "skip") throw new BriefError("Unknown choice.");
    const { error } = await db.from("reactions").insert({
      brief_id: brief.id,
      seq: input.seq,
      kind: "swipe",
      image_a: input.imageId,
      choice: input.choice,
      response_ms: ms,
    });
    if (error && error.code !== "23505") throw new BriefError(error.message);
    if (error) return undefined;
    return [
      ...reactions,
      { seq: input.seq, kind: "swipe", a: input.imageId, b: null, target: null, probe: false, choice: input.choice, ms },
    ];
  }

  if (input.kind === "pair") {
    if (!["a", "b", "both", "neither"].includes(input.choice)) throw new BriefError("Unknown choice.");
    // The engine is deterministic: recompute the pair that was shown.
    const pick = nextPair(plan, reactions, brief.id);
    if (!pick) return reactions;
    const scoresOf = (id: string) => {
      const image = plan.images.find((i) => i.id === id);
      return image ? Object.fromEntries(plan.rubric.map((d, i) => [d.key, image.scores[i]])) : null;
    };
    const { error } = await db.from("reactions").insert({
      brief_id: brief.id,
      seq: input.seq,
      kind: "pair",
      image_a: pick.a,
      image_b: pick.b,
      target_dimension: pick.target,
      is_probe: pick.probe,
      choice: input.choice,
      caught: (input.caught ?? []).filter((c): c is (typeof CAUGHT)[number] => (CAUGHT as readonly string[]).includes(c)),
      response_ms: ms,
      scores_a: scoresOf(pick.a),
      scores_b: scoresOf(pick.b),
    });
    if (error && error.code !== "23505") throw new BriefError(error.message);
    if (error) return undefined;
    return [
      ...reactions,
      { seq: input.seq, kind: "pair", a: pick.a, b: pick.b, target: pick.target, probe: pick.probe, choice: input.choice, ms },
    ];
  }
  return undefined;
}
