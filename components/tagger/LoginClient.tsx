'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirectTo, setRedirectTo] = useState('/tagger/dashboard')

  useEffect(() => {
    // Get the redirect URL from query params if present
    const redirect = searchParams.get('redirectTo')
    if (redirect) {
      setRedirectTo(redirect)
    }
  }, [searchParams])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClientComponentClient()

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw signInError
      }

      if (data.session) {
        // Redirect to original destination or dashboard
        router.push(redirectTo)
        router.refresh()
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="bg-gray-800 rounded-2xl shadow-2xl border-2 border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-8 bg-gradient-to-br from-blue-600 to-blue-700 text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome Back
          </h1>
          <p className="text-blue-100 text-lg">
            Sign in to access the tagging system
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border-2 border-red-600 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <p className="text-sm text-red-300 font-medium pt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-bold text-white mb-3 uppercase tracking-wide"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
                placeholder="your.email@example.com"
                disabled={loading}
              />
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-bold text-white mb-3 uppercase tracking-wide"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3.5 px-6 rounded-lg hover:bg-blue-700 hover:shadow-lg focus:ring-4 focus:ring-blue-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg mt-8"
            >
              {loading ? '⏳ Signing in...' : '🚀 Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-900 border-t-2 border-gray-700 text-center">
          <p className="text-sm text-gray-400 font-medium">
            🔒 Protected system - authorized users only
          </p>
        </div>
      </div>
    </div>
  )
}
