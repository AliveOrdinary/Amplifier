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

interface EditTagModalProps {
  tag: VocabularyTag
  onClose: () => void
  onSave: (updatedTag: VocabularyTag) => void
  supabase: any
}

export default function EditTagModal({ tag, onClose, onSave, supabase }: EditTagModalProps) {
  const [tagValue, setTagValue] = useState(tag.tag_value)
  const [description, setDescription] = useState(tag.description || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)

    const { data, error } = await supabase
      .from('tag_vocabulary')
      .update({
        tag_value: tagValue,
        description: description || null
      })
      .eq('id', tag.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update tag:', error)
      alert(getErrorMessage(error, ErrorMessages.TAG_UPDATE_FAILED))
      setIsSaving(false)
      return
    }

    onSave(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Edit Tag</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Tag Name
            </label>
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              placeholder="Add a description for this tag..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !tagValue.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
