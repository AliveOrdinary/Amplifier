import "server-only";
import { recordClaude } from "@/lib/usage";
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

const SYSTEM = `You help Amplifier, a small design studio, prepare for a first meeting with a client. The studio works for all kinds of clients: shops, cafés and restaurants, brands and products, clinics, events, musicians and artists.

Before the meeting, the client answered a few questions in words and then made quick visual choices: keep or skip on single images, and "which feels closer" on pairs. Your job has two parts. First, read the client as a whole: what they're making, who it's for, the references they name, the character they describe, and what all of that asks of the design. Second, set what they said about how it should look against what they picked, so the designers walk in knowing what to ask.

How to read their words:
- Many words describe a feeling or a way of behaving, not a look. For a shop, "warm" usually means welcoming and homely, not warm colours; "quiet" can mean calm and unhurried rather than visually sparse. Put a word on a visual dimension only when it is clearly about how something looks ("warm colours", "a minimal layout"). Otherwise leave that dimension at null, or use low confidence if it plausibly points that way too.
- Use what you know about the brands, places and cultures they name (what a brand is known for, the role a kind of shop plays somewhere) to understand what they mean. Present it as context worth checking with them, never as a fact about them, and never as a generalisation about people.
- Their picks can fit their story even where they differ from an adjective. Someone who admires a bold, witty, much-loved brand may pick bold work while asking for "quiet". Say when that is the likelier explanation instead of calling it a contradiction.

You also get the studio's rubric (dimensions from -2, the left end, to +2, the right end, each end described by what you can see), what their choices showed on each dimension (already calculated: trust these numbers and don't recalculate them), and short descriptions of the images they leaned towards and away from. A dimension tested by fewer than 3 pairs gives a hint, not a finding.

Write in plain, warm, direct English for designers. No jargon, no hedging filler, no flattery. Quote the client's own words where you can. Never invent facts about the client or their project.`;

const TASK = `Do four things.

1. reading: what they're asking for, from everything they wrote and chose.
   - summary: two or three sentences, under 70 words: what they're making, for whom, and what it should feel like and do, in your words.
   - points: 2 to 4 short notes, each a title of 1 to 4 words and one or two sentences. For example: the project and who it's for; what a reference they named stands for and what it might mean here (as something to check); what their character answers suggest; how their visual picks fit or stretch the story. Only notes that add something.
   - questions: 3 to 5 open, friendly questions for the meeting, drawn from the whole brief and not only from the dimensions.

2. dimensions: one entry for every dimension in the rubric.
   - said: place their words on it (-2 to +2, steps of 0.5) only when the words are about how it should look; null when they say nothing about that. "Minimal" says something about density; the project being a café says nothing. said_confidence is how clearly the words point; evidence is the few words it rests on (empty when said is null).
   - tension: "agrees" when their words and choices point the same way; "differs" when they genuinely pull apart; "explained" when the difference is better explained by their story (a reference, their character, where people will see it); "unclear" when said is null or there are too few choices to tell.
   - line: when said isn't null, one sentence setting their words against what their choices showed, with the numbers that matter, e.g. "Said 'minimal, clean'. Picked the richer image in 3 of 3 density pairs and kept mostly layered work." When tension is "explained", add briefly what explains it. Empty when said is null.
   - ask: one open, friendly question for the meeting that explores the difference without telling them they're wrong. Empty when said is null.

3. directions: 2 to 4 short lines each on what they consistently chose and rejected, in visual terms (colour, type, layout, texture, imagery), drawn from the image descriptions and the showed positions. Each line under 12 words, no full stops.

4. headline: one or two sentences, under 45 words, that a designer could read on the way into the meeting: what they're asking for, and the one thing most worth exploring with them.`;

const fmt = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

function answerText(value: AnswerValue | undefined) {
  if (!value) return "(not answered)";
  if ("skipped" in value) return "(skipped)";
  if ("words" in value) return value.words.join(", ");
  if ("chips" in value) return value.chips.join(", ");
  return value.why ? `${value.text} (why: ${value.why})` : value.text;
}

function describe(
  plan: Plan,
  ev: Evidence,
  questions: Question[],
  answers: Map<string, AnswerValue>,
  descriptions: Map<string, string>,
  project: string,
) {
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

  return `<project_type>${project}</project_type>\n\n<rubric>\n${rubric}\n</rubric>\n\n<their_words>\n${words}\n</their_words>\n\n<their_choices>\n${ev.swipeCount} warm-up images and ${ev.pairCount} pairs.\n${showed}\n</their_choices>\n\n<leaned_towards>\n${list(ev.chosen)}\n</leaned_towards>\n\n<leaned_away_from>\n${list(ev.rejected)}\n</leaned_away_from>\n\n${TASK}`;
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
            tension: { type: "string", enum: ["agrees", "differs", "explained", "unclear"] },
            line: { type: "string" },
            ask: { type: "string" },
          },
          required: ["key", "said", "said_confidence", "evidence", "tension", "line", "ask"],
          additionalProperties: false,
        },
      },
      reading: {
        type: "object",
        properties: {
          summary: { type: "string" },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" }, text: { type: "string" } },
              required: ["title", "text"],
              additionalProperties: false,
            },
          },
          questions: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "points", "questions"],
        additionalProperties: false,
      },
      directions: {
        type: "object",
        properties: { chose: { type: "array", items: { type: "string" } }, rejected: { type: "array", items: { type: "string" } } },
        required: ["chose", "rejected"],
        additionalProperties: false,
      },
      headline: { type: "string" },
    },
    required: ["reading", "dimensions", "directions", "headline"],
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
      tension: z.enum(["agrees", "differs", "explained", "unclear"]),
      line: z.string(),
      ask: z.string(),
    }),
  ),
  reading: z.object({
    summary: z.string(),
    points: z.array(z.object({ title: z.string(), text: z.string() })),
    questions: z.array(z.string()),
  }),
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
 * Write the prep page's report for a brief: read what the client is asking for
 * as a whole, place their words about the look on the rubric, set those against
 * their choices, and write it up. One Claude call, saved.
 */
export async function generateReport(db: SupabaseClient, briefId: string): Promise<Report> {
  const { data: brief, error } = await db
    .from("briefs")
    .select("id, studio_id, questions, plan, completed_at, project_type, medium")
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
    messages: [
      {
        role: "user",
        content: describe(plan, ev, questions, answers, descriptions, `${String(brief.project_type).replace(/_/g, " ")}${brief.medium ? ` (images favour ${String(brief.medium).replace(/_/g, " ")})` : ""}`),
      },
    ],
    output_config: { effort: "medium", format: jsonSchemaOutputFormat(outputSchema(keys) as OutputSchema, { transform: false }) },
  });
  await recordClaude(db, { studioId: brief.studio_id as string, kind: "report", model: response.model, usage: response.usage });
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

  // Contradictions follow the numbers, by the same rule the taste profile highlights,
  // unless their story explains the difference. Few pairs make it a hint, not a finding.
  const contradictions = ev.dimensions
    .map((d) => {
      const s = said.find((x) => x.key === d.key);
      const written = result.dimensions.find((x) => x.key === d.key);
      const gap = s?.position === null || s?.position === undefined ? 0 : Math.abs(s.position - d.mean);
      return {
        key: d.key,
        gap,
        line: written?.line.trim() ?? "",
        ask: written?.ask.trim() ?? "",
        confidence: d.confidence,
        tension: written?.tension ?? "unclear",
        tentative: d.pairs < 3 || d.confidence !== "high",
      };
    })
    .filter((c) => c.gap >= GAP && c.confidence !== "low" && c.line && c.tension === "differs")
    .sort((a, b) => b.gap - a.gap)
    .map(({ key, line, ask, tentative }) => ({ key, line, ask, tentative }));

  const content: ReportContent = {
    headline: result.headline.trim(),
    reading: {
      summary: result.reading.summary.trim(),
      points: result.reading.points
        .map((p) => ({ title: p.title.trim(), text: p.text.trim() }))
        .filter((p) => p.title && p.text)
        .slice(0, 4),
      questions: result.reading.questions.map((q) => q.trim()).filter(Boolean).slice(0, 5),
    },
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
