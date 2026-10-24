import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { SLUG_PATTERN } from "@/lib/portfolio/blocks";

/** Leave preview: /api/portfolio/preview/exit?slug=crums goes back to the public page, or to the studio. */
export async function GET(request: Request) {
  (await draftMode()).disable();
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  redirect(SLUG_PATTERN.test(slug) ? `/projects/${slug}` : "/studio/portfolio");
}
