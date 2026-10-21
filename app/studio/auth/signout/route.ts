import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs out an account that is signed in but isn't a studio member, then
 * shows the login page with an explanation.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const login = new URL("/studio/login", request.url);
  if (request.nextUrl.searchParams.get("reason") === "not-member") {
    login.searchParams.set("error", "not-member");
  }
  return NextResponse.redirect(login);
}
