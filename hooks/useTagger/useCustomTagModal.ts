'use client'

import { useState, useCallback } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import type { VocabularyConfig } from './useVocabularyConfig'
import type { UseImageTagsReturn } from './useImageTags'
import type { TagVocabulary } from './useVocabulary'

export interface UseCustomTagModalParams {
  vocabulary: TagVocabulary
  vocabConfig: VocabularyConfig | null
  tagsHook: UseImageTagsReturn
  currentImageId?: string  // Optional - only needed if auto-selecting new tag
}

export interface UseCustomTagModalReturn {
  isOpen: boolean
  categoryKey: string | null
  categoryLabel: string
  newTagValue: string
  similarTags: string[]
  error: string | null
  isAdding: boolean
  openModal: (categoryKey: string) => void
  closeModal: () => void
  handleInputChange: (value: string) => void
  addTag: () => Promise<void>
  useSimilarTag: (tag: string) => void
}

/**
 * Hook to manage custom tag addition with fuzzy matching
 *
 * Features:
 * - Modal state management
 * - Fuzzy matching with Levenshtein distance (edit distance <= 2)
 * - Zod validation for tag format
 * - Database insertion with sort order management
 * - Auto-select newly added tag on current image
 * - Similar tag suggestions to prevent duplicates
 *
 * @param params - Configuration and dependencies
 * @returns {UseCustomTagModalReturn} Custom tag modal state and functions
 *
 * @example
 * ```tsx
 * const customTagModal = useCustomTagModal({
 *   vocabulary,
 *   vocabConfig,
 *   tagsHook: tags,
 *   currentImageId: currentImage?.id
 * })
 *
 * // Open modal for a category
 * customTagModal.openModal('styles')
 *
 * // Render modal
 * {customTagModal.isOpen && (
 *   <AddTagModal
 *     categoryLabel={customTagModal.categoryLabel}
 *     newTagValue={customTagModal.newTagValue}
 *     similarTags={customTagModal.similarTags}
 *     isAdding={customTagModal.isAdding}
 *     error={customTagModal.error}
 *     onInputChange={customTagModal.handleInputChange}
 *     onAdd={customTagModal.addTag}
 *     onUseSimilar={customTagModal.useSimilarTag}
 *     onClose={customTagModal.closeModal}
 *   />
 * )}
 * ```
 */
export function useCustomTagModal({
  vocabulary,
  vocabConfig,
  tagsHook,
  currentImageId
}: UseCustomTagModalParams): UseCustomTagModalReturn {
  const supabase = createClientComponentClient()

  const [isOpen, setIsOpen] = useState(false)
  const [categoryKey, setCategoryKey] = useState<string | null>(null)
  const [newTagValue, setNewTagValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [similarTags, setSimilarTags] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  /**
   * Get category label from config
   */
  const categoryLabel = categoryKey && vocabConfig
    ? vocabConfig.structure.categories.find(cat => cat.key === categoryKey)?.label || categoryKey
    : ''

  /**
   * Levenshtein distance for fuzzy matching
   */
  const levenshteinDistance = useCallback((str1: string, str2: string): number => {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }, [])

  /**
   * Find similar tags using fuzzy matching
   */
  const findSimilarTags = useCallback((input: string, tags: string[]): string[] => {
    const normalized = input.toLowerCase().trim()
    if (!normalized) return []

    return tags.filter(tag => {
      const tagLower = tag.toLowerCase()
      // Exact match
      if (tagLower === normalized) return true
      // Contains
      if (tagLower.includes(normalized) || normalized.includes(tagLower)) return true
      // Simple Levenshtein distance check (edit distance <= 2)
      const distance = levenshteinDistance(normalized, tagLower)
      return distance <= 2 && distance > 0
    })
  }, [levenshteinDistance])

  /**
   * Open modal for a specific category
   */
  const openModal = useCallback((key: string) => {
    setCategoryKey(key)
    setNewTagValue('')
    setSimilarTags([])
    setError(null)
    setIsOpen(true)
  }, [])

  /**
   * Close modal and reset state
   */
  const closeModal = useCallback(() => {
    setIsOpen(false)
    setCategoryKey(null)
    setNewTagValue('')
    setSimilarTags([])
    setError(null)
  }, [])

  /**
   * Handle input change with fuzzy matching
   */
  const handleInputChange = useCallback((value: string) => {
    setNewTagValue(value)
    setError(null)

    if (!categoryKey) return

    // Get vocabulary for current category
    const existingTags = vocabulary[categoryKey] || []

    // Find similar tags
    const similar = findSimilarTags(value, existingTags)
    setSimilarTags(similar)
  }, [categoryKey, vocabulary, findSimilarTags])

  /**
   * Add custom tag to database
   */
  const addTag = useCallback(async () => {
    if (!categoryKey || !newTagValue.trim() || !vocabConfig) return

    try {
      setIsAdding(true)
      setError(null)

      // Validate tag value format using Zod
      const { tagValueSchema } = await import('@/lib/validation')
      const validationResult = tagValueSchema.safeParse(newTagValue)

      if (!validationResult.success) {
        const errorMessage = validationResult.error.issues[0]?.message || 'Invalid tag format'
        setError(errorMessage)
        setIsAdding(false)
        return
      }

      // Use the validated and normalized tag value
      const normalized = validationResult.data

      // Since tag_vocabulary.category now uses the config key directly, no mapping needed
      const dbCategory = categoryKey

      // Check for exact duplicate
      const existingTags = vocabulary[categoryKey] || []
      if (existingTags.some(tag => tag.toLowerCase() === normalized)) {
        setError('This tag already exists in the vocabulary')
        setIsAdding(false)
        return
      }

      // Get next sort_order
      const { data: maxOrderData } = await supabase
        .from('tag_vocabulary')
        .select('sort_order')
        .eq('category', dbCategory)
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextSortOrder = (maxOrderData && maxOrderData[0]?.sort_order ? maxOrderData[0].sort_order : 0) + 1

      // Insert new tag into database
      const { error: insertError } = await supabase
        .from('tag_vocabulary')
        .insert({
          category: dbCategory,
          tag_value: normalized,
          sort_order: nextSortOrder,
          is_active: true,
          added_by: null, // TODO: Add user ID when auth is implemented
          times_used: 0
        })

      if (insertError) throw insertError

      // Note: Vocabulary will auto-reload on next component render via useVocabulary hook
      // No need to manually update state

      // Auto-select the new tag on current image (if currentImageId provided)
      if (currentImageId) {
        const currentTags = tagsHook.getTagsForImage(currentImageId, vocabConfig)
        const currentValues = (currentTags[categoryKey] || []) as string[]
        tagsHook.updateTags(currentImageId, {
          [categoryKey]: [...currentValues, normalized]
        })
      }

      console.log(`✅ Added custom tag: ${normalized} to ${dbCategory}`)

      // Close modal
      closeModal()

    } catch (error) {
      console.error('❌ Error adding custom tag:', error)
      setError(error instanceof Error ? error.message : 'Failed to add tag')
    } finally {
      setIsAdding(false)
    }
  }, [categoryKey, newTagValue, vocabConfig, vocabulary, supabase, currentImageId, tagsHook, closeModal])

  /**
   * Use existing similar tag instead of creating new one
   */
  const useSimilarTag = useCallback((tag: string) => {
    if (!categoryKey || !currentImageId || !vocabConfig) return

    const currentTags = tagsHook.getTagsForImage(currentImageId, vocabConfig)
    const currentValues = (currentTags[categoryKey] || []) as string[]

    // Add to current image tags if not already selected
    if (!currentValues.includes(tag)) {
      tagsHook.updateTags(currentImageId, {
        [categoryKey]: [...currentValues, tag]
      })
    }

    // Close modal
    closeModal()
  }, [categoryKey, currentImageId, vocabConfig, tagsHook, closeModal])

  return {
    isOpen,
    categoryKey,
    categoryLabel,
    newTagValue,
    similarTags,
    error,
    isAdding,
    openModal,
    closeModal,
    handleInputChange,
    addTag,
    useSimilarTag
  }
}
