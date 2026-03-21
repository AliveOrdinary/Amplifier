import { createServerClient as createSupabaseSSRClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

/**
 * Require authentication for API routes (defense-in-depth).
 * Uses getUser() instead of getSession() to verify with the Supabase auth server.
 * Returns the authenticated user or a 401 response.
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: User } | NextResponse> {
  const supabase = createSupabaseSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return { user }
}
