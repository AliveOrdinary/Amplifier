'use client'

export default function TaggerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 3rem)' }}>
      <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 max-w-md w-full text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-gray-400 mb-6 text-sm">
          An error occurred while loading the tagger. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
