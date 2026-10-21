import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DIMENSION_KEYS, MEDIUM_KEYS, clampScore, type DimensionKey } from "./constants";

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
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    medium: { type: "string", enum: MEDIUM_KEYS },
    description: { type: "string", description: "One plain sentence, at most 20 words." },
    scores: {
      type: "object",
      properties: Object.fromEntries(DIMENSION_KEYS.map((key) => [key, dimensionSchema])),
      required: DIMENSION_KEYS,
      additionalProperties: false,
    },
  },
  required: ["medium", "description", "scores"],
  additionalProperties: false,
};

/** Validates Claude's answer; tolerant of enum casing. */
const ScoreResult = z.object({
  medium: z.string().transform((value) => {
    const key = value.toLowerCase();
    return (MEDIUM_KEYS as string[]).includes(key) ? key : null;
  }),
  description: z.string(),
  scores: z.object(
    Object.fromEntries(
      DIMENSION_KEYS.map((key) => [key, z.object({ score: z.number(), confidence: z.number() })]),
    ) as Record<DimensionKey, z.ZodObject<{ score: z.ZodNumber; confidence: z.ZodNumber }>>,
  ),
});

const SYSTEM_PROMPT = `You catalogue reference images for Amplifier, a graphic design studio whose clients are mostly musicians, filmmakers, galleries and other artists. The studio uses these scores to show clients images that test their taste, so consistency across images matters more than nuance in any single one.

Score the image on each dimension from -2 to +2, in steps of 0.5. Score what the design itself expresses, not its subject matter. Use 0 when the image is balanced, mixed, or the dimension doesn't apply, and give low confidence in that case.

density: -2 minimal (few elements, generous empty space) … +2 rich (many elements, layered, dense, busy)
volume: -2 quiet (muted, low contrast, restrained, small type) … +2 loud (high contrast, saturated, large type, attention-grabbing)
temperature: -2 warm (reds, oranges, yellows, earth tones, warm light) … +2 cool (blues, greens, cold greys, cold light). Black-and-white or balanced palettes score near 0.
era: -2 classic (historical references, traditional craft, period styles such as art nouveau, Swiss modernism, 70s) … +2 contemporary (current, of the moment)
form: -2 organic (curves, hand-drawn lines, natural and irregular shapes) … +2 geometric (grids, straight lines, precise construction)
tone: -2 serious (sober, formal, grave) … +2 playful (humorous, light, whimsical)
finish: -2 crafted (handmade, textured, imperfect, analogue, print artefacts) … +2 polished (slick, digital, glossy, highly refined)
abstraction: -2 literal (photographic or figurative, a recognisable subject) … +2 abstract (non-representational shapes, pattern or type alone)

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

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic();
  return client;
}

/**
 * Score one image with Claude and save the result. Scores a person has
 * already corrected are kept; only AI scores are replaced. The medium is
 * set only if the image doesn't have one yet.
 */
export async function scoreImage(db: SupabaseClient, imageId: string) {
  const { data: image, error } = await db
    .from("images")
    .select("id, display_path, medium")
    .eq("id", imageId)
    .single();
  if (error || !image?.display_path) throw new Error("The image hasn't been processed yet.");

  const file = await db.storage.from("library").download(image.display_path);
  if (file.error) throw new Error("Couldn't read the image for scoring.");
  const data = Buffer.from(await file.data.arrayBuffer()).toString("base64");

  const response = await anthropic().messages.parse({
    model: SCORING_MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/webp", data } },
          { type: "text", text: "Score this reference image." },
        ],
      },
    ],
    output_config: {
      effort: "low",
      format: jsonSchemaOutputFormat(OUTPUT_SCHEMA as OutputSchema, { transform: false }),
    },
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to score this image.");
  const parsed = ScoreResult.safeParse(response.parsed_output);
  if (!parsed.success) throw new Error("Claude's answer couldn't be read.");
  const result = parsed.data;

  const { data: human } = await db
    .from("image_scores")
    .select("dimension")
    .eq("image_id", image.id)
    .eq("source", "human");
  const keep = new Set((human ?? []).map((row) => row.dimension as string));

  const rows = DIMENSION_KEYS.filter((key) => !keep.has(key)).map((key) => ({
    image_id: image.id,
    dimension: key,
    score: clampScore(result.scores[key].score),
    confidence: Math.max(0, Math.min(1, Math.round(result.scores[key].confidence * 100) / 100)),
    source: "ai",
  }));
  if (rows.length) {
    const upsert = await db.from("image_scores").upsert(rows, { onConflict: "image_id,dimension" });
    if (upsert.error) throw new Error(`Couldn't save scores: ${upsert.error.message}`);
  }

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
