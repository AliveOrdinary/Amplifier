import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { SLUG_PATTERN } from "@/lib/portfolio/blocks";

/** Leave preview: /api/portfolio/preview/exit?slug=crums (&lang=fr) goes back to the public page, or to the studio. */
export async function GET(request: Request) {
  (await draftMode()).disable();
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug") ?? "";
  const prefix = params.get("lang") === "fr" ? "/fr" : "";
  redirect(SLUG_PATTERN.test(slug) ? `${prefix}/projects/${slug}` : "/studio/portfolio");
}
