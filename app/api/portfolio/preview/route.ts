import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Preview: a studio member opens a project's public page, drafts included.
 * Only members get the preview cookie; anyone else is sent to sign in.
 * /api/portfolio/preview?id=<project id>, and &lang=fr for the French page.
 */
export async function GET(request: Request) {
  await getMember();
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  const french = params.get("lang") === "fr";
  const db = await createClient();
  const { data: project } = await db.from("projects").select("slug").eq("id", id).maybeSingle();
  if (!project) redirect("/studio/portfolio");

  (await draftMode()).enable();
  redirect(`${french ? "/fr" : ""}/projects/${project.slug}`);
}
