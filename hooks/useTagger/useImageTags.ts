'use client'

import { useState, useCallback } from 'react'
import type { VocabularyConfig } from './useVocabularyConfig'

export interface ImageTags {
  [categoryKey: string]: string[] | string
}

export interface UseImageTagsReturn {
  allTags: Record<string, ImageTags>
  getTagsForImage: (imageId: string, config: VocabularyConfig | null) => ImageTags
  updateTags: (imageId: string, tags: Partial<ImageTags>) => void
  setTags: (imageId: string, tags: ImageTags) => void
  clearTags: (imageId: string) => void
  clearAllTags: () => void
  hasAnyTags: (imageId: string) => boolean
}

/**
 * Hook to manage tags for each image
 *
 * Handles:
 * - Tag state per image (keyed by image ID)
 * - Getting tags with fallback to empty state
 * - Updating tags (partial updates)
 * - Clearing tags
 * - Checking if image has any tags
 *
 * @returns {UseImageTagsReturn} Tag state and management functions
 *
 * @example
 * ```tsx
 * const { getTagsForImage, updateTags } = useImageTags()
 * const { config } = useVocabularyConfig()
 *
 * const tags = getTagsForImage(imageId, config)
 *
 * const handleTagToggle = (category: string, tag: string) => {
 *   const currentTags = tags[category] as string[]
 *   const newTags = currentTags.includes(tag)
 *     ? currentTags.filter(t => t !== tag)
 *     : [...currentTags, tag]
 *
 *   updateTags(imageId, { [category]: newTags })
 * }
 * ```
 */
export function useImageTags(): UseImageTagsReturn {
  const [allTags, setAllTags] = useState<Record<string, ImageTags>>({})

  /**
   * Get tags for a specific image (returns empty state if none exist)
   */
  const getTagsForImage = useCallback((
    imageId: string,
    config: VocabularyConfig | null
  ): ImageTags => {
    // If tags exist for this image, return them
    if (allTags[imageId]) {
      return allTags[imageId]
    }

    // Otherwise, return empty state based on config
    if (!config) {
      return {}
    }

    const emptyTags: ImageTags = {}
    config.structure.categories.forEach(cat => {
      if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
        emptyTags[cat.key] = []
      } else if (cat.storage_type === 'text') {
        emptyTags[cat.key] = ''
      }
    })

    return emptyTags
  }, [allTags])

  /**
   * Update tags for an image (partial update)
   */
  const updateTags = useCallback((imageId: string, tags: Partial<ImageTags>) => {
    // Filter out undefined values from tags
    const definedTags = Object.fromEntries(
      Object.entries(tags).filter(([_, value]) => value !== undefined)
    ) as ImageTags

    setAllTags(prev => ({
      ...prev,
      [imageId]: {
        ...(prev[imageId] || {}),
        ...definedTags
      }
    }))
  }, [])

  /**
   * Set tags for an image (full replace)
   */
  const setTags = useCallback((imageId: string, tags: ImageTags) => {
    setAllTags(prev => ({
      ...prev,
      [imageId]: tags
    }))
  }, [])

  /**
   * Clear tags for a specific image
   */
  const clearTags = useCallback((imageId: string) => {
    setAllTags(prev => {
      const { [imageId]: _, ...rest } = prev
      return rest
    })
  }, [])

  /**
   * Clear all tags for all images
   */
  const clearAllTags = useCallback(() => {
    setAllTags({})
  }, [])

  /**
   * Check if image has any tags
   */
  const hasAnyTags = useCallback((imageId: string): boolean => {
    const tags = allTags[imageId]
    if (!tags) return false

    return Object.values(tags).some(value => {
      if (Array.isArray(value)) {
        return value.length > 0
      }
      return typeof value === 'string' && value.trim().length > 0
    })
  }, [allTags])

  return {
    allTags,
    getTagsForImage,
    updateTags,
    setTags,
    clearTags,
    clearAllTags,
    hasAnyTags
  }
}
