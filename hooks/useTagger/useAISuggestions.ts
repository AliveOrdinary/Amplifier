'use client'

import { useState, useEffect, useCallback } from 'react'
import type { VocabularyConfig } from './useVocabularyConfig'
import type { UseImageTagsReturn, ImageTags } from './useImageTags'
import type { UploadedImage } from './useImageUpload'
import type { TagVocabulary } from './useVocabulary'

// Image processing constants
const MAX_IMAGE_WIDTH = 1200

export interface AISuggestion {
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
  promptVersion?: 'baseline' | 'enhanced'
  [categoryKey: string]: string[] | string | 'high' | 'medium' | 'low' | 'baseline' | 'enhanced' | undefined
}

export interface UseAISuggestionsParams {
  vocabulary: TagVocabulary
  vocabConfig: VocabularyConfig | null
  uploadedImages: UploadedImage[]
  currentIndex: number
  isTaggingMode: boolean
  tagsHook: UseImageTagsReturn
  maxImageWidth?: number
}

export interface UseAISuggestionsReturn {
  suggestions: Record<string, AISuggestion>
  isLoading: Record<string, boolean>
  isPrefetching: boolean
  getSuggestions: (imageId: string, file: File) => Promise<void>
  prefetchNext: (nextIndex: number) => Promise<void>
  clearCache: () => void
  clearSuggestions: () => void
}

/**
 * Hook to manage AI tag suggestions with prefetching optimization
 *
 * Features:
 * - Image resizing for Claude API (max 1200px, < 5MB)
 * - Base64 conversion for API transmission
 * - AI suggestions with caching
 * - Background prefetching for next images
 * - Auto-apply suggestions to image tags
 * - Smart cache management
 *
 * @param params - Configuration and dependencies
 * @returns {UseAISuggestionsReturn} AI suggestion state and functions
 *
 * @example
 * ```tsx
 * const aiSuggestions = useAISuggestions({
 *   vocabulary,
 *   vocabConfig,
 *   uploadedImages,
 *   currentIndex,
 *   isTaggingMode,
 *   tagsHook: tags
 * })
 *
 * // Manually trigger
 * await aiSuggestions.getSuggestions(imageId, file)
 *
 * // Or let it auto-trigger based on navigation
 * ```
 */
export function useAISuggestions({
  vocabulary,
  vocabConfig,
  uploadedImages,
  currentIndex,
  isTaggingMode,
  tagsHook,
  maxImageWidth = MAX_IMAGE_WIDTH
}: UseAISuggestionsParams): UseAISuggestionsReturn {
  const [suggestions, setSuggestions] = useState<Record<string, AISuggestion>>({})
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [prefetchedSuggestions, setPrefetchedSuggestions] = useState<Map<string, AISuggestion>>(new Map())
  const [isPrefetching, setIsPrefetching] = useState(false)

  /**
   * Resize image for AI analysis (max 1200px, keep under 5MB limit)
   */
  const resizeImageForAI = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        // Calculate dimensions (max width on longest side)
        let width = img.width
        let height = img.height

        if (width > height && width > maxImageWidth) {
          height = (height * maxImageWidth) / width
          width = maxImageWidth
        } else if (height > maxImageWidth) {
          width = (width * maxImageWidth) / height
          height = maxImageWidth
        }

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to resize image for AI'))
            }
          },
          file.type,
          0.85 // Quality for compression
        )
      }

      img.onerror = () => reject(new Error('Failed to load image for AI'))
      img.src = URL.createObjectURL(file)
    })
  }, [maxImageWidth])

  /**
   * Convert Blob to base64 data URI
   */
  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }, [])

  /**
   * Merge AI suggestions with existing tags
   */
  const mergeTagsWithSuggestions = useCallback((
    imageId: string,
    aiSuggestion: AISuggestion
  ) => {
    if (!vocabConfig) return

    const currentTags = tagsHook.getTagsForImage(imageId, vocabConfig)
    const mergedTags: ImageTags = {}

    vocabConfig.structure.categories.forEach(cat => {
      if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
        const currentValues = (currentTags[cat.key] || []) as string[]
        const suggestedValues = (aiSuggestion[cat.key] || []) as string[]
        mergedTags[cat.key] = [...new Set([...currentValues, ...suggestedValues])]
      } else if (cat.storage_type === 'text') {
        mergedTags[cat.key] = currentTags[cat.key] || ''
      }
    })

    tagsHook.setTags(imageId, mergedTags)
  }, [vocabConfig, tagsHook])

  /**
   * Get AI tag suggestions for an image
   */
  const getSuggestions = useCallback(async (imageId: string, file: File) => {
    try {
      // CHECK CACHE FIRST
      if (prefetchedSuggestions.has(imageId)) {
        console.log('⚡ Using prefetched suggestions (instant!)')
        const cachedSuggestions = prefetchedSuggestions.get(imageId)!

        // Store suggestions
        setSuggestions(prev => ({ ...prev, [imageId]: cachedSuggestions }))

        // Auto-apply suggestions to image tags
        mergeTagsWithSuggestions(imageId, cachedSuggestions)

        // Remove from cache
        setPrefetchedSuggestions(prev => {
          const newMap = new Map(prev)
          newMap.delete(imageId)
          return newMap
        })

        // Prefetch NEXT image
        const currentIdx = uploadedImages.findIndex(img => img.id === imageId)
        const nextIndex = currentIdx + 1
        if (nextIndex < uploadedImages.length) {
          prefetchNext(nextIndex)
        }

        return
      }

      // NOT CACHED - Fetch normally
      setIsLoading(prev => ({ ...prev, [imageId]: true }))

      console.log(`🤖 Getting AI suggestions for ${file.name}...`)

      // Resize image to keep under 5MB Claude API limit
      const resizedBlob = await resizeImageForAI(file)
      console.log(`📐 Resized from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(resizedBlob.size / 1024 / 1024).toFixed(2)}MB`)

      // Convert resized image to base64
      const base64Image = await blobToBase64(resizedBlob)

      console.log('📤 Sending vocabulary to API:', {
        categories: Object.keys(vocabulary),
        sizes: Object.entries(vocabulary).map(([k, v]) => `${k}: ${v.length}`)
      })

      // Call API with dynamic vocabulary structure
      const response = await fetch('/api/suggest-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          vocabulary,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `API error: ${response.status}`
        console.error('API error details:', errorData)
        throw new Error(errorMessage)
      }

      const aiSuggestion: AISuggestion = await response.json()

      console.log('✨ AI suggestions received:', aiSuggestion)

      // Ensure all vocabulary categories have entries (even if empty)
      Object.keys(vocabulary).forEach(key => {
        if (!(key in aiSuggestion)) {
          aiSuggestion[key] = []
        }
      })

      // Store suggestions
      setSuggestions(prev => ({ ...prev, [imageId]: aiSuggestion }))

      // Auto-apply suggestions to image tags
      mergeTagsWithSuggestions(imageId, aiSuggestion)

      // Prefetch NEXT image after successful fetch
      const currentIdx = uploadedImages.findIndex(img => img.id === imageId)
      const nextIndex = currentIdx + 1
      if (nextIndex < uploadedImages.length) {
        prefetchNext(nextIndex)
      }

    } catch (error) {
      console.error('❌ Error getting AI suggestions:', error)
    } finally {
      setIsLoading(prev => ({ ...prev, [imageId]: false }))
    }
  }, [
    prefetchedSuggestions,
    uploadedImages,
    resizeImageForAI,
    blobToBase64,
    vocabulary,
    mergeTagsWithSuggestions
  ])

  /**
   * OPTIMIZATION: Prefetch AI suggestions for next image in background
   */
  const prefetchNext = useCallback(async (nextIndex: number) => {
    if (nextIndex >= uploadedImages.length) return

    const nextImage = uploadedImages[nextIndex]

    // Skip if already prefetched or currently loading
    if (prefetchedSuggestions.has(nextImage.id) || isLoading[nextImage.id]) {
      console.log(`⏭️ Skipping prefetch for image ${nextIndex + 1} (already cached or loading)`)
      return
    }

    console.log(`🔮 Pre-fetching suggestions for image ${nextIndex + 1}/${uploadedImages.length}...`)
    setIsPrefetching(true)

    try {
      // Resize image to keep under 5MB Claude API limit
      const resizedBlob = await resizeImageForAI(nextImage.file)
      console.log(`📐 Prefetch resized from ${(nextImage.file.size / 1024 / 1024).toFixed(2)}MB to ${(resizedBlob.size / 1024 / 1024).toFixed(2)}MB`)

      // Convert resized image to base64
      const base64Image = await blobToBase64(resizedBlob)

      // Call API with dynamic vocabulary structure
      const response = await fetch('/api/suggest-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          vocabulary,
        }),
      })

      if (response.ok) {
        const aiSuggestion: AISuggestion = await response.json()

        // Ensure all vocabulary categories have entries
        Object.keys(vocabulary).forEach(key => {
          if (!(key in aiSuggestion)) {
            aiSuggestion[key] = []
          }
        })

        // Store in cache
        setPrefetchedSuggestions(prev => {
          const newMap = new Map(prev)
          newMap.set(nextImage.id, aiSuggestion)
          return newMap
        })

        console.log(`✅ Prefetched suggestions for image ${nextIndex + 1}`)
      } else {
        console.warn(`⚠️ Prefetch failed for image ${nextIndex + 1}:`, response.status)
      }
    } catch (error) {
      console.error(`❌ Prefetch error for image ${nextIndex + 1}:`, error)
      // Fail silently - will fetch normally when user navigates
    } finally {
      setIsPrefetching(false)
    }
  }, [uploadedImages, prefetchedSuggestions, isLoading, resizeImageForAI, blobToBase64, vocabulary])

  /**
   * Clear prefetch cache
   */
  const clearCache = useCallback(() => {
    setPrefetchedSuggestions(new Map())
  }, [])

  /**
   * Clear all suggestions
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions({})
    setIsLoading({})
    setPrefetchedSuggestions(new Map())
  }, [])

  // AUTO-TRIGGER: Get suggestions when entering tagging mode or changing images
  useEffect(() => {
    const hasVocabulary = Object.keys(vocabulary).length > 0
    if (isTaggingMode && uploadedImages.length > 0 && hasVocabulary) {
      const currentImage = uploadedImages[currentIndex]
      if (currentImage && !suggestions[currentImage.id] && !isLoading[currentImage.id]) {
        getSuggestions(currentImage.id, currentImage.file)
      }
    }
  }, [isTaggingMode, currentIndex, uploadedImages, vocabulary, suggestions, isLoading, getSuggestions])

  // OPTIMIZATION: Prefetch first 2 images when entering tagging mode
  useEffect(() => {
    const hasVocabulary = Object.keys(vocabulary).length > 0
    if (isTaggingMode && uploadedImages.length > 1 && hasVocabulary && currentIndex === 0) {
      // Wait a bit for first image to start, then prefetch image #2
      const timer = setTimeout(() => {
        console.log('🚀 Starting background prefetch for image #2')
        prefetchNext(1)
      }, 1000) // Wait 1 second after first image starts

      return () => clearTimeout(timer)
    }
  }, [isTaggingMode, uploadedImages, vocabulary, currentIndex, prefetchNext])

  return {
    suggestions,
    isLoading,
    isPrefetching,
    getSuggestions,
    prefetchNext,
    clearCache,
    clearSuggestions
  }
}
