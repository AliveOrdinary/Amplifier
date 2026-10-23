import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIUM_KEYS, clampScore } from "./constants";
import { recordClaude } from "@/lib/usage";
import { listAnchors, listDimensions, recentCorrections, type Anchor, type Correction, type DimensionRow } from "./rubric";

/** Change without a deploy by setting AMPLIFIER_SCORING_MODEL on Vercel. */
export const SCORING_MODEL = process.env.AMPLIFIER_SCORING_MODEL ?? "claude-sonnet-5-5";

const dimensionSchema = {
  type: "object",
  properties: {
    score: { type: "number", description: "From -2 to 2 in steps of 0.5. 0 means balanced, mixed or not applicable." },
    confidence: { type: "number", description: "From 0 to 1: how clearly the image shows this quality." },
  },
  required: ["score", "confidence"],
  additionalProperties: false,
};

type OutputSchema = Parameters<typeof jsonSchemaOutputFormat>[0];

/**
 * Sent as-is: enums are supported by structured outputs. A full score also
 * asks for the medium and a description; rescoring a few changed dimensions
 * asks only for those scores, which keeps the answer (and the bill) short.
 */
function outputSchema(keys: string[], full: boolean) {
  const scores = {
    type: "object",
    properties: Object.fromEntries(keys.map((key) => [key, dimensionSchema])),
    required: keys,
    additionalProperties: false,
  };
  if (!full) return { type: "object", properties: { scores }, required: ["scores"], additionalProperties: false };
  return {
    type: "object",
    properties: {
      medium: { type: "string", enum: MEDIUM_KEYS },
      description: { type: "string", description: "One plain sentence, at most 20 words." },
      scores,
    },
    required: ["medium", "description", "scores"],
    additionalProperties: false,
  };
}

/** Validates Claude's answer; tolerant of enum casing. */
function resultSchema(keys: string[], full: boolean) {
  const scores = z.object(
    Object.fromEntries(keys.map((key) => [key, z.object({ score: z.number(), confidence: z.number() })])),
  );
  if (!full) return z.object({ scores, medium: z.null().default(null), description: z.null().default(null) });
  return z.object({
    medium: z.string().transform((value) => {
      const key = value.toLowerCase();
      return (MEDIUM_KEYS as string[]).includes(key) ? key : null;
    }),
    description: z.string(),
    scores,
  });
}

/** The rubric in the studio's own words. Stable until the rubric changes, so it caches well. */
function systemPrompt(dimensions: DimensionRow[]) {
  const rubric = dimensions
    .map((d) => `${d.key}: -2 ${d.left} (${d.leftDefinition.trim() || "no definition"}) … +2 ${d.right} (${d.rightDefinition.trim() || "no definition"})`)
    .join("\n");

  return `You catalogue reference images for Amplifier, a graphic design studio that works for all kinds of clients: musicians and artists, clinics, shops, products, events and more. The studio uses these scores to show clients images that test their taste, so consistency across images matters more than nuance in any single one.

Score the image on each dimension you're asked for, from -2 to +2, in steps of 0.5. Score what the design itself expresses, not its subject matter. Use 0 when the image is balanced, mixed, or the dimension doesn't apply, and give low confidence in that case.

The dimensions are the studio's own. Each end is described by what you can see:
${rubric}

The studio may also show you anchor images that define each end, and images it has scored by hand. Treat both as the studio's judgement: where they disagree with your own reading of a definition, follow them.

medium (when asked): what the piece most likely is.
- identity: logos, brand systems, stationery, brand guidelines
- typography: type specimens, lettering, type-led layouts
- album_art: record, single or EP covers and music packaging
- poster_key_art: posters, film key art, event and campaign posters
- motion_titles: title sequences, motion graphics stills, video frames
- web: websites, app screens, digital interfaces
- packaging: product packaging and labels
- photography: photographs where the photo itself is the work
- exhibition_spatial: exhibition and gallery graphics
- signage_wayfinding: signs, wayfinding systems, building graphics
- interiors: rooms and spaces where the interior design is the work
- print_editorial: books, magazines, brochures, menus and other printed matter
- illustration: illustrations where the drawing itself is the work

description (when asked): one plain sentence of at most 20 words saying what the piece is and its visual style. Don't name or identify people. Mention a brand or artist only if their name is clearly written in the image.`;
}

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

type Block = Anthropic.Messages.ContentBlockParam;

/** Thumbnails reused across a burst of scoring (anchors and corrections repeat). */
const thumbs = new Map<string, Promise<string | null>>();
function thumbData(url: string) {
  const key = url.split("?")[0];
  let data = thumbs.get(key);
  if (!data) {
    data = fetch(url, { signal: AbortSignal.timeout(15_000) })
      .then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()).toString("base64") : null))
      .catch(() => null);
    thumbs.set(key, data);
    if (thumbs.size > 300) thumbs.delete(thumbs.keys().next().value!);
    void data.then((d) => d === null && thumbs.delete(key));
  }
  return data;
}

/** Anchor images and past corrections, shown before the image to score. */
async function referenceBlocks(dimensions: DimensionRow[], anchors: Anchor[], corrections: Correction[]): Promise<Block[]> {
  const blocks: Block[] = [];
  const label = new Map(dimensions.map((d) => [d.key, d]));
  const data = new Map(
    await Promise.all([...anchors.map((a) => a.url), ...corrections.map((c) => c.url)].map(async (url) => [url, await thumbData(url)] as const)),
  );
  const image = (url: string): Block | null => {
    const base64 = data.get(url);
    return base64 ? { type: "image", source: { type: "base64", media_type: "image/webp", data: base64 } } : null;
  };

  const anchorBlocks: Block[] = [];
  for (const d of dimensions) {
    for (const side of ["left", "right"] as const) {
      const images = anchors
        .filter((a) => a.dimension === d.key && a.side === side)
        .map((a) => image(a.url))
        .filter((b): b is Block => b !== null);
      if (!images.length) continue;
      anchorBlocks.push({ type: "text", text: `${d.key}, ${side === "left" ? `-2 ${d.left}` : `+2 ${d.right}`}:` }, ...images);
    }
  }
  if (anchorBlocks.length) {
    blocks.push({ type: "text", text: "Anchor images the studio chose to show each end of a dimension:" }, ...anchorBlocks);
  }

  const correctionBlocks: Block[] = [];
  for (const c of corrections) {
    const picture = image(c.url);
    if (!picture) continue;
    const lines = c.scores
      .filter((s) => label.has(s.dimension))
      .map((s) => `${s.dimension} ${fmt(s.score)}${s.ai !== null && s.ai !== s.score ? ` (not ${fmt(s.ai)})` : ""}`);
    correctionBlocks.push(picture, { type: "text", text: `Studio's scores: ${lines.join(", ")}` });
  }
  if (correctionBlocks.length) {
    blocks.push({ type: "text", text: "Images the studio scored by hand, where it corrected an earlier score:" }, ...correctionBlocks);
  }

  // Cache everything up to here: it only changes when the studio does.
  const last = blocks.at(-1);
  if (last && (last.type === "text" || last.type === "image")) last.cache_control = { type: "ephemeral" };
  return blocks;
}


let client: Anthropic | null = null;
export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic();
  return client;
}

/** The rubric and reference images, read once and shared by every image scored with it. */
export type ScoringContext = { studioId: string; dimensions: DimensionRow[]; references: Block[] };

export async function scoringContext(
  db: SupabaseClient,
  studioId: string,
  { exclude }: { exclude?: string } = {},
): Promise<ScoringContext> {
  const dimensions = await listDimensions(db, studioId);
  if (!dimensions.length) throw new Error("The rubric has no dimensions. Add one in Settings › Rubric.");
  const keys = dimensions.map((d) => d.key);
  const [anchors, corrections] = await Promise.all([
    listAnchors(db, keys).then((list) => list.filter((a) => a.imageId !== exclude)),
    recentCorrections(db, studioId, keys, { exclude }),
  ]);
  return { studioId, dimensions, references: await referenceBlocks(dimensions, anchors, corrections) };
}

export type ScoreRequest = {
  imageId: string;
  /** The dimensions asked for. */
  keys: string[];
  /** Also asks for the medium and a description (a first score, not a partial rescore). */
  full: boolean;
  params: Anthropic.Messages.MessageCreateParamsNonStreaming;
};

/**
 * Everything Claude needs to score one image: the same request goes to the
 * Messages API for one image now, or into a batch for many later. `only`
 * limits it to the dimensions that changed.
 */
export async function buildScoreRequest(
  db: SupabaseClient,
  imageId: string,
  context: ScoringContext,
  only?: string[] | null,
): Promise<ScoreRequest> {
  const { data: image, error } = await db.from("images").select("id, display_path").eq("id", imageId).single();
  if (error || !image?.display_path) throw new Error("The image hasn't been processed yet.");
  const file = await db.storage.from("library").download(image.display_path);
  if (file.error) throw new Error("Couldn't read the image for scoring.");
  const data = Buffer.from(await file.data.arrayBuffer()).toString("base64");

  const active = context.dimensions.map((d) => d.key);
  const keys = only ? active.filter((key) => only.includes(key)) : active;
  if (!keys.length) throw new Error("None of those dimensions are in the rubric any more.");
  const full = !only;

  return {
    imageId,
    keys,
    full,
    params: {
      model: SCORING_MODEL,
      max_tokens: full ? 4000 : 1500,
      system: [{ type: "text", text: systemPrompt(context.dimensions), cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            ...context.references,
            { type: "image", source: { type: "base64", media_type: "image/webp", data } },
            {
              type: "text",
              text: full ? "Score this reference image." : `Score this reference image on ${keys.join(", ")} only.`,
            },
          ],
        },
      ],
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: outputSchema(keys, full) as OutputSchema },
      },
    },
  };
}

/** Claude's structured answer from a finished message. */
export function readAnswer(message: Anthropic.Messages.Message): unknown {
  if (message.stop_reason === "refusal") throw new Error("Claude declined to score this image.");
  const text = message.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude's answer was empty.");
  try {
    return JSON.parse(text.text);
  } catch {
    throw new Error("Claude's answer couldn't be read.");
  }
}

export type ScoreOutcome = {
  /** Claude's confidence across the dimensions asked, for deciding whether a person should look. */
  averageConfidence: number | null;
  /** The dimension Claude was least sure about. */
  leastSure: { key: string; confidence: number } | null;
};

/**
 * Save Claude's scores. Scores a person has corrected are kept (Claude's
 * opinion is stored alongside); only AI scores are replaced. The medium is
 * set only if the image doesn't have one yet.
 */
export async function applyScores(
  db: SupabaseClient,
  request: Pick<ScoreRequest, "imageId" | "keys" | "full">,
  answer: unknown,
): Promise<ScoreOutcome> {
  const { imageId, keys, full } = request;
  const parsed = resultSchema(keys, full).safeParse(answer);
  if (!parsed.success) throw new Error("Claude's answer couldn't be read.");
  const result = parsed.data;
  const scores = result.scores as Record<string, { score: number; confidence: number }>;
  const scoredAt = new Date().toISOString();

  const { data: human } = await db.from("image_scores").select("dimension").eq("image_id", imageId).eq("source", "human");
  const keep = new Set((human ?? []).map((row) => row.dimension as string));

  const confidence = (value: number) => Math.max(0, Math.min(1, Math.round(value * 100) / 100));
  const rows = keys
    .filter((key) => !keep.has(key))
    .map((key) => ({
      image_id: imageId,
      dimension: key,
      score: clampScore(scores[key].score),
      ai_score: clampScore(scores[key].score),
      confidence: confidence(scores[key].confidence),
      source: "ai",
      needs_check: false,
      ai_scored_at: scoredAt,
    }));
  if (rows.length) {
    const upsert = await db.from("image_scores").upsert(rows, { onConflict: "image_id,dimension" });
    if (upsert.error) throw new Error(`Couldn't save scores: ${upsert.error.message}`);
  }
  // Corrected scores stay, but remember what Claude thinks now.
  await Promise.all(
    keys
      .filter((key) => keep.has(key))
      .map((key) =>
        db
          .from("image_scores")
          .update({ ai_score: clampScore(scores[key].score), ai_scored_at: scoredAt })
          .eq("image_id", imageId)
          .eq("dimension", key),
      ),
  );

  if (full) {
    const { data: image } = await db.from("images").select("medium").eq("id", imageId).single();
    const update = await db
      .from("images")
      .update({
        description: (result.description ?? "").trim().slice(0, 300),
        medium: image?.medium ?? result.medium,
        scored_at: scoredAt,
        scored_by: SCORING_MODEL,
        score_error: null,
      })
      .eq("id", imageId);
    if (update.error) throw new Error(`Couldn't save the description: ${update.error.message}`);
  } else {
    await db.from("images").update({ score_error: null }).eq("id", imageId);
  }

  const all = keys.map((key) => ({ key, confidence: confidence(scores[key].confidence) }));
  const leastSure = all.reduce<ScoreOutcome["leastSure"]>((low, s) => (!low || s.confidence < low.confidence ? s : low), null);
  const averageConfidence = all.length ? all.reduce((sum, s) => sum + s.confidence, 0) / all.length : null;
  return { averageConfidence, leastSure };
}

/** Score one image now (an image added by hand, or a small rescore). */
export async function scoreImage(db: SupabaseClient, imageId: string, { only }: { only?: string[] | null } = {}) {
  const { data: image, error } = await db.from("images").select("studio_id").eq("id", imageId).single();
  if (error || !image) throw new Error("That image no longer exists.");
  const context = await scoringContext(db, image.studio_id as string, { exclude: imageId });

  let request = await buildScoreRequest(db, imageId, context, only);
  let message;
  try {
    message = await anthropic().messages.create(request.params);
  } catch (err) {
    // A bad reference image shouldn't stop scoring.
    if (!context.references.length || !(err instanceof Anthropic.BadRequestError)) throw err;
    console.warn("Scoring without references:", err.message);
    request = await buildScoreRequest(db, imageId, { ...context, references: [] }, only);
    message = await anthropic().messages.create(request.params);
  }
  await recordClaude(db, { studioId: image.studio_id as string, kind: "score", model: message.model, usage: message.usage, images: 1 });
  return applyScores(db, request, readAnswer(message));
}
