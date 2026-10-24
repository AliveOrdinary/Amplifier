import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { readCards, readProject } from "./read";
import type { Project, ProjectCard } from "./types";

/**
 * The portfolio for the public site. Use these in Server Components:
 *
 *   const projects = await listProjects();                 // Works
 *   const featured = await listProjects({ featured: true }); // Home
 *   const project = await getProject(slug);                // a case study, or null → notFound()
 *
 * Results are cached and refresh as soon as anyone saves in Studio ›
 * Portfolio. When a member opens Preview, getProject also returns that
 * draft (project.draft is true) for their browser only.
 *
 * Types: "@/lib/portfolio/types".
 */

export type { Block, MediaBlock, PortfolioMedia, Project, ProjectCard, TextBlock } from "./types";

/** Saving anything in Studio › Portfolio refreshes everything tagged with this. */
export const PORTFOLIO_TAG = "portfolio";

/** Reads what anyone may see: published projects only (row level security). */
function publicClient() {
  const { url, key } = supabaseEnv();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Published projects in the studio's order. `featured: true` for the ones marked for Home. */
export async function listProjects(options: { featured?: boolean } = {}): Promise<ProjectCard[]> {
  "use cache";
  cacheTag(PORTFOLIO_TAG);
  cacheLife("max");
  return readCards(publicClient(), { featured: options.featured });
}

/** A published project by its address, or a draft while a member previews it. Null when there's none. */
export async function getProject(slug: string): Promise<Project | null> {
  "use cache";
  cacheTag(PORTFOLIO_TAG);
  cacheLife("max");
  // Preview is only ever switched on for signed-in members (app/api/portfolio/preview).
  const { isEnabled: preview } = await draftMode();
  return readProject(preview ? createAdminClient() : publicClient(), slug, { includeDrafts: preview, preview });
}

/** Addresses of every published project, e.g. for generateStaticParams or a sitemap. */
export async function listSlugs(): Promise<string[]> {
  return (await listProjects()).map((p) => p.slug);
}
