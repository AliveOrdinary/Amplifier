'use client'

import { useState, useCallback } from 'react'
import type { UploadedImage } from './useImageUpload'

export type FilterType = 'all' | 'pending' | 'skipped' | 'tagged'

export interface StatusCounts {
  all: number
  pending: number
  skipped: number
  tagged: number
}

export interface UseImageNavigationReturn {
  currentIndex: number
  isTaggingMode: boolean
  currentFilter: FilterType
  setCurrentIndex: (index: number) => void
  setIsTaggingMode: (mode: boolean) => void
  setFilter: (filter: FilterType) => void
  previous: () => void
  next: () => void
  skip: (images: UploadedImage[], onUpdate: (images: UploadedImage[]) => void) => void
  saveAndNext: (images: UploadedImage[], onSave: () => Promise<void>) => Promise<void>
  reviewSkipped: (images: UploadedImage[]) => void
  getStatusCounts: (images: UploadedImage[]) => StatusCounts
  jumpToStatus: (images: UploadedImage[], status: FilterType) => void
}

/**
 * Hook to manage image navigation, filtering, and status transitions
 *
 * Handles:
 * - Current index management
 * - Previous/Next navigation
 * - Skip functionality with auto-advance
 * - Save & Next with auto-advance to untagged
 * - Filter-based navigation (pending, skipped, tagged)
 * - Status counts for badges
 *
 * @returns {UseImageNavigationReturn} Navigation state and functions
 *
 * @example
 * ```tsx
 * const {
 *   currentIndex,
 *   next,
 *   previous,
 *   skip,
 *   getStatusCounts
 * } = useImageNavigation()
 *
 * const images = useImageUpload()
 * const counts = getStatusCounts(images.images)
 *
 * <button onClick={previous}>Previous</button>
 * <button onClick={next}>Next</button>
 * <button onClick={() => skip(images.images, images.addImages)}>Skip</button>
 * ```
 */
export function useImageNavigation(): UseImageNavigationReturn {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTaggingMode, setIsTaggingMode] = useState(false)
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all')

  /**
   * Navigate to previous image
   */
  const previous = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }, [])

  /**
   * Navigate to next image
   */
  const next = useCallback(() => {
    setCurrentIndex(prev => prev + 1) // Caller should check bounds
  }, [])

  /**
   * Skip current image and advance
   */
  const skip = useCallback((
    images: UploadedImage[],
    onUpdate: (images: UploadedImage[]) => void
  ) => {
    // Mark current image as skipped
    const updatedImages = images.map((img, idx) =>
      idx === currentIndex ? { ...img, status: 'skipped' as const } : img
    )
    onUpdate(updatedImages)

    // Check if all images are now tagged or skipped
    const allComplete = updatedImages.every(img =>
      img.status === 'tagged' || img.status === 'skipped'
    )

    if (allComplete) {
      console.log('🎉 All images completed! Redirecting to dashboard...')
      setTimeout(() => {
        window.location.href = '/tagger/dashboard'
      }, 1000)
      return
    }

    // Move to next image if available
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex])

  /**
   * Save current image and navigate to next untagged
   */
  const saveAndNext = useCallback(async (
    images: UploadedImage[],
    onSave: () => Promise<void>
  ) => {
    // Save current image
    await onSave()

    // Find next untagged image (pending or skipped)
    const nextUntaggedIndex = images.findIndex(
      (img, idx) => idx > currentIndex && img.status !== 'tagged'
    )

    if (nextUntaggedIndex !== -1) {
      // Move to next untagged image
      setCurrentIndex(nextUntaggedIndex)
    } else {
      // No more untagged images
      console.log('✅ All images processed!')
    }
  }, [currentIndex])

  /**
   * Navigate to first skipped image
   */
  const reviewSkipped = useCallback((images: UploadedImage[]) => {
    const firstSkippedIndex = images.findIndex(img => img.status === 'skipped')
    if (firstSkippedIndex !== -1) {
      setCurrentFilter('skipped')
      setCurrentIndex(firstSkippedIndex)
    }
  }, [])

  /**
   * Get status counts for all images
   */
  const getStatusCounts = useCallback((images: UploadedImage[]): StatusCounts => {
    return {
      all: images.length,
      pending: images.filter(img => img.status === 'pending').length,
      skipped: images.filter(img => img.status === 'skipped').length,
      tagged: images.filter(img => img.status === 'tagged').length
    }
  }, [])

  /**
   * Jump to first image with given status
   */
  const jumpToStatus = useCallback((images: UploadedImage[], status: FilterType) => {
    setCurrentFilter(status)
    if (status === 'all') {
      setCurrentIndex(0)
      return
    }

    const firstIndex = images.findIndex(img => img.status === status)
    if (firstIndex !== -1) {
      setCurrentIndex(firstIndex)
    }
  }, [])

  return {
    currentIndex,
    isTaggingMode,
    currentFilter,
    setCurrentIndex,
    setIsTaggingMode,
    setFilter: setCurrentFilter,
    previous,
    next,
    skip,
    saveAndNext,
    reviewSkipped,
    getStatusCounts,
    jumpToStatus
  }
}
