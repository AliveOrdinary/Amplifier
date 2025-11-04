'use client'

import { ReactNode, useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-7xl'
}

export default function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        className={`bg-gray-800 rounded-2xl ${sizeClasses[size]} w-full shadow-2xl border-2 border-gray-700 max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * ModalHeader - Standard modal header with title and close button
 */
interface ModalHeaderProps {
  title: string
  subtitle?: string
  onClose?: () => void
  icon?: string
}

export function ModalHeader({ title, subtitle, onClose, icon }: ModalHeaderProps) {
  return (
    <div className="px-8 py-6 border-b-2 border-gray-700 flex items-start justify-between">
      <div>
        <h2 className="text-3xl font-bold text-white">
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="text-gray-300 mt-2">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-2"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * ModalContent - Scrollable content area
 */
interface ModalContentProps {
  children: ReactNode
  className?: string
}

export function ModalContent({ children, className = '' }: ModalContentProps) {
  return (
    <div className={`overflow-y-auto flex-1 px-8 py-6 ${className}`}>
      {children}
    </div>
  )
}

/**
 * ModalFooter - Footer with action buttons
 */
interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`px-8 py-6 bg-gray-900 rounded-b-2xl border-t-2 border-gray-700 ${className}`}>
      {children}
    </div>
  )
}

/**
 * ModalActions - Standardized button group for modal footer
 */
interface ModalActionsProps {
  cancelText?: string
  confirmText?: string
  onCancel: () => void
  onConfirm: () => void
  isLoading?: boolean
  confirmDisabled?: boolean
  confirmVariant?: 'primary' | 'danger' | 'success'
}

export function ModalActions({
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  onCancel,
  onConfirm,
  isLoading = false,
  confirmDisabled = false,
  confirmVariant = 'primary'
}: ModalActionsProps) {
  const variantClasses = {
    primary: 'bg-purple-600 hover:bg-purple-700',
    danger: 'bg-red-600 hover:bg-red-700',
    success: 'bg-green-600 hover:bg-green-700'
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={onCancel}
        disabled={isLoading}
        className="flex-1 px-6 py-3 bg-gray-700 border-2 border-gray-600 text-white rounded-lg hover:bg-gray-600 hover:border-gray-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {cancelText}
      </button>
      <button
        onClick={onConfirm}
        disabled={isLoading || confirmDisabled}
        className={`flex-1 px-6 py-3 ${variantClasses[confirmVariant]} text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Loading...
          </span>
        ) : (
          confirmText
        )}
      </button>
    </div>
  )
}
