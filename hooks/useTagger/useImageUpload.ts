'use client'

import { useState, useRef, useEffect } from 'react'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export interface UploadedImage {
  id: string
  file: File
  previewUrl: string
  filename: string
  status: 'pending' | 'tagged' | 'skipped'
  fileHash?: string
  fileSize?: number
  perceptualHash?: string
}

export interface UseImageUploadReturn {
  images: UploadedImage[]
  addImages: (images: UploadedImage[]) => void
  removeImage: (id: string) => void
  updateImageStatus: (id: string, status: 'pending' | 'tagged' | 'skipped') => void
  updateImage: (id: string, updates: Partial<UploadedImage>) => void
  clearImages: () => void
  validateFile: (file: File) => { valid: boolean; error?: string }
  createPreviewUrl: (file: File) => string
}

/**
 * Hook to manage uploaded images with file validation and blob URL cleanup
 *
 * Handles:
 * - Image array state management
 * - File type and size validation
 * - Blob URL creation and automatic cleanup
 * - Image status updates (pending/tagged/skipped)
 *
 * @returns {UseImageUploadReturn} Images array and management functions
 *
 * @example
 * ```tsx
 * const {
 *   images,
 *   addImages,
 *   validateFile,
 *   createPreviewUrl
 * } = useImageUpload()
 *
 * const handleFile = (file: File) => {
 *   const validation = validateFile(file)
 *   if (!validation.valid) {
 *     alert(validation.error)
 *     return
 *   }
 *
 *   const previewUrl = createPreviewUrl(file)
 *   addImages([{
 *     id: crypto.randomUUID(),
 *     file,
 *     previewUrl,
 *     filename: file.name,
 *     status: 'pending'
 *   }])
 * }
 * ```
 */
export function useImageUpload(): UseImageUploadReturn {
  const [images, setImages] = useState<UploadedImage[]>([])
  const blobUrlsRef = useRef<Set<string>>(new Set())

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url)
      })
      blobUrlsRef.current.clear()
    }
  }, [])

  /**
   * Validate file type and size
   */
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Validate file type
    if (!VALID_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type: ${file.name}\nPlease upload JPG, PNG, or WEBP images.`
      }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File too large: ${file.name}\nMaximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      }
    }

    return { valid: true }
  }

  /**
   * Create a blob URL for file preview (automatically tracked for cleanup)
   */
  const createPreviewUrl = (file: File): string => {
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.add(url)
    return url
  }

  /**
   * Add new images to the array
   */
  const addImages = (newImages: UploadedImage[]) => {
    setImages(prev => [...prev, ...newImages])
  }

  /**
   * Remove an image by ID (cleans up blob URL)
   */
  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image?.previewUrl && blobUrlsRef.current.has(image.previewUrl)) {
        URL.revokeObjectURL(image.previewUrl)
        blobUrlsRef.current.delete(image.previewUrl)
      }
      return prev.filter(img => img.id !== id)
    })
  }

  /**
   * Update image status
   */
  const updateImageStatus = (id: string, status: 'pending' | 'tagged' | 'skipped') => {
    setImages(prev =>
      prev.map(img => (img.id === id ? { ...img, status } : img))
    )
  }

  /**
   * Update image with partial data
   */
  const updateImage = (id: string, updates: Partial<UploadedImage>) => {
    setImages(prev =>
      prev.map(img => (img.id === id ? { ...img, ...updates } : img))
    )
  }

  /**
   * Clear all images (cleans up all blob URLs)
   */
  const clearImages = () => {
    blobUrlsRef.current.forEach(url => {
      URL.revokeObjectURL(url)
    })
    blobUrlsRef.current.clear()
    setImages([])
  }

  return {
    images,
    addImages,
    removeImage,
    updateImageStatus,
    updateImage,
    clearImages,
    validateFile,
    createPreviewUrl
  }
}
