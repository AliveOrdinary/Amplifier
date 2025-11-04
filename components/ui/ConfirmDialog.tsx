'use client'

import Modal, { ModalHeader, ModalContent, ModalFooter, ModalActions } from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  isLoading?: boolean
}

const variantConfig = {
  danger: {
    icon: '⚠️',
    confirmVariant: 'danger' as const,
    bgClass: 'bg-red-900/50 border-red-600'
  },
  warning: {
    icon: '⚠️',
    confirmVariant: 'primary' as const,
    bgClass: 'bg-yellow-900/50 border-yellow-600'
  },
  info: {
    icon: 'ℹ️',
    confirmVariant: 'primary' as const,
    bgClass: 'bg-blue-900/50 border-blue-600'
  },
  success: {
    icon: '✓',
    confirmVariant: 'success' as const,
    bgClass: 'bg-green-900/50 border-green-600'
  }
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  isLoading = false
}: ConfirmDialogProps) {
  const config = variantConfig[variant]

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" closeOnBackdropClick={!isLoading}>
      <ModalHeader title={title} icon={config.icon} />

      <ModalContent>
        <div className={`p-4 ${config.bgClass} border-2 rounded-lg`}>
          <p className="text-white leading-relaxed">{message}</p>
        </div>
      </ModalContent>

      <ModalFooter>
        <ModalActions
          cancelText={cancelText}
          confirmText={confirmText}
          onCancel={onClose}
          onConfirm={handleConfirm}
          isLoading={isLoading}
          confirmVariant={config.confirmVariant}
        />
      </ModalFooter>
    </Modal>
  )
}

/**
 * useConfirmDialog - Hook for using confirm dialogs
 *
 * Example usage:
 *
 * const { confirmDialog, showConfirm } = useConfirmDialog()
 *
 * const handleDelete = async () => {
 *   const confirmed = await showConfirm({
 *     title: 'Delete Item',
 *     message: 'Are you sure you want to delete this item?',
 *     variant: 'danger'
 *   })
 *   if (confirmed) {
 *     // Proceed with deletion
 *   }
 * }
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Delete</button>
 *     {confirmDialog}
 *   </>
 * )
 */

import { useState, useCallback } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: ''
  })
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

  const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setIsOpen(true)

    return new Promise((resolve) => {
      setResolver(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (resolver) {
      resolver(true)
      setResolver(null)
    }
    setIsOpen(false)
  }, [resolver])

  const handleCancel = useCallback(() => {
    if (resolver) {
      resolver(false)
      setResolver(null)
    }
    setIsOpen(false)
  }, [resolver])

  const confirmDialog = (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      variant={options.variant}
    />
  )

  return { confirmDialog, showConfirm }
}
