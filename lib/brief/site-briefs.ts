import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Briefs visitors started on the site that no member has opened yet: the
 * count on the Briefs tab. Zero until migration 16 is applied.
 */
export async function unseenSiteBriefs(studioId: string): Promise<number> {
  const db = await createClient();
  const { count, error } = await db
    .from("briefs")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("source", "site")
    .is("seen_at", null);
  return error ? 0 : (count ?? 0);
}
