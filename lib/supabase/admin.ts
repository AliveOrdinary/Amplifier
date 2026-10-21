import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client that bypasses row level security. Only for requests
 * that carry no user session (the browser extension's ingest endpoint),
 * after they have been authenticated another way. Always scope queries to
 * a studio id explicitly.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) for server-side ingest.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
