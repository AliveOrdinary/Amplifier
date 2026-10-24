import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Preview: a studio member opens a project's public page, drafts included.
 * Only members get the preview cookie; anyone else is sent to sign in.
 * /api/portfolio/preview?id=<project id>
 */
export async function GET(request: Request) {
  await getMember();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const db = await createClient();
  const { data: project } = await db.from("projects").select("slug").eq("id", id).maybeSingle();
  if (!project) redirect("/studio/portfolio");

  (await draftMode()).enable();
  redirect(`/projects/${project.slug}`);
}
