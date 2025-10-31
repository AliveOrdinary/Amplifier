'use client'

import { useRef, useEffect } from 'react'

export interface AddTagModalProps {
  category: string
  categoryLabel: string
  newTagValue: string
  similarTags: string[]
  isAdding: boolean
  error: string | null
  onInputChange: (value: string) => void
  onAdd: () => void
  onUseSimilar: (tag: string) => void
  onClose: () => void
}

/**
 * Modal for adding custom tags to vocabulary
 *
 * Features:
 * - Auto-focus input on open
 * - Fuzzy matching with similar tag warnings
 * - Keyboard shortcuts (Enter to add, Escape to close)
 * - Error display
 * - Loading state during addition
 *
 * @param props - Modal configuration and handlers
 *
 * @example
 * ```tsx
 * <AddTagModal
 *   categoryLabel="Style"
 *   newTagValue={tagValue}
 *   similarTags={['modern', 'contemporary']}
 *   isAdding={isAdding}
 *   error={error}
 *   onInputChange={setTagValue}
 *   onAdd={handleAdd}
 *   onUseSimilar={handleUseSimilar}
 *   onClose={handleClose}
 * />
 * ```
 */
export default function AddTagModal({
  categoryLabel,
  newTagValue,
  similarTags,
  isAdding,
  error,
  onInputChange,
  onAdd,
  onUseSimilar,
  onClose
}: AddTagModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when modal opens
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagValue.trim() && !isAdding) {
      onAdd()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Add Custom {categoryLabel}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
            disabled={isAdding}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Tag Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newTagValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`e.g., "${categoryLabel.toLowerCase()}"`}
              disabled={isAdding}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-700 disabled:cursor-not-allowed placeholder-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Tag will be normalized to lowercase
            </p>
          </div>

          {/* Similar Tags Warning */}
          {similarTags.length > 0 && (
            <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-300 mb-2">
                Similar tags found:
              </p>
              <div className="flex flex-wrap gap-2">
                {similarTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onUseSimilar(tag)}
                    disabled={isAdding}
                    className="px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-yellow-200 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-yellow-400">
                Click a tag to use it instead
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/50 border border-red-600 rounded-lg p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-900 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={isAdding}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            disabled={!newTagValue.trim() || isAdding}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAdding ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Adding...
              </>
            ) : (
              'Add Tag'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
