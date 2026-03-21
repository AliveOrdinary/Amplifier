import { NextResponse } from 'next/server'

/**
 * Consistent API response helpers.
 */

export function apiSuccess(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}
