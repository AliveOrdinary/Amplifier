'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void
  success: (title: string, message?: string, duration?: number) => void
  error: (title: string, message?: string, duration?: number) => void
  warning: (title: string, message?: string, duration?: number) => void
  info: (title: string, message?: string, duration?: number) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration: number = 5000) => {
      const id = Math.random().toString(36).substr(2, 9)
      const toast: Toast = { id, type, title, message, duration }

      setToasts((prev) => [...prev, toast])

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id)
        }, duration)
      }
    },
    [dismissToast]
  )

  const success = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast('success', title, message, duration)
    },
    [showToast]
  )

  const error = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast('error', title, message, duration)
    },
    [showToast]
  )

  const warning = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast('warning', title, message, duration)
    },
    [showToast]
  )

  const info = useCallback(
    (title: string, message?: string, duration?: number) => {
      showToast('info', title, message, duration)
    },
    [showToast]
  )

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, success, error, warning, info, dismissToast }}
    >
      {children}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

/**
 * ToastContainer - Renders all active toasts
 */
interface ToastContainerProps {
  toasts: Toast[]
  dismissToast: (id: string) => void
}

function ToastContainer({ toasts, dismissToast }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

/**
 * ToastItem - Individual toast notification
 */
interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const toastConfig = {
  success: {
    icon: '✓',
    bgClass: 'bg-green-600',
    borderClass: 'border-green-500',
    iconBg: 'bg-green-700'
  },
  error: {
    icon: '✕',
    bgClass: 'bg-red-600',
    borderClass: 'border-red-500',
    iconBg: 'bg-red-700'
  },
  warning: {
    icon: '⚠',
    bgClass: 'bg-yellow-600',
    borderClass: 'border-yellow-500',
    iconBg: 'bg-yellow-700'
  },
  info: {
    icon: 'ℹ',
    bgClass: 'bg-blue-600',
    borderClass: 'border-blue-500',
    iconBg: 'bg-blue-700'
  }
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = toastConfig[toast.type]

  return (
    <div
      className={`
        ${config.bgClass}
        ${config.borderClass}
        border-2
        rounded-lg
        shadow-2xl
        p-4
        flex items-start gap-3
        animate-slide-in-right
        min-w-[320px]
        max-w-md
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`${config.iconBg} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
        <span className="text-white font-bold text-lg">{config.icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-bold text-sm">{toast.title}</h4>
        {toast.message && (
          <p className="text-white/90 text-sm mt-1 leading-relaxed">{toast.message}</p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/70 hover:text-white transition-colors flex-shrink-0"
        aria-label="Dismiss notification"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
