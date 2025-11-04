'use client'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'white' | 'purple' | 'blue' | 'gray'
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
  xl: 'w-16 h-16 border-4'
}

const colorClasses = {
  white: 'border-white/30 border-t-white',
  purple: 'border-purple-200/30 border-t-purple-600',
  blue: 'border-blue-200/30 border-t-blue-600',
  gray: 'border-gray-300/30 border-t-gray-700'
}

export default function LoadingSpinner({
  size = 'md',
  color = 'white',
  className = ''
}: LoadingSpinnerProps) {
  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${colorClasses[color]}
        rounded-full
        animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

/**
 * LoadingOverlay - Full-screen loading overlay
 */
interface LoadingOverlayProps {
  message?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function LoadingOverlay({ message = 'Loading...', size = 'lg' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border-2 border-gray-700 flex flex-col items-center gap-4">
        <LoadingSpinner size={size} color="purple" />
        <p className="text-white text-lg font-semibold">{message}</p>
      </div>
    </div>
  )
}

/**
 * InlineLoader - Inline loading indicator for buttons and small areas
 */
interface InlineLoaderProps {
  message?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'white' | 'purple' | 'blue' | 'gray'
}

export function InlineLoader({ message, size = 'sm', color = 'white' }: InlineLoaderProps) {
  return (
    <div className="flex items-center gap-2">
      <LoadingSpinner size={size} color={color} />
      {message && <span className="text-sm">{message}</span>}
    </div>
  )
}
