'use client'

import { useState } from 'react'
import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'

interface VocabularyTag {
  id: string
  category: string
  tag_value: string
  description: string | null
  sort_order: number
  is_active: boolean
  times_used: number
  last_used_at: string | null
  created_at: string
}

interface VocabularyCategory {
  key: string
  label: string
  description: string
  placeholder: string
  storage_path: string
  storage_type: 'array' | 'jsonb_array' | 'text'
  search_weight: number
}

interface VocabularyConfig {
  structure: {
    categories: VocabularyCategory[]
  }
}

interface AddTagModalProps {
  vocabConfig: VocabularyConfig
  onClose: () => void
  onAdd: (newTag: VocabularyTag) => void
  supabase: any
}

export default function AddTagModal({ vocabConfig, onClose, onAdd, supabase }: AddTagModalProps) {
  // Initialize with the first category from config
  const [category, setCategory] = useState(vocabConfig.structure.categories[0]?.key || '')
  const [tagValue, setTagValue] = useState('')
  const [description, setDescription] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!tagValue.trim()) {
      alert(ErrorMessages.VALIDATION_REQUIRED_FIELD('Tag name'))
      return
    }

    setIsAdding(true)

    // Get max sort_order for this category
    const { data: existingTags } = await supabase
      .from('tag_vocabulary')
      .select('sort_order')
      .eq('category', category)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextSortOrder = existingTags && existingTags.length > 0
      ? existingTags[0].sort_order + 1
      : 1

    const { data, error } = await supabase
      .from('tag_vocabulary')
      .insert({
        category,
        tag_value: tagValue.toLowerCase().trim(),
        description: description || null,
        sort_order: nextSortOrder,
        is_active: true,
        times_used: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add tag:', error)
      alert(getErrorMessage(error, ErrorMessages.TAG_ADD_FAILED))
      setIsAdding(false)
      return
    }

    onAdd(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl border-2 border-gray-700">
        {/* Header */}
        <div className="px-8 py-6 border-b-2 border-gray-700">
          <h2 className="text-3xl font-bold text-white">✨ Add New Tag</h2>
          <p className="text-gray-300 mt-2">Create a new tag for your vocabulary</p>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-900 text-white font-semibold transition-all hover:border-gray-500 cursor-pointer"
            >
              {vocabConfig.structure.categories.map(cat => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Name */}
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Tag Name *
            </label>
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              placeholder="e.g., minimalist, luxury, modern..."
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Description
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500 resize-none"
              placeholder="Add a helpful description for this tag..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-900 rounded-b-2xl border-t-2 border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-700 border-2 border-gray-600 text-white rounded-lg hover:bg-gray-600 hover:border-gray-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={isAdding || !tagValue.trim()}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? '⏳ Adding...' : '✓ Add Tag'}
          </button>
        </div>
      </div>
    </div>
  )
}
