import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Runs before every /studio request:
 * - refreshes the Supabase session cookie when it is close to expiry
 * - sends signed-out visitors to the login page (an optimistic check; each
 *   studio page still verifies membership on the server)
 */
export async function proxy(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([header, value]) => response.headers.set(header, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;
  const onLogin = pathname === "/studio/login";

  if (!signedIn && !onLogin) {
    const login = new URL("/studio/login", request.url);
    login.searchParams.set("next", pathname + search);
    return redirectKeepingCookies(login, response);
  }

  if (signedIn && onLogin) {
    return redirectKeepingCookies(new URL("/studio", request.url), response);
  }

  return response;
}

function redirectKeepingCookies(to: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(to);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/studio/:path*"],
};
