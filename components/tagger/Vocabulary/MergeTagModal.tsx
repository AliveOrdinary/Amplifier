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

interface MergeTagModalProps {
  sourceTag: VocabularyTag
  allTags: VocabularyTag[]
  vocabConfig: VocabularyConfig
  onClose: () => void
  onMerge: (sourceId: string) => void
  supabase: any
}

export default function MergeTagModal({ sourceTag, allTags, vocabConfig, onClose, onMerge, supabase }: MergeTagModalProps) {
  const [targetTagId, setTargetTagId] = useState('')
  const [isMerging, setIsMerging] = useState(false)

  const handleMerge = async () => {
    if (!targetTagId) {
      alert('Please select a target tag to merge into.')
      return
    }

    if (!confirm(`Merge "${sourceTag.tag_value}" into the selected tag? This will update all ${sourceTag.times_used} references and archive the source tag.`)) {
      return
    }

    setIsMerging(true)

    try {
      // Find the category config for the source tag
      const categoryConfig = vocabConfig.structure.categories.find(cat => cat.key === sourceTag.category)
      if (!categoryConfig) {
        throw new Error(`Category configuration not found for ${sourceTag.category}`)
      }

      // Get all reference images
      const { data: images, error: fetchError } = await supabase
        .from('reference_images')
        .select('*')

      if (fetchError) throw fetchError

      const targetTag = allTags.find(t => t.id === targetTagId)
      if (!targetTag) throw new Error('Target tag not found')

      // Helper function to get value from image based on storage_path
      const getImageValue = (image: any, storagePath: string): any => {
        if (storagePath.includes('.')) {
          const parts = storagePath.split('.')
          let value: any = image
          for (const part of parts) {
            value = value?.[part]
          }
          return value
        } else {
          return image[storagePath]
        }
      }

      // Update each image that uses the source tag
      for (const image of images || []) {
        const currentValue = getImageValue(image, categoryConfig.storage_path)

        let needsUpdate = false
        const updates: any = {}

        if (categoryConfig.storage_type === 'array' || categoryConfig.storage_type === 'jsonb_array') {
          // For array types, check if the source tag is in the array
          if (Array.isArray(currentValue) && currentValue.includes(sourceTag.tag_value)) {
            // Remove source tag and add target tag
            const newValue = currentValue
              .filter((t: string) => t !== sourceTag.tag_value)
              .concat(targetTag.tag_value)

            // Build update object dynamically based on storage_path
            if (categoryConfig.storage_path.includes('.')) {
              const parts = categoryConfig.storage_path.split('.')
              const topLevel = parts[0]
              const nested = parts[1]
              updates[topLevel] = {
                ...image[topLevel],
                [nested]: newValue
              }
            } else {
              updates[categoryConfig.storage_path] = newValue
            }

            needsUpdate = true
          }
        } else if (categoryConfig.storage_type === 'text') {
          // For text types, check if it matches exactly
          if (currentValue === sourceTag.tag_value) {
            if (categoryConfig.storage_path.includes('.')) {
              const parts = categoryConfig.storage_path.split('.')
              const topLevel = parts[0]
              const nested = parts[1]
              updates[topLevel] = {
                ...image[topLevel],
                [nested]: targetTag.tag_value
              }
            } else {
              updates[categoryConfig.storage_path] = targetTag.tag_value
            }

            needsUpdate = true
          }
        }

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('reference_images')
            .update(updates)
            .eq('id', image.id)

          if (updateError) throw updateError
        }
      }

      // Archive the source tag
      const { error: archiveError } = await supabase
        .from('tag_vocabulary')
        .update({ is_active: false })
        .eq('id', sourceTag.id)

      if (archiveError) throw archiveError

      onMerge(sourceTag.id)
      onClose()
    } catch (error) {
      console.error('Merge failed:', error)
      alert(getErrorMessage(error, ErrorMessages.TAG_MERGE_FAILED))
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Merge Tag</h2>

        <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-600 rounded-lg">
          <p className="text-sm text-yellow-300">
            This will replace all uses of <strong>{sourceTag.tag_value}</strong> with the selected tag
            and archive the original. This affects {sourceTag.times_used} images.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Merge into:
            </label>
            <select
              value={targetTagId}
              onChange={(e) => setTargetTagId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select target tag...</option>
              {allTags.map(tag => (
                <option key={tag.id} value={tag.id}>
                  {tag.tag_value} ({tag.times_used} uses)
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={isMerging || !targetTagId}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isMerging ? 'Merging...' : 'Merge Tags'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
