import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_TAG } from "@/lib/portfolio";
import { clearScores, scoreProject } from "@/lib/portfolio/scores";

export const maxDuration = 60;
const BUDGET_MS = 50_000;

/**
 * Score a project's pictures on the rubric (lib/portfolio/scores.ts). Does
 * what fits in one request and says how many are left; the Images and video
 * panel calls again until none are. `again`: "all" forgets Claude's scores
 * first, "failed" retries the ones it couldn't do.
 *
 * A route, not a server action: the browser runs a page's server actions one
 * at a time, and this would hold up every save behind it.
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  const member = await getMember();
  const body = (await request.json().catch(() => ({}))) as { projectId?: unknown; again?: unknown };
  if (typeof body.projectId !== "string" || !/^[0-9a-f-]{36}$/.test(body.projectId)) {
    return NextResponse.json({ ok: false, error: "No project given." }, { status: 400 });
  }

  try {
    const db = await createClient();
    // Row level security: a project of another studio isn't found.
    const { data: project } = await db.from("projects").select("id").eq("id", body.projectId).maybeSingle();
    if (!project) return NextResponse.json({ ok: false, error: "That project no longer exists." }, { status: 404 });

    if (body.again === "all" || body.again === "failed") await clearScores(db, project.id, { failedOnly: body.again === "failed" });
    const result = await scoreProject(db, member.studioId, project.id, { deadline: started + BUDGET_MS });
    // The Work page's mix reads the scores.
    if (result.scored) revalidateTag(PORTFOLIO_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("portfolio scoring failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Couldn't score the pictures." }, { status: 500 });
  }
}
