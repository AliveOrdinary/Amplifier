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
      <div className="bg-gray-800 rounded-2xl max-w-3xl w-full shadow-2xl border-2 border-gray-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b-2 border-gray-700">
          <h2 className="text-3xl font-bold text-white">✏️ Edit Category</h2>
          <p className="text-gray-300 mt-2">Update properties for "{category.label}"</p>
        </div>

        {/* Info Banner */}
        <div className="px-8 pt-6">
          <div className="p-4 bg-yellow-900/50 border-2 border-yellow-600 rounded-lg">
            <p className="text-sm text-yellow-300 font-medium">
              <span className="font-bold">⚠️ Note:</span> Key, storage type, and storage path are read-only to protect existing data integrity.
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
          {/* Read-only Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 border-b-2 border-gray-700">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                Category Key
              </label>
              <div className="px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-gray-400 font-mono text-sm">
                {category.key}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                Storage Type
              </label>
              <div className="px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-gray-400 text-sm">
                {category.storage_type}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                Storage Path
              </label>
              <div className="px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-gray-400 font-mono text-sm">
                {category.storage_path}
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Display Label *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Search Weight *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              🔍 1-10, higher = more important in search
            </p>
            <input
              type="number"
              min="1"
              max="10"
              value={searchWeight}
              onChange={(e) => setSearchWeight(parseInt(e.target.value))}
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white transition-all hover:border-gray-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Description
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this category is for..."
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500 resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Placeholder
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="e.g., warm, cool, vibrant..."
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-900 rounded-b-2xl border-t-2 border-gray-700">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 border-2 border-gray-600 text-white rounded-lg hover:bg-gray-600 hover:border-gray-500 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 hover:shadow-lg transition-all font-semibold"
            >
              ✓ Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
