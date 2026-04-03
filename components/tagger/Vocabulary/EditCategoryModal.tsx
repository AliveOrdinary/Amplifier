'use client'

import { useState } from 'react'

interface VocabularyCategory {
  key: string
  label: string
  description: string
  placeholder: string
  storage_path: string
  storage_type: 'array' | 'jsonb_array' | 'text'
  search_weight: number
}

interface EditCategoryModalProps {
  category: VocabularyCategory
  onClose: () => void
  onSave: (categoryKey: string, updates: Partial<VocabularyCategory>) => void
}

export default function EditCategoryModal({ category, onClose, onSave }: EditCategoryModalProps) {
  const [label, setLabel] = useState(category.label)
  const [description, setDescription] = useState(category.description || '')
  const [placeholder, setPlaceholder] = useState(category.placeholder || '')
  const [searchWeight, setSearchWeight] = useState(category.search_weight)

  const handleSave = async () => {
    await onSave(category.key, {
      label,
      description: description || undefined,
      placeholder: placeholder || undefined,
      search_weight: searchWeight
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg max-w-3xl w-full border border-gray-800 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Edit Category</h2>
          <p className="text-sm text-gray-400 mt-1">Update properties for &quot;{category.label}&quot;</p>
        </div>

        {/* Info Banner */}
        <div className="px-8 pt-6">
          <div className="p-3 bg-gray-950 border border-amber-800 rounded-lg">
            <p className="text-sm text-gray-400">
              <span className="font-medium text-gray-300">Note:</span> Key, storage type, and storage path are read-only to protect existing data integrity.
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-5">
          {/* Read-only Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-5 border-b border-gray-800">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category Key</label>
              <div className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-gray-400 font-mono text-sm">
                {category.key}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Storage Type</label>
              <div className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-gray-400 text-sm">
                {category.storage_type}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Storage Path</label>
              <div className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-gray-400 font-mono text-sm">
                {category.storage_path}
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Display Label *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-950 text-white text-sm transition-colors"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Search Weight *</label>
            <p className="text-xs text-gray-500 mb-2">1-10, higher = more important in search</p>
            <input
              type="number"
              min="1"
              max="10"
              value={searchWeight}
              onChange={(e) => setSearchWeight(parseInt(e.target.value, 10) || 1)}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-950 text-white text-sm transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
              <span className="text-gray-500 text-xs font-normal ml-2">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this category is for..."
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-950 text-white placeholder-gray-600 text-sm transition-colors resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Placeholder
              <span className="text-gray-500 text-xs font-normal ml-2">(optional)</span>
            </label>
            <input
              type="text"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="e.g., warm, cool, vibrant..."
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-950 text-white placeholder-gray-600 text-sm transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-950 rounded-b-lg border-t border-gray-800">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
