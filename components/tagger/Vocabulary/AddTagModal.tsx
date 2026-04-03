'use client'

import { useState } from 'react'
import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'
import { useToast } from '@/components/ui'

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
  const toast = useToast()
  const [category, setCategory] = useState(vocabConfig.structure.categories[0]?.key || '')
  const [tagValue, setTagValue] = useState('')
  const [description, setDescription] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!tagValue.trim()) {
      toast.error('Validation error', ErrorMessages.VALIDATION_REQUIRED_FIELD('Tag name'))
      return
    }

    setIsAdding(true)

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
      toast.error('Failed to add tag', getErrorMessage(error, ErrorMessages.TAG_ADD_FAILED))
      setIsAdding(false)
      return
    }

    toast.success('Tag added', `"${tagValue}" has been added to the vocabulary`)
    onAdd(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg max-w-lg w-full border border-gray-800">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Add New Tag</h2>
          <p className="text-sm text-gray-400 mt-1">Create a new tag for your vocabulary</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-950 text-white text-sm cursor-pointer transition-colors"
            >
              {vocabConfig.structure.categories.map(cat => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tag Name *</label>
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-950 text-white placeholder-gray-600 text-sm transition-colors"
              placeholder="e.g., minimalist, luxury, modern..."
              autoFocus
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
              rows={3}
              className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-950 text-white placeholder-gray-600 text-sm transition-colors resize-none"
              placeholder="Add a helpful description for this tag..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-950 rounded-b-lg border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={isAdding || !tagValue.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? 'Adding...' : 'Add Tag'}
          </button>
        </div>
      </div>
    </div>
  )
}
