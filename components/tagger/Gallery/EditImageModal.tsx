'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'
import { getImageValue, buildUpdateObject } from '@/lib/vocabulary-utils'
import { updateTagUsageForChanges } from '@/lib/tag-usage-utils'
import { useToast } from '@/components/ui'

interface ReferenceImage {
  id: string
  storage_path: string
  thumbnail_path: string
  original_filename: string
  notes: string | null
  status: string
  tagged_at: string
  updated_at: string
  ai_suggested_tags: any
  ai_confidence_score: number | null
  ai_reasoning: string | null
  [key: string]: any
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

interface TagVocabulary {
  [categoryKey: string]: string[]
}

interface EditImageModalProps {
  image: ReferenceImage
  vocabulary: TagVocabulary
  vocabConfig: VocabularyConfig
  onClose: () => void
  onSave: (updatedImage: ReferenceImage) => void
  supabase: any
}

export default function EditImageModal({ image, vocabulary, vocabConfig, onClose, onSave, supabase }: EditImageModalProps) {
  const toast = useToast()
  // Initialize dynamic tag state based on vocabulary config
  const [categoryTags, setCategoryTags] = useState<Record<string, string[] | string>>(() => {
    const initialTags: Record<string, string[] | string> = {}
    vocabConfig.structure.categories.forEach(category => {
      const value = getImageValue(image, category.storage_path)
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        initialTags[category.key] = Array.isArray(value) ? value : []
      } else if (category.storage_type === 'text') {
        initialTags[category.key] = value || ''
      }
    })
    return initialTags
  })

  const [notes, setNotes] = useState<string>(image.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  const toggleTag = (categoryKey: string, tag: string) => {
    setCategoryTags(prev => {
      const current = prev[categoryKey]
      if (Array.isArray(current)) {
        if (current.includes(tag)) {
          return { ...prev, [categoryKey]: current.filter(t => t !== tag) }
        } else {
          return { ...prev, [categoryKey]: [...current, tag] }
        }
      }
      return prev
    })
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Prepare old tags for usage count updates
      const oldTags: Record<string, string[]> = {}
      vocabConfig.structure.categories.forEach(category => {
        const value = getImageValue(image, category.storage_path)
        if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
          oldTags[category.key] = Array.isArray(value) ? value : []
        }
      })

      // Prepare new tags for usage count updates
      const newTags: Record<string, string[]> = {}
      vocabConfig.structure.categories.forEach(category => {
        const value = categoryTags[category.key]
        if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
          newTags[category.key] = Array.isArray(value) ? value : []
        }
      })

      // Update tag usage counts
      await updateTagUsageForChanges(supabase, oldTags, newTags, vocabConfig)

      // Build update object dynamically
      const updateData: any = {
        notes: notes || null,
        updated_at: new Date().toISOString()
      }

      // Map category tags to database fields
      vocabConfig.structure.categories.forEach(category => {
        const value = categoryTags[category.key]
        const storagePath = category.storage_path

        if (storagePath.includes('.')) {
          // Nested path like "tags.style"
          const parts = storagePath.split('.')
          const topLevel = parts[0]
          const nested = parts[1]

          if (!updateData[topLevel]) {
            updateData[topLevel] = {}
          }
          updateData[topLevel][nested] = value
        } else {
          // Direct path like "industries"
          updateData[storagePath] = value
        }
      })

      const { data, error } = await supabase
        .from('reference_images')
        .update(updateData)
        .eq('id', image.id)
        .select()
        .single()

      if (error) throw error

      toast.success('Image updated', 'Tags and notes have been saved successfully')
      onSave(data)
    } catch (error) {
      console.error('Error updating image:', error)
      toast.error('Failed to update image', getErrorMessage(error, ErrorMessages.IMAGE_UPDATE_FAILED))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto my-8 border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-white">Edit Image Tags</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image Preview */}
            <div>
              <div className="bg-gray-900 rounded-lg overflow-hidden relative">
                <Image
                  src={image.storage_path}
                  alt={image.original_filename}
                  width={800}
                  height={600}
                  sizes="(max-width: 1024px) 100vw, 800px"
                  className="w-full h-auto"
                />
              </div>
              <p className="mt-4 text-sm font-semibold text-white">{image.original_filename}</p>
            </div>

            {/* Tag Selection */}
            <div className="space-y-6">
              {/* Dynamic category sections */}
              {vocabConfig.structure.categories.map((category, catIdx) => {
                const categoryVocab = vocabulary[category.key] || []
                const selectedTags = categoryTags[category.key]
                const selectedCount = Array.isArray(selectedTags) ? selectedTags.length : 0

                // Skip if not array type (we don't support editing text types in this UI)
                if (category.storage_type !== 'array' && category.storage_type !== 'jsonb_array') {
                  return null
                }

                // Color schemes for visual variety
                const colorSchemes = [
                  { bg: 'bg-gray-700', hover: 'hover:bg-gray-600', text: 'text-gray-300', selected: 'bg-gray-600 text-white' },
                  { bg: 'bg-blue-900/50', hover: 'hover:bg-blue-800/50', text: 'text-blue-300', selected: 'bg-blue-600 text-white' },
                  { bg: 'bg-purple-900/50', hover: 'hover:bg-purple-800/50', text: 'text-purple-300', selected: 'bg-purple-600 text-white' },
                  { bg: 'bg-green-900/50', hover: 'hover:bg-green-800/50', text: 'text-green-300', selected: 'bg-green-600 text-white' },
                  { bg: 'bg-orange-900/50', hover: 'hover:bg-orange-800/50', text: 'text-orange-300', selected: 'bg-orange-600 text-white' },
                  { bg: 'bg-pink-900/50', hover: 'hover:bg-pink-800/50', text: 'text-pink-300', selected: 'bg-pink-600 text-white' },
                  { bg: 'bg-indigo-900/50', hover: 'hover:bg-indigo-800/50', text: 'text-indigo-300', selected: 'bg-indigo-600 text-white' },
                  { bg: 'bg-yellow-900/50', hover: 'hover:bg-yellow-800/50', text: 'text-yellow-300', selected: 'bg-yellow-600 text-white' }
                ]
                const colors = colorSchemes[catIdx % colorSchemes.length]

                return (
                  <div key={category.key}>
                    <label className="block text-sm font-medium text-white mb-2">
                      {category.label} ({selectedCount} selected)
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-700 rounded-lg bg-gray-900">
                      {categoryVocab.map(tag => {
                        const isSelected = Array.isArray(selectedTags) && selectedTags.includes(tag)
                        return (
                          <button
                            key={`edit-${category.key}-${tag}`}
                            onClick={() => toggleTag(category.key, tag)}
                            className={`px-3 py-1 text-sm rounded-full transition-colors ${
                              isSelected
                                ? colors.selected
                                : `${colors.bg} ${colors.text} ${colors.hover}`
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                  placeholder="Add any notes about this image..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
