import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  console.log('[Middleware] Checking:', pathname); // DEBUG

  // Only protect /tagger routes (not /briefing)
  if (!pathname.startsWith('/tagger')) {
    console.log('[Middleware] Not a tagger route, allowing'); // DEBUG
    return NextResponse.next()
  }

  // Allow login page
  if (pathname === '/tagger/login') {
    console.log('[Middleware] Login page, allowing'); // DEBUG
    return NextResponse.next()
  }

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

  // Check authentication
  const { data: { session }, error } = await supabase.auth.getSession()

  console.log('[Middleware] Session:', session ? 'EXISTS' : 'NONE'); // DEBUG
  console.log('[Middleware] Error:', error); // DEBUG

  if (!session) {
    // Redirect to login with return URL
    const redirectUrl = new URL('/tagger/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    console.log('[Middleware] Redirecting to:', redirectUrl.toString()); // DEBUG
    return NextResponse.redirect(redirectUrl)
  }

  console.log('[Middleware] Authenticated, allowing'); // DEBUG
  return response
}

export const config = {
  matcher: [
    '/tagger/:path*',
  ]
}
