'use client'

import { useState } from 'react'
import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'
import { getImageValue } from '@/lib/vocabulary-utils'
import { updateTagUsageForChanges } from '@/lib/tag-usage-utils'

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

interface BulkEditModalProps {
  images: ReferenceImage[]
  vocabulary: TagVocabulary
  vocabConfig: VocabularyConfig
  onClose: () => void
  onSave: (updatedImages: ReferenceImage[]) => void
  supabase: any
}

export default function BulkEditModal({ images, vocabulary, vocabConfig, onClose, onSave, supabase }: BulkEditModalProps) {
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [isSaving, setIsSaving] = useState(false)

  // Initialize dynamic tag state - start with empty selections
  const [categoryTags, setCategoryTags] = useState<Record<string, string[]>>(() => {
    const initialTags: Record<string, string[]> = {}
    vocabConfig.structure.categories.forEach(category => {
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        initialTags[category.key] = []
      }
    })
    return initialTags
  })

  const toggleTag = (categoryKey: string, tag: string) => {
    setCategoryTags(prev => {
      const current = prev[categoryKey] || []
      if (current.includes(tag)) {
        return { ...prev, [categoryKey]: current.filter(t => t !== tag) }
      } else {
        return { ...prev, [categoryKey]: [...current, tag] }
      }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const updatedImages: ReferenceImage[] = []

      for (const image of images) {
        // Build new tag values dynamically
        const newCategoryValues: Record<string, any> = {}

        vocabConfig.structure.categories.forEach(category => {
          if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
            const currentValue = getImageValue(image, category.storage_path)
            let newValue = Array.isArray(currentValue) ? [...currentValue] : []
            const selectedTags = categoryTags[category.key] || []

            if (mode === 'add') {
              // Add selected tags if not already present
              selectedTags.forEach(tag => {
                if (!newValue.includes(tag)) {
                  newValue.push(tag)
                }
              })
            } else {
              // Remove selected tags
              newValue = newValue.filter(tag => !selectedTags.includes(tag))
            }

            newCategoryValues[category.key] = newValue
          }
        })

        // Prepare old/new tags for usage count updates
        const oldTags: Record<string, string[]> = {}
        const newTags: Record<string, string[]> = {}

        vocabConfig.structure.categories.forEach(category => {
          if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
            const currentValue = getImageValue(image, category.storage_path)
            oldTags[category.key] = Array.isArray(currentValue) ? currentValue : []
            newTags[category.key] = newCategoryValues[category.key]
          }
        })

        // Update tag usage counts
        await updateTagUsageForChanges(supabase, oldTags, newTags, vocabConfig)

        // Build update object
        const updateData: any = {
          updated_at: new Date().toISOString()
        }

        vocabConfig.structure.categories.forEach(category => {
          const value = newCategoryValues[category.key]
          if (value === undefined) return

          const storagePath = category.storage_path
          if (storagePath.includes('.')) {
            const parts = storagePath.split('.')
            const topLevel = parts[0]
            const nested = parts[1]
            if (!updateData[topLevel]) {
              updateData[topLevel] = {}
            }
            updateData[topLevel][nested] = value
          } else {
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
        updatedImages.push(data)
      }

      onSave(updatedImages)
    } catch (error) {
      console.error('Error bulk updating images:', error)
      alert(getErrorMessage(error, ErrorMessages.BULK_UPDATE_FAILED))
    } finally {
      setIsSaving(false)
    }
  }

  const hasSelections = Object.values(categoryTags).some(tags => tags.length > 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8 border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Bulk Edit {images.length} Images</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('add')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'add'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Add Tags
            </button>
            <button
              onClick={() => setMode('remove')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'remove'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Remove Tags
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-300">
            {mode === 'add'
              ? 'Select tags to add to all selected images. Existing tags will be preserved.'
              : 'Select tags to remove from all selected images.'}
          </p>

          {/* Dynamic category sections */}
          {vocabConfig.structure.categories.map((category, catIdx) => {
            const categoryVocab = vocabulary[category.key] || []
            const selectedTags = categoryTags[category.key] || []

            // Skip if not array type
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
                  {category.label} ({selectedTags.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-700 rounded-lg bg-gray-900">
                  {categoryVocab.map(tag => {
                    const isSelected = selectedTags.includes(tag)
                    return (
                      <button
                        key={`bulk-${category.key}-${tag}`}
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
              disabled={isSaving || !hasSelections}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                mode === 'add'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isSaving
                ? 'Saving...'
                : mode === 'add'
                  ? `Add to ${images.length} Images`
                  : `Remove from ${images.length} Images`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
