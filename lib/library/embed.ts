import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Image embeddings from Voyage: each image becomes 1024 numbers, and images
 * that look alike get similar numbers. Used for "more like this", catching
 * near-duplicates such as crops and recolours, and choosing brief pairs.
 */
const MODEL = process.env.AMPLIFIER_EMBEDDING_MODEL ?? "voyage-multimodal-3.5";
const ENDPOINT = "https://api.voyageai.com/v1/multimodalembeddings";

/** Below this cosine distance, two images are flagged as probably the same piece. */
export const NEAR_DUPLICATE_DISTANCE = 0.06;

export const embeddingsEnabled = () => Boolean(process.env.VOYAGE_API_KEY);

/** Embed up to a few dozen thumbnails (WebP, 480px) in one request. */
export async function embedImages(images: Buffer[]): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set.");
  if (!images.length) return [];

  const body = JSON.stringify({
    model: MODEL,
    inputs: images.map((bytes) => ({
      content: [{ type: "image_base64", image_base64: `data:image/webp;base64,${bytes.toString("base64")}` }],
    })),
  });

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status === 429 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Voyage returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    const json = (await response.json()) as { data: { embedding: number[]; index: number }[] };
    return [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

/**
 * Embed a piece of text into the same space as the images, so text can find
 * the images it describes (a client's "What are you making?" answer).
 */
export async function embedText(text: string): Promise<number[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set.");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input_type: "query",
      inputs: [{ content: [{ type: "text", text: text.slice(0, 4000) }] }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Voyage returned ${response.status}`);
  const json = (await response.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

/** Embed images and save the results. Failures are recorded on the image, not thrown. */
export async function embedAndStore(db: SupabaseClient, items: { id: string; image: Buffer }[]) {
  if (!items.length || !embeddingsEnabled()) return;
  try {
    const vectors = await embedImages(items.map((i) => i.image));
    const now = new Date().toISOString();
    await Promise.all(
      items.map((item, i) =>
        db
          .from("images")
          .update({ embedding: JSON.stringify(vectors[i]), embedded_at: now, embed_error: null })
          .eq("id", item.id),
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "Embedding failed";
    // Rate limits pass; leave those images to be tried again later.
    if (message.includes(" 429")) return;
    await Promise.all(items.map((item) => db.from("images").update({ embed_error: message }).eq("id", item.id)));
  }
}

/** Read stored thumbnails and embed them. */
export async function embedByIds(db: SupabaseClient, ids: string[]) {
  if (!ids.length) return;
  const { data } = await db.from("images").select("id, thumb_path").in("id", ids).not("thumb_path", "is", null);
  const items: { id: string; image: Buffer }[] = [];
  await Promise.all(
    (data ?? []).map(async (row) => {
      const file = await db.storage.from("library").download(row.thumb_path as string);
      if (file.error) {
        await db.from("images").update({ embed_error: "Couldn't read the image" }).eq("id", row.id);
      } else {
        items.push({ id: row.id as string, image: Buffer.from(await file.data.arrayBuffer()) });
      }
    }),
  );
  await embedAndStore(db, items);
}

/** The images most like this one, closest first. */
export async function similarImages(db: SupabaseClient, imageId: string, limit = 24) {
  const { data, error } = await db.rpc("similar_images", { p_image: imageId, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; distance: number }[];
}
