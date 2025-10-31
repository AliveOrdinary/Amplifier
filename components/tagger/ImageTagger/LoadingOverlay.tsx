'use client'

interface LoadingOverlayProps {
  message?: string
  subMessage?: string
  showDetails?: boolean
}

export default function LoadingOverlay({
  message = 'Checking for duplicates...',
  subMessage = 'Generating hashes and comparing with library',
  showDetails = true
}: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40">
      <div className="bg-gray-800 rounded-lg p-6 shadow-2xl max-w-md border border-gray-700">
        <div className="flex items-center gap-4">
          <div className="animate-spin text-3xl">🔍</div>
          <div>
            <p className="font-bold text-white text-lg">{message}</p>
            {subMessage && (
              <p className="text-sm text-gray-300 mt-1">
                {subMessage}
              </p>
            )}
          </div>
        </div>
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>SHA-256 hash</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Perceptual hash</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <span>Database comparison</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
