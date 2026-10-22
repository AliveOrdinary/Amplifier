import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Functions and Route
 * Handlers, acting as the signed-in user (row level security applies).
 * Reads cookies, so callers must sit behind a <Suspense> boundary.
 */
export async function createClient() {
  const { url, key } = supabaseEnv();
  // Supabase checks the session's expiry against the clock: keep that at
  // request time, out of Next's prerendered shell.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies. The proxy refreshes the
          // session on every studio request, so this is safe to ignore.
        }
      },
    },
  });
}
