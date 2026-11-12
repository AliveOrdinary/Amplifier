import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { FADERS, type FaderKey } from "./channels";
import { readCards, readProject } from "./read";
import type { Locale, Project, ProjectCard } from "./types";

/**
 * The portfolio for the public site. Use these in Server Components:
 *
 *   const projects = await listProjects();                 // Works
 *   const featured = await listProjects({ featured: true }); // Home
 *   const project = await getProject(slug);                // a case study, or null → notFound()
 *   const fr = await getProject(slug, "fr");               // its French, English where none is written
 *
 * Results are cached and refresh as soon as anyone saves in Studio ›
 * Portfolio. When a member opens Preview, getProject also returns that
 * draft (project.draft is true) for their browser only.
 *
 * Types: "@/lib/portfolio/types".
 */

export type { Block, Locale, MediaBlock, PortfolioMedia, Project, ProjectCard, TextBlock } from "./types";

/** Saving anything in Studio › Portfolio refreshes everything tagged with this. */
export const PORTFOLIO_TAG = "portfolio";

/** Reads what anyone may see: published projects only (row level security). */
function publicClient() {
  const { url, key } = supabaseEnv();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Published projects in the studio's order. `featured: true` for the ones
 * marked for Home; `locale: "fr"` for the French, falling back to English.
 */
export async function listProjects(options: { featured?: boolean; locale?: Locale } = {}): Promise<ProjectCard[]> {
  "use cache";
  cacheTag(PORTFOLIO_TAG);
  cacheLife("max");
  return readCards(publicClient(), { featured: options.featured, locale: options.locale });
}

/** A published project by its address (in `locale`), or a draft while a member previews it. Null when there's none. */
export async function getProject(slug: string, locale: Locale = "en"): Promise<Project | null> {
  "use cache";
  cacheTag(PORTFOLIO_TAG);
  cacheLife("max");
  // Preview is only ever switched on for signed-in members (app/api/portfolio/preview).
  const { isEnabled: preview } = await draftMode();
  return readProject(preview ? createAdminClient() : publicClient(), slug, { includeDrafts: preview, preview, locale });
}

/**
 * The Work page's faders as the rubric names them now (Settings › Rubric),
 * by dimension key: a rename there shows on the site. A fader whose dimension
 * was retired, or isn't in the rubric, is missing and keeps the site's own words.
 */
export async function faderLabels(): Promise<Partial<Record<FaderKey, { left: string; right: string }>>> {
  "use cache";
  cacheTag(PORTFOLIO_TAG);
  cacheLife("max");
  // The rubric is the studio's (members only), so the server reads it; only these names leave.
  const { data, error } = await createAdminClient()
    .from("dimensions")
    .select("key, left_label, right_label")
    .in("key", FADERS.map((f) => f.key))
    .is("retired_at", null);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((d) => [d.key, { left: d.left_label as string, right: d.right_label as string }]));
}

/** Addresses of every published project, e.g. for generateStaticParams or a sitemap. */
export async function listSlugs(): Promise<string[]> {
  return (await listProjects()).map((p) => p.slug);
}
