import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SCORING_MODEL } from "@/lib/library/score";
import { evidence, type Evidence } from "./evidence";
import type { Plan } from "./engine";
import { loadReactions } from "./store";
import { GAP, type Report, type ReportContent, type SaidPosition } from "./report-types";
import type { AnswerValue, Question } from "./types";

type OutputSchema = Parameters<typeof jsonSchemaOutputFormat>[0];

const SYSTEM = `You help Amplifier, a small graphic design studio, prepare for a first meeting with a client. Their clients are mostly musicians, filmmakers, galleries and other artists.

Before the meeting, the client answered a few questions in words and then made quick visual choices: keep or skip on single images, and "which feels closer" on pairs. What people say they want often differs from what they pick. Your job is to set the two side by side, honestly, so the designers walk in knowing what to ask.

You get:
- The studio's rubric: dimensions running from -2 (left end) to +2 (right end), each end described by what you can see.
- The client's written answers.
- What their choices showed on each dimension, already calculated. Trust these numbers; don't recalculate them.
- Short descriptions of the images they leaned towards and away from.

Write in plain, warm, direct English for designers. No jargon, no hedging filler, no flattery. Quote the client's own words where you can. Never invent facts about the client or their project.`;

const TASK = `Do three things.

1. dimensions: one entry for every dimension in the rubric.
   - said: place the client's words on it (-2 to +2, steps of 0.5), or null when their words say nothing about it. Only use what they wrote: "minimal" says something about density; the project being an album says nothing. said_confidence is how clearly the words point; evidence is the few words it rests on (empty when said is null).
   - line: when said isn't null, one sentence setting their words against what their choices showed, with the numbers that matter, e.g. "Said 'minimal, clean'. Picked the richer image in 3 of 3 density pairs and kept mostly layered work." Plain and factual, even when the two agree. Empty when said is null.
   - ask: one open, friendly question for the meeting that explores any difference without telling them they're wrong. Empty when said is null.

2. directions: 2 to 4 short lines each on what they consistently chose and rejected, in visual terms (colour, type, layout, texture, imagery), drawn from the image descriptions and the showed positions. Each line under 12 words, no full stops.

3. headline: one or two sentences, under 40 words, that a designer could read on the way into the meeting. Lead with the biggest gap between words and choices if there is one.`;

const fmt = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

function answerText(value: AnswerValue | undefined) {
  if (!value) return "(not answered)";
  if ("skipped" in value) return "(skipped)";
  if ("words" in value) return value.words.join(", ");
  if ("chips" in value) return value.chips.join(", ");
  return value.why ? `${value.text} (why: ${value.why})` : value.text;
}

function describe(plan: Plan, ev: Evidence, questions: Question[], answers: Map<string, AnswerValue>, descriptions: Map<string, string>) {
  const rubric = plan.rubric
    .map((d) => `- ${d.key}: -2 ${d.left} (${d.leftDefinition || "no definition"}) … +2 ${d.right} (${d.rightDefinition || "no definition"})`)
    .join("\n");
  const words = questions.map((q) => `- ${q.prompt}\n  ${answerText(answers.get(q.id))}`).join("\n");
  const showed = ev.dimensions
    .map((d) => {
      const parts = [`showed ${fmt(d.mean)} (${d.confidence} confidence)`];
      if (d.pairs) parts.push(`${d.pairs} pairs: picked the ${d.right.toLowerCase()} side ${d.towardRight}, the ${d.left.toLowerCase()} side ${d.towardLeft}`);
      if (d.keptAvg !== null) parts.push(`kept images averaged ${fmt(d.keptAvg)}`);
      if (d.skippedAvg !== null) parts.push(`skipped averaged ${fmt(d.skippedAvg)}`);
      return `- ${d.key} (${d.left} ↔ ${d.right}): ${parts.join("; ")}`;
    })
    .join("\n");
  const list = (items: { id: string; weight: number }[]) =>
    items
      .slice(0, 10)
      .map((i) => descriptions.get(i.id))
      .filter(Boolean)
      .map((d) => `- ${d}`)
      .join("\n") || "- (none)";

  return `<rubric>\n${rubric}\n</rubric>\n\n<their_words>\n${words}\n</their_words>\n\n<their_choices>\n${ev.swipeCount} warm-up images and ${ev.pairCount} pairs.\n${showed}\n</their_choices>\n\n<leaned_towards>\n${list(ev.chosen)}\n</leaned_towards>\n\n<leaned_away_from>\n${list(ev.rejected)}\n</leaned_away_from>\n\n${TASK}`;
}

function outputSchema(keys: string[]) {
  return {
    type: "object",
    properties: {
      dimensions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", enum: keys },
            said: { anyOf: [{ type: "number" }, { type: "null" }] },
            said_confidence: { type: "string", enum: ["low", "medium", "high"] },
            evidence: { type: "string" },
            line: { type: "string" },
            ask: { type: "string" },
          },
          required: ["key", "said", "said_confidence", "evidence", "line", "ask"],
          additionalProperties: false,
        },
      },
      directions: {
        type: "object",
        properties: { chose: { type: "array", items: { type: "string" } }, rejected: { type: "array", items: { type: "string" } } },
        required: ["chose", "rejected"],
        additionalProperties: false,
      },
      headline: { type: "string" },
    },
    required: ["dimensions", "directions", "headline"],
    additionalProperties: false,
  };
}

const Result = z.object({
  dimensions: z.array(
    z.object({
      key: z.string(),
      said: z.number().nullable(),
      said_confidence: z.enum(["low", "medium", "high"]),
      evidence: z.string(),
      line: z.string(),
      ask: z.string(),
    }),
  ),
  directions: z.object({ chose: z.array(z.string()), rejected: z.array(z.string()) }),
  headline: z.string(),
});

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

/** Read a brief's report, if one has been made. */
export async function loadReport(db: SupabaseClient, briefId: string): Promise<Report | null> {
  const { data } = await db.from("reports").select("said, content, model, generated_at").eq("brief_id", briefId).maybeSingle();
  if (!data) return null;
  return {
    said: (data.said as SaidPosition[]) ?? [],
    content: data.content as ReportContent,
    model: (data.model as string | null) ?? null,
    generatedAt: data.generated_at as string,
  };
}

/**
 * Write the prep page's report for a brief: place their words on the rubric,
 * set them against their choices, and write it up. One Claude call, saved.
 */
export async function generateReport(db: SupabaseClient, briefId: string): Promise<Report> {
  const { data: brief, error } = await db
    .from("briefs")
    .select("id, questions, plan, completed_at")
    .eq("id", briefId)
    .single();
  if (error || !brief?.plan) throw new Error("This brief hasn't been started yet.");
  const plan = brief.plan as Plan;
  const questions = (brief.questions as Question[]) ?? [];

  const [reactions, { data: answerRows }] = await Promise.all([
    loadReactions(db, briefId),
    db.from("answers").select("question_id, value").eq("brief_id", briefId),
  ]);
  const answers = new Map((answerRows ?? []).map((r) => [r.question_id as string, r.value as AnswerValue]));
  const ev = evidence(plan, reactions);

  const ids = [...ev.chosen, ...ev.rejected].slice(0, 40).map((i) => i.id);
  const { data: imageRows } = ids.length ? await db.from("images").select("id, description").in("id", ids) : { data: [] };
  const descriptions = new Map((imageRows ?? []).map((r) => [r.id as string, (r.description as string | null) ?? ""]));

  const keys = plan.rubric.map((d) => d.key);
  const response = await anthropic().messages.parse({
    model: SCORING_MODEL,
    max_tokens: 6000,
    system: SYSTEM,
    messages: [{ role: "user", content: describe(plan, ev, questions, answers, descriptions) }],
    output_config: { effort: "medium", format: jsonSchemaOutputFormat(outputSchema(keys) as OutputSchema, { transform: false }) },
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to write this report.");
  const parsed = Result.safeParse(response.parsed_output);
  if (!parsed.success) throw new Error("Claude's report couldn't be read.");
  const result = parsed.data;

  const clamp = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));
  const said: SaidPosition[] = keys.map((key) => {
    const s = result.dimensions.find((x) => x.key === key);
    return s
      ? { key, position: s.said === null ? null : clamp(s.said), confidence: s.said_confidence, evidence: s.evidence.trim() }
      : { key, position: null, confidence: "low", evidence: "" };
  });

  // Contradictions follow the numbers, by the same rule the taste profile highlights.
  const contradictions = ev.dimensions
    .map((d) => {
      const s = said.find((x) => x.key === d.key);
      const written = result.dimensions.find((x) => x.key === d.key);
      const gap = s?.position === null || s?.position === undefined ? 0 : Math.abs(s.position - d.mean);
      return { key: d.key, gap, line: written?.line.trim() ?? "", ask: written?.ask.trim() ?? "", confidence: d.confidence };
    })
    .filter((c) => c.gap >= GAP && c.confidence !== "low" && c.line)
    .sort((a, b) => b.gap - a.gap)
    .map(({ key, line, ask }) => ({ key, line, ask }));

  const content: ReportContent = {
    headline: result.headline.trim(),
    contradictions,
    directions: { chose: result.directions.chose.slice(0, 4), rejected: result.directions.rejected.slice(0, 4) },
    partial: !brief.completed_at,
    editedAt: null,
  };
  const generatedAt = new Date().toISOString();
  const { error: saveError } = await db.from("reports").upsert({
    brief_id: briefId,
    said,
    showed: ev,
    content,
    model: SCORING_MODEL,
    generated_at: generatedAt,
  });
  if (saveError) throw new Error(saveError.message);
  return { said, content, model: SCORING_MODEL, generatedAt };
}
