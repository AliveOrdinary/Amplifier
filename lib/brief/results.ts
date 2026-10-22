import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getImages } from "@/lib/library/queries";
import { beliefs, consistency, type Plan } from "./engine";
import { loadReactions } from "./store";
import type { AnswerValue, Question } from "./types";

export type ResultImage = { id: string; thumb: string | null; description: string | null };

export type BriefResults = {
  answers: { question: Question; value: AnswerValue | null }[];
  warmup: { image: ResultImage; choice: "keep" | "skip"; ms: number | null }[];
  pairs: {
    index: number;
    a: ResultImage;
    b: ResultImage;
    target: string | null;
    probe: boolean;
    choice: string;
    caught: string[];
    ms: number | null;
  }[];
  lean: { key: string; left: string; right: string; mean: number; sd: number; asked: number }[];
  consistency: { probes: number; same: number };
  medianMs: number | null;
};

/** Everything the client did, in a shape the studio can read. */
export async function briefResults(db: SupabaseClient, brief: { id: string; questions: Question[]; plan: Plan | null }) {
  const [reactions, { data: answerRows }, { data: caughtRows }] = await Promise.all([
    loadReactions(db, brief.id),
    db.from("answers").select("question_id, value").eq("brief_id", brief.id),
    db.from("reactions").select("seq, caught").eq("brief_id", brief.id),
  ]);
  const answers = new Map((answerRows ?? []).map((r) => [r.question_id as string, r.value as AnswerValue]));
  const caught = new Map((caughtRows ?? []).map((r) => [r.seq as number, (r.caught as string[]) ?? []]));

  const ids = [...new Set(reactions.flatMap((r) => (r.b ? [r.a, r.b] : [r.a])))];
  const images = new Map((await getImages(db, ids)).map((i) => [i.id, i]));
  const view = (id: string): ResultImage => ({
    id,
    thumb: images.get(id)?.thumbUrl ?? null,
    description: images.get(id)?.description ?? null,
  });

  const pairs = reactions.filter((r) => r.kind === "pair");
  const times = pairs.map((r) => r.ms).filter((ms): ms is number => ms !== null).sort((x, y) => x - y);

  const plan = brief.plan;
  const lean = plan
    ? beliefs(plan, reactions).map((b, i) => ({
        key: b.key,
        left: plan.rubric[i].left,
        right: plan.rubric[i].right,
        mean: b.mean,
        sd: b.sd,
        asked: b.asked,
      }))
    : [];

  return {
    answers: (brief.questions ?? []).map((question) => ({ question, value: answers.get(question.id) ?? null })),
    warmup: reactions
      .filter((r) => r.kind === "swipe")
      .map((r) => ({ image: view(r.a), choice: r.choice as "keep" | "skip", ms: r.ms })),
    pairs: pairs.map((r, index) => ({
      index,
      a: view(r.a),
      b: view(r.b!),
      target: r.target,
      probe: r.probe,
      choice: r.choice,
      caught: caught.get(r.seq) ?? [],
      ms: r.ms,
    })),
    lean,
    consistency: consistency(reactions),
    medianMs: times.length ? times[Math.floor(times.length / 2)] : null,
  } satisfies BriefResults;
}
