'use client'

interface ToastProps {
  type: 'success' | 'error'
  message: string
  detail?: string
  onDismiss?: () => void
}

export default function Toast({ type, message, detail, onDismiss }: ToastProps) {
  const isSuccess = type === 'success'

  return (
    <div className={`fixed top-4 right-4 ${
      isSuccess ? 'bg-green-600' : 'bg-red-600'
    } text-white px-6 py-${detail ? '4' : '3'} rounded-lg shadow-lg z-50 ${
      isSuccess ? 'animate-slide-in' : ''
    } max-w-md`}>
      <div className="flex items-center justify-between space-x-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{isSuccess ? '✓' : '✕'}</span>
          <div>
            <p className="font-medium">{message}</p>
            {detail && (
              <p className="text-sm opacity-90 mt-1">{detail}</p>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-white hover:opacity-75 transition-opacity"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
