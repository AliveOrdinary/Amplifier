import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIUM_KEYS, clampScore } from "./constants";
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

/** Sent as-is: enums are supported by structured outputs. */
function outputSchema(keys: string[]) {
  return {
    type: "object",
    properties: {
      medium: { type: "string", enum: MEDIUM_KEYS },
      description: { type: "string", description: "One plain sentence, at most 20 words." },
      scores: {
        type: "object",
        properties: Object.fromEntries(keys.map((key) => [key, dimensionSchema])),
        required: keys,
        additionalProperties: false,
      },
    },
    required: ["medium", "description", "scores"],
    additionalProperties: false,
  };
}

/** Validates Claude's answer; tolerant of enum casing. */
function resultSchema(keys: string[]) {
  return z.object({
    medium: z.string().transform((value) => {
      const key = value.toLowerCase();
      return (MEDIUM_KEYS as string[]).includes(key) ? key : null;
    }),
    description: z.string(),
    scores: z.object(
      Object.fromEntries(keys.map((key) => [key, z.object({ score: z.number(), confidence: z.number() })])),
    ),
  });
}

/** The rubric in the studio's own words. Stable until the rubric changes, so it caches well. */
function systemPrompt(dimensions: DimensionRow[]) {
  const rubric = dimensions
    .map((d) => `${d.key}: -2 ${d.left} (${d.leftDefinition.trim() || "no definition"}) … +2 ${d.right} (${d.rightDefinition.trim() || "no definition"})`)
    .join("\n");

  return `You catalogue reference images for Amplifier, a graphic design studio whose clients are mostly musicians, filmmakers, galleries and other artists. The studio uses these scores to show clients images that test their taste, so consistency across images matters more than nuance in any single one.

Score the image on each dimension from -2 to +2, in steps of 0.5. Score what the design itself expresses, not its subject matter. Use 0 when the image is balanced, mixed, or the dimension doesn't apply, and give low confidence in that case.

The dimensions are the studio's own. Each end is described by what you can see:
${rubric}

The studio may also show you anchor images that define each end, and images it has scored by hand. Treat both as the studio's judgement: where they disagree with your own reading of a definition, follow them.

medium: what the piece most likely is.
- identity: logos, brand systems, stationery, brand guidelines
- typography: type specimens, lettering, type-led layouts
- album_art: record, single or EP covers and music packaging
- poster_key_art: posters, film key art, event and gig posters
- motion_titles: title sequences, motion graphics stills, video frames
- web: websites, app screens, digital interfaces
- packaging: product packaging and labels
- photography: photographs where the photo itself is the work
- exhibition_spatial: exhibition graphics, signage, wayfinding, interiors

description: one plain sentence of at most 20 words saying what the piece is and its visual style. Don't name or identify people. Mention a brand or artist only if their name is clearly written in the image.`;
}

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

type Block = Anthropic.Messages.ContentBlockParam;

/** Anchor images and past corrections, shown before the image to score. */
function referenceBlocks(dimensions: DimensionRow[], anchors: Anchor[], corrections: Correction[]): Block[] {
  const blocks: Block[] = [];
  const label = new Map(dimensions.map((d) => [d.key, d]));

  if (anchors.length) {
    blocks.push({ type: "text", text: "Anchor images the studio chose to show each end of a dimension:" });
    for (const d of dimensions) {
      for (const side of ["left", "right"] as const) {
        const images = anchors.filter((a) => a.dimension === d.key && a.side === side);
        if (!images.length) continue;
        blocks.push({ type: "text", text: `${d.key}, ${side === "left" ? `-2 ${d.left}` : `+2 ${d.right}`}:` });
        for (const a of images) blocks.push({ type: "image", source: { type: "url", url: a.url } });
      }
    }
  }

  if (corrections.length) {
    blocks.push({ type: "text", text: "Images the studio scored by hand, where it corrected an earlier score:" });
    for (const c of corrections) {
      blocks.push({ type: "image", source: { type: "url", url: c.url } });
      const lines = c.scores
        .filter((s) => label.has(s.dimension))
        .map((s) => `${s.dimension} ${fmt(s.score)}${s.ai !== null && s.ai !== s.score ? ` (not ${fmt(s.ai)})` : ""}`);
      blocks.push({ type: "text", text: `Studio's scores: ${lines.join(", ")}` });
    }
  }

  // Cache everything up to here: it only changes when the studio does.
  const last = blocks.at(-1);
  if (last && (last.type === "text" || last.type === "image")) last.cache_control = { type: "ephemeral" };
  return blocks;
}

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic();
  return client;
}

/**
 * Score one image with Claude against the studio's rubric and save the
 * result. Scores a person has corrected are kept (Claude's opinion is stored
 * alongside); only AI scores are replaced. The medium is set only if the
 * image doesn't have one yet.
 */
export async function scoreImage(db: SupabaseClient, imageId: string) {
  const { data: image, error } = await db
    .from("images")
    .select("id, studio_id, display_path, medium")
    .eq("id", imageId)
    .single();
  if (error || !image?.display_path) throw new Error("The image hasn't been processed yet.");

  const dimensions = await listDimensions(db, image.studio_id);
  if (!dimensions.length) throw new Error("The rubric has no dimensions. Add one in Settings › Rubric.");
  const keys = dimensions.map((d) => d.key);

  const [file, anchors, corrections] = await Promise.all([
    db.storage.from("library").download(image.display_path),
    listAnchors(db, keys).then((list) => list.filter((a) => a.imageId !== image.id)),
    recentCorrections(db, image.studio_id, keys, { exclude: image.id }),
  ]);
  if (file.error) throw new Error("Couldn't read the image for scoring.");
  const data = Buffer.from(await file.data.arrayBuffer()).toString("base64");

  const ask = (references: Block[]) =>
    anthropic().messages.parse({
      model: SCORING_MODEL,
      max_tokens: 4000,
      system: [{ type: "text", text: systemPrompt(dimensions), cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            ...references,
            { type: "image", source: { type: "base64", media_type: "image/webp", data } },
            { type: "text", text: "Score this reference image." },
          ],
        },
      ],
      output_config: {
        effort: "low",
        format: jsonSchemaOutputFormat(outputSchema(keys) as OutputSchema, { transform: false }),
      },
    });

  const references = referenceBlocks(dimensions, anchors, corrections);
  let response;
  try {
    response = await ask(references);
  } catch (err) {
    // A reference image that can't be fetched shouldn't stop scoring.
    if (!references.length || !(err instanceof Anthropic.BadRequestError)) throw err;
    response = await ask([]);
  }

  if (response.stop_reason === "refusal") throw new Error("Claude declined to score this image.");
  const parsed = resultSchema(keys).safeParse(response.parsed_output);
  if (!parsed.success) throw new Error("Claude's answer couldn't be read.");
  const result = parsed.data;
  const scores = result.scores as Record<string, { score: number; confidence: number }>;

  const { data: human } = await db
    .from("image_scores")
    .select("dimension")
    .eq("image_id", image.id)
    .eq("source", "human");
  const keep = new Set((human ?? []).map((row) => row.dimension as string));

  const confidence = (value: number) => Math.max(0, Math.min(1, Math.round(value * 100) / 100));
  const rows = keys
    .filter((key) => !keep.has(key))
    .map((key) => ({
      image_id: image.id,
      dimension: key,
      score: clampScore(scores[key].score),
      ai_score: clampScore(scores[key].score),
      confidence: confidence(scores[key].confidence),
      source: "ai",
      needs_check: false,
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
        db.from("image_scores").update({ ai_score: clampScore(scores[key].score) }).eq("image_id", image.id).eq("dimension", key),
      ),
  );

  const update = await db
    .from("images")
    .update({
      description: result.description.trim().slice(0, 300),
      medium: image.medium ?? result.medium,
      scored_at: new Date().toISOString(),
      scored_by: SCORING_MODEL,
      score_error: null,
    })
    .eq("id", image.id);
  if (update.error) throw new Error(`Couldn't save the description: ${update.error.message}`);
}
