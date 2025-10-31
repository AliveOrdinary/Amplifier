'use client'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export default function ErrorState({
  title = 'Failed to Load',
  message,
  onRetry
}: ErrorStateProps) {
  return (
    <div className="bg-red-900/50 border border-red-600 rounded-lg p-6 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-red-300 mb-2">
        {title}
      </h3>
      <p className="text-red-400 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}
