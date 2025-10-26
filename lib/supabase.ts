import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Legacy client for backward compatibility (used in existing client components)
// Uses the anon key which has RLS (Row Level Security) enabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Browser client for client-side operations (use this in new client components)
// Uses @supabase/ssr for better session handling
export function createClientComponentClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server client for server-side operations (API routes, server components)
// Uses the service role key which bypasses RLS
// Only use this in server components or API routes where you need admin access
export function createServerClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Legacy admin client (for backward compatibility)
export const getSupabaseAdmin = createServerClient
