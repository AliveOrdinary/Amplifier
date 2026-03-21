import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /tagger routes and tagger API routes (not /briefing)
  const isProtectedRoute =
    pathname.startsWith('/tagger') ||
    pathname.startsWith('/api/suggest-tags') ||
    pathname.startsWith('/api/check-duplicate') ||
    pathname.startsWith('/api/retrain-prompt') ||
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/api/vocabulary-config')

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Allow login page
  if (pathname === '/tagger/login') {
    return NextResponse.next()
  }

  // API routes return 401 instead of redirecting
  const isApiRoute = pathname.startsWith('/api/')

  // Create response and Supabase client
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Check authentication using getUser() (verifies with auth server, not just JWT)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Redirect to login with return URL
    const redirectUrl = new URL('/tagger/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/tagger/:path*',
    '/api/suggest-tags',
    '/api/check-duplicate',
    '/api/retrain-prompt',
    '/api/admin/:path*',
    '/api/vocabulary-config/:path*',
  ]
}
