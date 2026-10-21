import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Member = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "owner" | "member";
  studioId: string;
  studioName: string;
};

/**
 * The signed-in studio member, verified on the server. Signed-out visitors go
 * to the login page; signed-in accounts that aren't studio members are signed
 * out. Deduplicated per request, so call it wherever it's needed.
 */
export const getMember = cache(async (): Promise<Member> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) redirect("/studio/login");

  const { data: row } = await supabase
    .from("members")
    .select("display_name, role, studio_id, studios ( name )")
    .eq("user_id", claims.sub)
    .maybeSingle();

  if (!row) redirect("/studio/auth/signout?reason=not-member");

  const studio = row.studios as unknown as { name: string } | null;
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName: row.display_name,
    role: row.role,
    studioId: row.studio_id,
    studioName: studio?.name ?? "Studio",
  };
});

/** Only allow redirects back into the studio, never to another site. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/studio";
  if (!value.startsWith("/studio") || value.startsWith("//") || value.includes("\\")) return "/studio";
  return value;
}
