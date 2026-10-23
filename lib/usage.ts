import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the AI services cost, recorded as the studio uses them. The numbers
 * are estimates from the token counts each API reports and list prices; the
 * Anthropic and Voyage dashboards hold the real bills.
 */

export type UsageKind = "score" | "score_batch" | "report" | "embed_image" | "embed_text";

/** US dollars per million tokens. The Batch API is half price. */
const CLAUDE_PRICES: Record<string, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  "claude-haiku-5-5": { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
};
const DEFAULT_CLAUDE = CLAUDE_PRICES["claude-sonnet-5-5"];

/** voyage-multimodal-3.5: $0.12 per million text tokens, $0.60 per billion pixels (50k–2M per image). */
const VOYAGE_PER_TOKEN = 0.12 / 1e6;
const VOYAGE_PER_PIXEL = 0.6 / 1e9;

export type ClaudeUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Add up the usage of several messages (a batch). */
type UsageTotals = { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };

export function sumUsage(list: ClaudeUsage[]): UsageTotals {
  return list.reduce<UsageTotals>(
    (t, u) => ({
      input_tokens: t.input_tokens + n(u.input_tokens),
      output_tokens: t.output_tokens + n(u.output_tokens),
      cache_creation_input_tokens: t.cache_creation_input_tokens + n(u.cache_creation_input_tokens),
      cache_read_input_tokens: t.cache_read_input_tokens + n(u.cache_read_input_tokens),
    }),
    { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  );
}

export function claudeCost(model: string, usage: ClaudeUsage, { batch = false } = {}) {
  const p = CLAUDE_PRICES[model] ?? DEFAULT_CLAUDE;
  const dollars =
    (n(usage.input_tokens) * p.input +
      n(usage.cache_creation_input_tokens) * p.cacheWrite +
      n(usage.cache_read_input_tokens) * p.cacheRead +
      n(usage.output_tokens) * p.output) /
    1e6;
  return batch ? dollars / 2 : dollars;
}

/** Record one Claude call (or one finished batch). Never throws: recording mustn't break the work. */
export async function recordClaude(
  db: SupabaseClient,
  input: { studioId: string; kind: UsageKind; model: string; usage: ClaudeUsage; images?: number; batch?: boolean },
) {
  await insert(db, {
    studio_id: input.studioId,
    kind: input.kind,
    model: input.model,
    images: input.images ?? 0,
    input_tokens: n(input.usage.input_tokens),
    cache_write_tokens: n(input.usage.cache_creation_input_tokens),
    cache_read_tokens: n(input.usage.cache_read_input_tokens),
    output_tokens: n(input.usage.output_tokens),
    cost_usd: claudeCost(input.model, input.usage, { batch: input.batch }),
  });
}

/** Record one Voyage call, from the usage it reports. */
export async function recordVoyage(
  db: SupabaseClient,
  input: { studioId: string; kind: UsageKind; model: string; textTokens?: number; images?: number; pixels?: number },
) {
  // Voyage bills each image as at least 50,000 pixels.
  const pixels = Math.max(n(input.pixels), (input.images ?? 0) * 50_000);
  const tokens = n(input.textTokens);
  await insert(db, {
    studio_id: input.studioId,
    kind: input.kind,
    model: input.model,
    images: input.images ?? 0,
    input_tokens: tokens,
    pixels,
    cost_usd: tokens * VOYAGE_PER_TOKEN + pixels * VOYAGE_PER_PIXEL,
  });
}

async function insert(db: SupabaseClient, row: Record<string, unknown>) {
  try {
    const { error } = await db.from("api_usage").insert(row);
    if (error) console.warn("Couldn't record usage:", error.message);
  } catch (err) {
    console.warn("Couldn't record usage:", err);
  }
}

/* ------------------------------------------------------------- reading */

export type Spending = { total: number; byKind: Record<string, { calls: number; images: number; cost: number }> };

/** The first moment of this month and the next, in UTC (how Anthropic and Voyage bill). */
export function monthBounds(offset = 0, now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { from, to };
}

export async function spending(db: SupabaseClient, studioId: string, from: Date, to: Date): Promise<Spending> {
  const { data, error } = await db.rpc("usage_summary", {
    p_studio: studioId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  const byKind: Spending["byKind"] = {};
  let total = 0;
  for (const row of (data ?? []) as { kind: string; calls: number; images: number; cost_usd: number | string }[]) {
    const cost = Number(row.cost_usd);
    byKind[row.kind] = { calls: row.calls, images: row.images, cost };
    total += cost;
  }
  return { total, byKind };
}
