'use client'

import { useState, useCallback } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import type { VocabularyConfig } from './useVocabularyConfig'
import type { UseImageUploadReturn, UploadedImage } from './useImageUpload'
import type { UseAISuggestionsReturn } from './useAISuggestions'
import type { ImageTags } from './useImageTags'

const THUMBNAIL_WIDTH = 800

export interface UseImageSaverParams {
  vocabConfig: VocabularyConfig | null
  imageUploadHook: UseImageUploadReturn
  uploadedImages: UploadedImage[]
  aiSuggestionsHook: UseAISuggestionsReturn
  thumbnailWidth?: number
}

export interface UseImageSaverReturn {
  isSaving: boolean
  saveError: string | null
  saveSuccess: boolean
  saveImage: (image: UploadedImage, tags: ImageTags) => Promise<void>
  clearStatus: () => void
}

/**
 * Hook to manage image upload and save workflow
 *
 * Features:
 * - Thumbnail generation (max 800px)
 * - Supabase storage upload (original + thumbnail)
 * - Database insert with dynamic vocabulary structure
 * - Tag usage tracking (increment counts)
 * - AI correction tracking (for learning)
 * - Session validation
 * - File validation
 * - Auto-redirect when all complete
 *
 * @param params - Configuration and dependencies
 * @returns {UseImageSaverReturn} Save state and functions
 *
 * @example
 * ```tsx
 * const imageSaver = useImageSaver({
 *   vocabConfig,
 *   imageUploadHook: imageUpload,
 *   uploadedImages,
 *   aiSuggestionsHook: aiSuggestions
 * })
 *
 * // Save current image
 * await imageSaver.saveImage(currentImage, currentTags)
 *
 * // Show status
 * {imageSaver.isSaving && <LoadingSpinner />}
 * {imageSaver.saveError && <ErrorMessage>{imageSaver.saveError}</ErrorMessage>}
 * {imageSaver.saveSuccess && <SuccessMessage />}
 * ```
 */
export function useImageSaver({
  vocabConfig,
  imageUploadHook,
  uploadedImages,
  aiSuggestionsHook,
  thumbnailWidth = THUMBNAIL_WIDTH
}: UseImageSaverParams): UseImageSaverReturn {
  const supabase = createClientComponentClient()

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  /**
   * Generate thumbnail from image file
   */
  const generateThumbnail = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > thumbnailWidth) {
          height = (height * thumbnailWidth) / width
          width = thumbnailWidth
        }

        canvas.width = width
        canvas.height = height

        // Draw resized image
        ctx?.drawImage(img, 0, 0, width, height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to generate thumbnail'))
            }
          },
          file.type,
          0.9 // Quality
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }, [thumbnailWidth])

  /**
   * Update tag usage counts in tag_vocabulary table (dynamic)
   */
  const updateTagUsageCounts = useCallback(async (tags: ImageTags) => {
    try {
      if (!vocabConfig) return

      const now = new Date().toISOString()

      // Collect all tags with their categories
      const tagUpdates: Array<{ category: string; tagValue: string }> = []

      vocabConfig.structure.categories.forEach(cat => {
        if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
          const tagValues = tags[cat.key]
          if (Array.isArray(tagValues)) {
            tagValues.forEach(tag => {
              tagUpdates.push({
                category: cat.key,
                tagValue: tag
              })
            })
          }
        }
      })

      // Update each tag's usage count
      for (const { category, tagValue } of tagUpdates) {
        const { error } = await supabase.rpc('increment_tag_usage', {
          p_category: category,
          p_tag_value: tagValue,
          p_last_used_at: now
        })

        if (error) {
          console.error(`⚠️ Error updating usage for ${category}:${tagValue}:`, error)
          // Don't throw - continue with other tags
        }
      }

      console.log(`✅ Updated usage counts for ${tagUpdates.length} tags`)
    } catch (error) {
      console.error('⚠️ Error updating tag usage counts:', error)
      // Don't throw - usage tracking is non-critical
    }
  }, [vocabConfig, supabase])

  /**
   * Track corrections between AI suggestions and designer selections (dynamic)
   */
  const trackCorrections = useCallback(async (
    imageId: string,
    aiSuggestion: any,
    designerTags: ImageTags
  ) => {
    try {
      if (!vocabConfig) return

      // Flatten AI suggestions (only array categories)
      const aiSuggestedFlat: string[] = []
      const designerSelectedFlat: string[] = []

      vocabConfig.structure.categories.forEach(cat => {
        if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
          const aiValues = aiSuggestion[cat.key]
          const designerValues = designerTags[cat.key]

          if (Array.isArray(aiValues)) {
            aiSuggestedFlat.push(...aiValues)
          }
          if (Array.isArray(designerValues)) {
            designerSelectedFlat.push(...designerValues)
          }
        }
      })

      // Calculate differences
      const tagsAdded = designerSelectedFlat.filter(tag => !aiSuggestedFlat.includes(tag))
      const tagsRemoved = aiSuggestedFlat.filter(tag => !designerSelectedFlat.includes(tag))

      // ALWAYS track AI interactions (even with 0 corrections = 100% accuracy)
      console.log('📊 Tracking AI interaction:', {
        added: tagsAdded.length,
        removed: tagsRemoved.length,
        perfect: tagsAdded.length === 0 && tagsRemoved.length === 0
      })

      // Build ai_suggested and designer_selected objects dynamically
      const aiSuggestedData: Record<string, any> = { confidence: aiSuggestion.confidence }
      const designerSelectedData: Record<string, any> = {}

      vocabConfig.structure.categories.forEach(cat => {
        if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
          aiSuggestedData[cat.key] = aiSuggestion[cat.key] || []
          designerSelectedData[cat.key] = designerTags[cat.key] || []
        }
      })

      const { error: correctionError } = await supabase
        .from('tag_corrections')
        .insert({
          image_id: imageId,
          ai_suggested: aiSuggestedData,
          designer_selected: designerSelectedData,
          tags_added: tagsAdded,
          tags_removed: tagsRemoved,
          corrected_at: new Date().toISOString()
        })

      if (correctionError) {
        console.error('⚠️ Error tracking AI interaction:', correctionError)
        // Don't throw - corrections are non-critical
      } else {
        if (tagsAdded.length === 0 && tagsRemoved.length === 0) {
          console.log('✨ Perfect! Designer accepted all AI suggestions (100% accuracy)')
        } else {
          console.log('✅ AI interaction tracked')
        }
      }
    } catch (error) {
      console.error('⚠️ Error in trackCorrections:', error)
      // Don't throw - corrections are non-critical
    }
  }, [vocabConfig, supabase])

  /**
   * Save image to Supabase storage and database
   */
  const saveImage = useCallback(async (image: UploadedImage, tags: ImageTags) => {
    if (!image) return

    // Don't save if already tagged
    if (image.status === 'tagged') {
      console.log('⏭️ Image already tagged, skipping save')
      return
    }

    try {
      setIsSaving(true)
      setSaveError(null)
      setSaveSuccess(false)

      // Check authentication session before upload
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (!session) {
        const errorMsg = 'Please log in again to upload images'
        alert(errorMsg)
        window.location.href = '/tagger/login?redirectTo=/tagger'
        return
      }

      // Validate file before upload
      const { imageFileSchema, sanitizeFilename } = await import('@/lib/validation')
      const fileValidation = imageFileSchema.safeParse({
        size: image.file.size,
        type: image.file.type,
        name: image.filename
      })

      if (!fileValidation.success) {
        const errorMessage = fileValidation.error.issues[0]?.message || 'Invalid file'
        throw new Error(`File validation failed: ${errorMessage}`)
      }

      // Generate unique ID for storage paths
      const imageId = crypto.randomUUID()

      // Sanitize filename securely
      const sanitizedFilename = sanitizeFilename(image.filename)

      // 1. Generate thumbnail
      console.log('📸 Generating thumbnail...')
      const thumbnailBlob = await generateThumbnail(image.file)

      // 2. Upload original image to Supabase Storage
      console.log('⬆️ Uploading original image...')
      const originalPath = `originals/${imageId}-${sanitizedFilename}`

      const { data: uploadData, error: uploadOriginalError } = await supabase.storage
        .from('reference-images')
        .upload(originalPath, image.file, {
          contentType: image.file.type,
          upsert: false
        })

      if (uploadOriginalError) {
        throw uploadOriginalError
      }

      // 3. Upload thumbnail to Supabase Storage
      console.log('⬆️ Uploading thumbnail...')
      const thumbnailPath = `thumbnails/${imageId}-${sanitizedFilename}`

      const { error: uploadThumbnailError } = await supabase.storage
        .from('reference-images')
        .upload(thumbnailPath, thumbnailBlob, {
          contentType: image.file.type,
          upsert: false
        })

      if (uploadThumbnailError) {
        throw uploadThumbnailError
      }

      // 4. Get public URLs
      const { data: originalUrlData } = supabase.storage
        .from('reference-images')
        .getPublicUrl(originalPath)

      const { data: thumbnailUrlData } = supabase.storage
        .from('reference-images')
        .getPublicUrl(thumbnailPath)

      // Get AI suggestions for this image
      const aiSuggestion = aiSuggestionsHook.suggestions[image.id]

      // 5. Build the data object dynamically based on vocabulary config
      console.log('💾 Saving to database...')
      if (!vocabConfig) {
        throw new Error('Vocabulary config not loaded')
      }

      const imageData: any = {
        id: imageId,
        storage_path: originalUrlData.publicUrl,
        thumbnail_path: thumbnailUrlData.publicUrl,
        original_filename: image.filename,
        status: 'tagged',
        tagged_at: new Date().toISOString(),
        ai_model_version: 'claude-sonnet-4-20250514',
        prompt_version: aiSuggestion?.promptVersion || 'baseline',
        file_hash: image.fileHash || null,
        file_size: image.fileSize || null,
        perceptual_hash: image.perceptualHash || null
      }

      // Dynamically populate fields based on vocabulary config
      vocabConfig.structure.categories.forEach((cat) => {
        const storagePath = cat.storage_path
        const value = tags[cat.key]

        if (cat.storage_type === 'array') {
          // Direct array field (e.g., industries, project_types)
          imageData[storagePath] = Array.isArray(value) ? value : []
        } else if (cat.storage_type === 'jsonb_array') {
          // JSONB nested array (e.g., tags.style, tags.mood)
          const pathParts = storagePath.split('.')
          if (pathParts.length === 2) {
            if (!imageData[pathParts[0]]) {
              imageData[pathParts[0]] = {}
            }
            imageData[pathParts[0]][pathParts[1]] = Array.isArray(value) ? value : []
          }
        } else if (cat.storage_type === 'text') {
          // Text field (e.g., notes)
          imageData[storagePath] = value || null
        }
      })

      // Add AI metadata if AI made suggestions
      if (aiSuggestion) {
        const aiSuggestedTags: any = {}
        vocabConfig.structure.categories.forEach(cat => {
          if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
            aiSuggestedTags[cat.key] = aiSuggestion[cat.key] || []
          }
        })

        imageData.ai_suggested_tags = aiSuggestedTags
        imageData.ai_confidence_score = aiSuggestion.confidence === 'high' ? 0.9 :
                                         aiSuggestion.confidence === 'medium' ? 0.6 : 0.3
        imageData.ai_reasoning = null // No longer storing reasoning to save API costs
      } else {
        imageData.ai_suggested_tags = null
        imageData.ai_confidence_score = null
        imageData.ai_reasoning = null
      }

      // Insert into database
      const { error: dbError } = await supabase
        .from('reference_images')
        .insert(imageData)
        .select()
        .single()

      if (dbError) throw dbError

      // 6. Update tag usage counts in vocabulary
      console.log('📊 Updating tag usage counts...')
      await updateTagUsageCounts(tags)

      // 7. Track corrections if AI made suggestions
      if (aiSuggestion) {
        await trackCorrections(imageId, aiSuggestion, tags)
      }

      console.log('✅ Image saved successfully!')
      setSaveSuccess(true)

      // Update image status using hook
      imageUploadHook.updateImageStatus(image.id, 'tagged')

      // Check if all images are now tagged or skipped
      const allComplete = uploadedImages.every(img =>
        img.id === image.id ? true : (img.status === 'tagged' || img.status === 'skipped')
      )

      if (allComplete) {
        console.log('🎉 All images completed! Redirecting to dashboard...')
        setTimeout(() => {
          window.location.href = '/tagger/dashboard'
        }, 1500) // Give user time to see success message
      } else {
        // Clear success message after 2 seconds (only if not redirecting)
        setTimeout(() => setSaveSuccess(false), 2000)
      }

    } catch (error) {
      console.error('❌ Error saving image:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to save image')
    } finally {
      setIsSaving(false)
    }
  }, [
    vocabConfig,
    supabase,
    generateThumbnail,
    updateTagUsageCounts,
    trackCorrections,
    imageUploadHook,
    uploadedImages,
    aiSuggestionsHook
  ])

  /**
   * Clear save status messages
   */
  const clearStatus = useCallback(() => {
    setSaveError(null)
    setSaveSuccess(false)
  }, [])

  return {
    isSaving,
    saveError,
    saveSuccess,
    saveImage,
    clearStatus
  }
}
