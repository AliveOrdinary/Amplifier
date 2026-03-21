/**
 * Simple in-memory rate limiter keyed by IP address.
 * Suitable for single-instance deployments. Not shared across serverless invocations.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Periodically clean up expired entries to prevent unbounded growth
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}

/**
 * Check if a request exceeds the rate limit.
 * @returns null if allowed, or a { status, retryAfter } object if blocked
 */
export function checkRateLimit(
  ip: string,
  route: string,
  maxRequests: number,
  windowMs: number
): { retryAfterSeconds: number } | null {
  cleanup()

  const key = `${route}:${ip}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++

  if (entry.count > maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
    return { retryAfterSeconds }
  }

  return null
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}
