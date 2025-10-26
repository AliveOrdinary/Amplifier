'use client'

import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import TagCheckbox from './TagCheckbox'
import ImagePreview from './ImagePreview'

// Image processing constants
const MAX_IMAGE_WIDTH = 1200
const THUMBNAIL_WIDTH = 800
const THUMBNAIL_HEIGHT = 600
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const AI_IMAGE_MAX_SIZE = 20 * 1024 * 1024 // 20MB

interface UploadedImage {
  id: string
  file: File
  previewUrl: string
  filename: string
  status: 'pending' | 'tagged' | 'skipped'
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

interface TagVocabularyRow {
  category: string
  tag_value: string
  sort_order: number
}

interface ImageTags {
  [categoryKey: string]: string[] | string
}

interface AISuggestion {
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  promptVersion?: 'baseline' | 'enhanced'
  [categoryKey: string]: string[] | string | 'high' | 'medium' | 'low' | 'baseline' | 'enhanced' | undefined
}

export default function ImageTaggerClient() {
  // Initialize Supabase client with proper session handling
  const supabase = createClientComponentClient()

  // Vocabulary config state
  const [vocabConfig, setVocabConfig] = useState<VocabularyConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  // State management
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTaggingMode, setIsTaggingMode] = useState(false)
  const [vocabulary, setVocabulary] = useState<TagVocabulary>({})
  const [isLoadingVocabulary, setIsLoadingVocabulary] = useState(true)
  const [vocabularyError, setVocabularyError] = useState<string | null>(null)

  // Track tags for each image (keyed by image ID)
  const [imageTags, setImageTags] = useState<Record<string, ImageTags>>({})

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Custom tag modal state
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false)
  const [addTagCategory, setAddTagCategory] = useState<string | null>(null)
  const [newTagValue, setNewTagValue] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [similarTags, setSimilarTags] = useState<string[]>([])
  const [addTagError, setAddTagError] = useState<string | null>(null)

  // AI suggestion state
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AISuggestion>>({})
  const [isLoadingAI, setIsLoadingAI] = useState<Record<string, boolean>>({})

  // Filter state
  type FilterType = 'all' | 'pending' | 'skipped' | 'tagged'
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all')

  // Load vocabulary config from API on mount
  useEffect(() => {
    const loadVocabularyConfig = async () => {
      try {
        setConfigLoading(true)
        setConfigError(null)

        const response = await fetch('/api/vocabulary-config')
        if (!response.ok) {
          throw new Error('Failed to load vocabulary config')
        }

        const { config } = await response.json()
        setVocabConfig(config)

        console.log('✅ Vocabulary config loaded:', config.structure.categories.length, 'categories')
      } catch (error) {
        console.error('❌ Error loading vocabulary config:', error)
        setConfigError(error instanceof Error ? error.message : 'Failed to load vocabulary config')
      } finally {
        setConfigLoading(false)
      }
    }

    loadVocabularyConfig()
  }, [])

  // Load vocabulary from Supabase when config is ready
  useEffect(() => {
    if (!vocabConfig) return

    const loadVocabulary = async () => {
      try {
        setIsLoadingVocabulary(true)
        setVocabularyError(null)

        // Fetch all active tags, sorted by category and sort_order
        const { data, error } = await supabase
          .from('tag_vocabulary')
          .select('category, tag_value, sort_order')
          .eq('is_active', true)
          .order('category', { ascending: true })
          .order('sort_order', { ascending: true })

        if (error) {
          throw error
        }

        if (!data) {
          throw new Error('No vocabulary data returned')
        }

        // Group tags by category
        const groupedVocabulary = data.reduce((acc, row: TagVocabularyRow) => {
          const category = row.category
          if (!acc[category]) {
            acc[category] = []
          }
          acc[category].push(row.tag_value)
          return acc
        }, {} as Record<string, string[]>)

        // Map database categories to vocabulary config keys dynamically
        const vocabularyState: TagVocabulary = {}

        vocabConfig.structure.categories.forEach(cat => {
          if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
            // Map from config key to database category name
            // Most keys match database categories, but handle special cases
            const dbCategory = cat.key === 'project_types' ? 'project_type' :
                              cat.key === 'industries' ? 'industry' : cat.key
            vocabularyState[cat.key] = groupedVocabulary[dbCategory] || []
          }
        })

        setVocabulary(vocabularyState)

        // Log for verification
        console.log('✅ Vocabulary loaded successfully:', vocabularyState)
        const tagCounts: Record<string, number> = {}
        let total = 0
        Object.entries(vocabularyState).forEach(([key, values]) => {
          tagCounts[key] = values.length
          total += values.length
        })
        console.log('📊 Tag counts:', { ...tagCounts, total })
      } catch (error) {
        console.error('❌ Error loading vocabulary:', error)
        setVocabularyError(error instanceof Error ? error.message : 'Failed to load vocabulary')
      } finally {
        setIsLoadingVocabulary(false)
      }
    }

    loadVocabulary()
  }, [vocabConfig])

  // Store blob URLs for cleanup
  const blobUrlsRef = useRef<Set<string>>(new Set())

  // Cleanup preview URLs only on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url)
      })
      blobUrlsRef.current.clear()
    }
  }, [])

  // Handle file upload
  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return

    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      return validTypes.includes(file.type)
    })

    const newImages: UploadedImage[] = validFiles.map(file => {
      const previewUrl = URL.createObjectURL(file)
      blobUrlsRef.current.add(previewUrl) // Track for cleanup
      return {
        id: crypto.randomUUID(),
        file,
        previewUrl,
        filename: file.name,
        status: 'pending'
      }
    })

    setUploadedImages(prev => [...prev, ...newImages])
  }

  // Start tagging
  const handleStartTagging = () => {
    setIsTaggingMode(true)
    setCurrentIndex(0)
  }

  // Resize image for AI analysis (max 1200px, keep under 5MB limit)
  const resizeImageForAI = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        // Calculate dimensions (max width on longest side)
        let width = img.width
        let height = img.height
        const maxSize = MAX_IMAGE_WIDTH

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
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
  }

  // Convert Blob to base64 data URI
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Get AI tag suggestions for an image
  const getSuggestionsFromAI = async (imageId: string, file: File) => {
    try {
      // Mark as loading
      setIsLoadingAI(prev => ({ ...prev, [imageId]: true }))

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

      const suggestions: AISuggestion = await response.json()

      console.log('✨ AI suggestions received:', suggestions)

      // Ensure all vocabulary categories have entries (even if empty)
      Object.keys(vocabulary).forEach(key => {
        if (!(key in suggestions)) {
          suggestions[key] = []
        }
      })

      // Store suggestions
      setAiSuggestions(prev => ({ ...prev, [imageId]: suggestions }))

      // Auto-apply suggestions to image tags (dynamically merge based on config)
      if (!vocabConfig) return

      const currentTags = imageTags[imageId] || {}

      // Merge AI suggestions with existing manual selections for each category
      const mergedTags: ImageTags = {}

      vocabConfig.structure.categories.forEach(cat => {
        if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
          const currentValues = (currentTags[cat.key] || []) as string[]
          const suggestedValues = (suggestions[cat.key] || []) as string[]
          mergedTags[cat.key] = [...new Set([...currentValues, ...suggestedValues])]
        } else if (cat.storage_type === 'text') {
          mergedTags[cat.key] = currentTags[cat.key] || ''
        }
      })

      setImageTags(prev => ({
        ...prev,
        [imageId]: mergedTags
      }))

    } catch (error) {
      console.error('❌ Error getting AI suggestions:', error)
    } finally {
      setIsLoadingAI(prev => ({ ...prev, [imageId]: false }))
    }
  }

  // Trigger AI suggestions when entering tagging mode or changing images
  useEffect(() => {
    const hasVocabulary = Object.keys(vocabulary).length > 0
    if (isTaggingMode && uploadedImages.length > 0 && hasVocabulary) {
      const currentImage = uploadedImages[currentIndex]
      if (currentImage && !aiSuggestions[currentImage.id] && !isLoadingAI[currentImage.id]) {
        getSuggestionsFromAI(currentImage.id, currentImage.file)
      }
    }
  }, [isTaggingMode, currentIndex, uploadedImages, vocabulary])

  // Update tag usage counts in tag_vocabulary table (dynamic)
  const updateTagUsageCounts = async (tags: ImageTags) => {
    try {
      if (!vocabConfig) return

      const now = new Date().toISOString()

      // Map config keys to database categories
      const keyToDbCategory = (key: string): string => {
        if (key === 'industries') return 'industry'
        if (key === 'project_types') return 'project_type'
        return key
      }

      // Collect all tags with their categories
      const tagUpdates: Array<{ category: string; tagValue: string }> = []

      vocabConfig.structure.categories.forEach(cat => {
        if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
          const tagValues = tags[cat.key]
          if (Array.isArray(tagValues)) {
            tagValues.forEach(tag => {
              tagUpdates.push({
                category: keyToDbCategory(cat.key),
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
  }

  // Track corrections between AI suggestions and designer selections (dynamic)
  const trackCorrections = async (
    imageId: string,
    aiSuggestion: AISuggestion,
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

      // Only insert if there are corrections
      if (tagsAdded.length > 0 || tagsRemoved.length > 0) {
        console.log('📊 Tracking corrections:', {
          added: tagsAdded.length,
          removed: tagsRemoved.length
        })

        // Build ai_suggested and designer_selected objects dynamically
        const aiSuggestedData: Record<string, any> = { confidence: aiSuggestion.confidence, reasoning: aiSuggestion.reasoning }
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
          console.error('⚠️ Error tracking corrections:', correctionError)
          // Don't throw - corrections are non-critical
        } else {
          console.log('✅ Corrections tracked successfully')
        }
      } else {
        console.log('✨ Designer accepted all AI suggestions (no corrections)')
      }
    } catch (error) {
      console.error('⚠️ Error in trackCorrections:', error)
      // Don't throw - corrections are non-critical
    }
  }

  // Generate thumbnail from image file
  const generateThumbnail = async (file: File, maxWidth: number = THUMBNAIL_WIDTH): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
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
  }

  // Save current image to Supabase
  const handleSaveImage = async () => {
    const currentImage = uploadedImages[currentIndex]
    const currentTags = getCurrentImageTags()

    if (!currentImage) return

    // Don't save if already tagged
    if (currentImage.status === 'tagged') {
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
        size: currentImage.file.size,
        type: currentImage.file.type,
        name: currentImage.filename
      })

      if (!fileValidation.success) {
        const errorMessage = fileValidation.error.issues[0]?.message || 'Invalid file'
        throw new Error(`File validation failed: ${errorMessage}`)
      }

      // Generate unique ID for storage paths
      const imageId = crypto.randomUUID()

      // Sanitize filename securely
      const sanitizedFilename = sanitizeFilename(currentImage.filename)

      // 1. Generate thumbnail
      console.log('📸 Generating thumbnail...')
      const thumbnailBlob = await generateThumbnail(currentImage.file)

      // 2. Upload original image to Supabase Storage
      console.log('⬆️ Uploading original image...')
      const originalPath = `originals/${imageId}-${sanitizedFilename}`

      const { data: uploadData, error: uploadOriginalError } = await supabase.storage
        .from('reference-images')
        .upload(originalPath, currentImage.file, {
          contentType: currentImage.file.type,
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
          contentType: currentImage.file.type,
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
      const aiSuggestion = aiSuggestions[currentImage.id]

      // 5. Build the data object dynamically based on vocabulary config
      console.log('💾 Saving to database...')
      if (!vocabConfig) {
        throw new Error('Vocabulary config not loaded')
      }

      const imageData: any = {
        id: imageId,
        storage_path: originalUrlData.publicUrl,
        thumbnail_path: thumbnailUrlData.publicUrl,
        original_filename: currentImage.filename,
        status: 'tagged',
        tagged_at: new Date().toISOString(),
        ai_model_version: 'claude-sonnet-4-20250514',
        prompt_version: aiSuggestion?.promptVersion || 'baseline'
      }

      // Dynamically populate fields based on vocabulary config
      vocabConfig.structure.categories.forEach((cat) => {
        const storagePath = cat.storage_path
        const value = currentTags[cat.key]

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
        imageData.ai_reasoning = aiSuggestion.reasoning || null
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
      await updateTagUsageCounts(currentTags)

      // 7. Track corrections if AI made suggestions
      if (aiSuggestion) {
        await trackCorrections(imageId, aiSuggestion, currentTags)
      }

      console.log('✅ Image saved successfully!')
      setSaveSuccess(true)

      // Update image status
      setUploadedImages(prev =>
        prev.map((img, idx) =>
          idx === currentIndex ? { ...img, status: 'tagged' as const } : img
        )
      )

      // Clear success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000)

    } catch (error) {
      console.error('❌ Error saving image:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to save image')
    } finally {
      setIsSaving(false)
    }
  }

  // Navigation handlers
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < uploadedImages.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  const handleSkip = () => {
    // Mark current image as skipped
    setUploadedImages(prev =>
      prev.map((img, idx) =>
        idx === currentIndex ? { ...img, status: 'skipped' } : img
      )
    )
    // Move to next image if available
    if (currentIndex < uploadedImages.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  const handleSaveAndNext = async () => {
    // Save current image
    await handleSaveImage()

    // Find next untagged image (pending or skipped)
    const nextUntaggedIndex = uploadedImages.findIndex(
      (img, idx) => idx > currentIndex && img.status !== 'tagged'
    )

    if (nextUntaggedIndex !== -1) {
      // Move to next untagged image
      setCurrentIndex(nextUntaggedIndex)
      setSaveError(null) // Clear any previous errors
    } else {
      // No more untagged images
      console.log('✅ All images processed!')
    }
  }

  // Review skipped images
  const handleReviewSkipped = () => {
    const skippedImages = uploadedImages.filter(img => img.status === 'skipped')
    if (skippedImages.length > 0) {
      setCurrentFilter('skipped')
      // Find index of first skipped image in full array
      const firstSkippedIndex = uploadedImages.findIndex(img => img.status === 'skipped')
      if (firstSkippedIndex !== -1) {
        setCurrentIndex(firstSkippedIndex)
      }
    }
  }

  // Get status counts for filter badges
  const getStatusCounts = () => {
    return {
      all: uploadedImages.length,
      pending: uploadedImages.filter(img => img.status === 'pending').length,
      skipped: uploadedImages.filter(img => img.status === 'skipped').length,
      tagged: uploadedImages.filter(img => img.status === 'tagged').length
    }
  }

  // Get current image tags (dynamic based on config)
  const getCurrentImageTags = (): ImageTags => {
    const currentImage = uploadedImages[currentIndex]
    if (!currentImage || !vocabConfig) {
      return {}
    }

    // If tags exist for this image, return them
    if (imageTags[currentImage.id]) {
      return imageTags[currentImage.id]
    }

    // Otherwise, return empty state based on config
    const emptyTags: ImageTags = {}
    vocabConfig.structure.categories.forEach(cat => {
      if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
        emptyTags[cat.key] = []
      } else if (cat.storage_type === 'text') {
        emptyTags[cat.key] = ''
      }
    })

    return emptyTags
  }

  // Update current image tags
  const updateCurrentImageTags = (tags: Partial<ImageTags>) => {
    const currentImage = uploadedImages[currentIndex]
    if (!currentImage) return

    // Filter out undefined values from tags
    const definedTags = Object.fromEntries(
      Object.entries(tags).filter(([_, value]) => value !== undefined)
    ) as ImageTags

    setImageTags(prev => ({
      ...prev,
      [currentImage.id]: {
        ...getCurrentImageTags(),
        ...definedTags
      }
    }))
  }

  // Simple fuzzy matching - checks if strings are similar
  const findSimilarTags = (input: string, tags: string[]): string[] => {
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
  }

  // Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
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
  }

  // Open add tag modal (now accepts any category key)
  const handleOpenAddTagModal = (categoryKey: string) => {
    setAddTagCategory(categoryKey)
    setNewTagValue('')
    setSimilarTags([])
    setAddTagError(null)
    setIsAddTagModalOpen(true)
  }

  // Check for similar tags as user types
  const handleTagInputChange = (value: string) => {
    setNewTagValue(value)
    setAddTagError(null)

    if (!addTagCategory) return

    // Get vocabulary for current category
    const existingTags = vocabulary[addTagCategory] || []

    // Find similar tags
    const similar = findSimilarTags(value, existingTags)
    setSimilarTags(similar)
  }

  // Add custom tag to vocabulary (dynamic)
  const handleAddCustomTag = async () => {
    if (!addTagCategory || !newTagValue.trim() || !vocabConfig) return

    try {
      setIsAddingTag(true)
      setAddTagError(null)

      // Validate tag value format using Zod
      const { tagValueSchema } = await import('@/lib/validation')
      const validationResult = tagValueSchema.safeParse(newTagValue)

      if (!validationResult.success) {
        const errorMessage = validationResult.error.issues[0]?.message || 'Invalid tag format'
        setAddTagError(errorMessage)
        setIsAddingTag(false)
        return
      }

      // Use the validated and normalized tag value
      const normalized = validationResult.data

      // Map config key to database category
      const keyToDbCategory = (key: string): string => {
        if (key === 'industries') return 'industry'
        if (key === 'project_types') return 'project_type'
        return key
      }

      const dbCategory = keyToDbCategory(addTagCategory)

      // Check for exact duplicate
      const existingTags = vocabulary[addTagCategory] || []
      if (existingTags.some(tag => tag.toLowerCase() === normalized)) {
        setAddTagError('This tag already exists in the vocabulary')
        setIsAddingTag(false)
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

      // Update local vocabulary state
      setVocabulary(prev => ({
        ...prev,
        [addTagCategory]: [...(prev[addTagCategory] || []), normalized]
      }))

      // Auto-select the new tag
      const currentTags = getCurrentImageTags()
      const currentValues = currentTags[addTagCategory] as string[]
      updateCurrentImageTags({
        [addTagCategory]: [...currentValues, normalized]
      })

      console.log(`✅ Added custom tag: ${normalized} to ${dbCategory}`)

      // Close modal
      setIsAddTagModalOpen(false)
      setNewTagValue('')
      setSimilarTags([])

    } catch (error) {
      console.error('❌ Error adding custom tag:', error)
      setAddTagError(error instanceof Error ? error.message : 'Failed to add tag')
    } finally {
      setIsAddingTag(false)
    }
  }

  // Use similar tag instead of creating new one
  const handleUseSimilarTag = (tag: string) => {
    if (!addTagCategory) return

    const currentTags = getCurrentImageTags()
    const currentValues = currentTags[addTagCategory] as string[]

    // Add to current image tags if not already selected
    if (!currentValues.includes(tag)) {
      updateCurrentImageTags({
        [addTagCategory]: [...currentValues, tag]
      })
    }

    // Close modal
    setIsAddTagModalOpen(false)
    setNewTagValue('')
    setSimilarTags([])
  }

  // Show loading state
  if (configLoading || isLoadingVocabulary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="text-gray-600">
            {configLoading ? 'Loading vocabulary configuration...' : 'Loading tag vocabulary...'}
          </p>
        </div>
      </div>
    )
  }

  // Show error state
  if (configError || vocabularyError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-red-900 mb-2">
          {configError ? 'Failed to Load Vocabulary Configuration' : 'Failed to Load Vocabulary'}
        </h3>
        <p className="text-red-700 mb-4">{configError || vocabularyError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  // Render based on state
  if (!isTaggingMode) {
    return (
      <UploadSection
        onFilesSelected={handleFilesSelected}
        uploadedImages={uploadedImages}
        onStartTagging={handleStartTagging}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          <div className="flex items-center space-x-2">
            <span className="text-lg">✓</span>
            <span className="font-medium">Image saved successfully!</span>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {saveError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md">
          <div className="flex items-center justify-between space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">✕</span>
              <div>
                <p className="font-medium">Failed to save image</p>
                <p className="text-sm text-red-100 mt-1">{saveError}</p>
              </div>
            </div>
            <button
              onClick={() => setSaveError(null)}
              className="text-white hover:text-red-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Add Tag Modal */}
      {isAddTagModalOpen && addTagCategory && vocabConfig && (
        <AddTagModal
          category={addTagCategory}
          categoryLabel={
            vocabConfig.structure.categories.find(cat => cat.key === addTagCategory)?.label || addTagCategory
          }
          newTagValue={newTagValue}
          similarTags={similarTags}
          isAdding={isAddingTag}
          error={addTagError}
          onInputChange={handleTagInputChange}
          onAdd={handleAddCustomTag}
          onUseSimilar={handleUseSimilarTag}
          onClose={() => {
            setIsAddTagModalOpen(false)
            setNewTagValue('')
            setSimilarTags([])
            setAddTagError(null)
          }}
        />
      )}

      {/* Filter Bar */}
      <FilterBar
        currentFilter={currentFilter}
        statusCounts={getStatusCounts()}
        onFilterChange={(filter) => {
          setCurrentFilter(filter)
          // Jump to first image of selected type
          if (filter !== 'all') {
            const firstIndex = uploadedImages.findIndex(img => img.status === filter)
            if (firstIndex !== -1) {
              setCurrentIndex(firstIndex)
            }
          }
        }}
        onReviewSkipped={handleReviewSkipped}
      />

      {/* Progress Indicator */}
      <ProgressIndicator
        current={currentIndex + 1}
        total={uploadedImages.length}
        currentStatus={uploadedImages[currentIndex]?.status}
      />

      {/* Main Tagging Interface */}
      <div className="flex gap-6">
        {/* Image Preview - 70% */}
        <div className="w-[70%]">
          <ImagePreview
            image={uploadedImages[currentIndex]}
            currentIndex={currentIndex}
            totalImages={uploadedImages.length}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSkip={handleSkip}
            onSaveAndNext={handleSaveAndNext}
            isSaving={isSaving}
          />
        </div>

        {/* Tag Form - 30% */}
        <div className="w-[30%]">
          <TagForm
            vocabConfig={vocabConfig}
            vocabulary={vocabulary}
            currentTags={getCurrentImageTags()}
            onUpdateTags={updateCurrentImageTags}
            onOpenAddTagModal={handleOpenAddTagModal}
            aiSuggestions={uploadedImages[currentIndex] ? aiSuggestions[uploadedImages[currentIndex].id] : undefined}
            isLoadingAI={uploadedImages[currentIndex] ? isLoadingAI[uploadedImages[currentIndex].id] : false}
          />
        </div>
      </div>
    </div>
  )
}

// Upload Section Component
interface UploadSectionProps {
  onFilesSelected: (files: FileList | null) => void
  uploadedImages: UploadedImage[]
  onStartTagging: () => void
}

function UploadSection({ onFilesSelected, uploadedImages, onStartTagging }: UploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    onFilesSelected(e.dataTransfer.files)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files)
  }

  const handleSelectClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-6">
      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging
            ? 'border-black bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="space-y-4">
          <div className="text-6xl">📁</div>
          <h2 className="text-2xl font-semibold">Upload Reference Images</h2>
          <p className="text-gray-600">
            Drag and drop images here, or click to select files
          </p>
          <p className="text-sm text-gray-500">
            Supported formats: JPG, PNG, WEBP
          </p>
          <button
            onClick={handleSelectClick}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Select Images
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Uploaded Images Grid */}
      {uploadedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {uploadedImages.length} {uploadedImages.length === 1 ? 'Image' : 'Images'} Uploaded
            </h3>
            <button
              onClick={onStartTagging}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Start Tagging →
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {uploadedImages.map((image) => (
              <div
                key={image.id}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  <img
                    src={image.previewUrl}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate" title={image.filename}>
                    {image.filename}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Filter Bar Component
interface FilterBarProps {
  currentFilter: 'all' | 'pending' | 'skipped' | 'tagged'
  statusCounts: {
    all: number
    pending: number
    skipped: number
    tagged: number
  }
  onFilterChange: (filter: 'all' | 'pending' | 'skipped' | 'tagged') => void
  onReviewSkipped: () => void
}

function FilterBar({ currentFilter, statusCounts, onFilterChange, onReviewSkipped }: FilterBarProps) {
  const filters: Array<{ key: 'all' | 'pending' | 'skipped' | 'tagged'; label: string; color: string; description: string }> = [
    { key: 'all', label: 'All Images', color: 'gray', description: 'Show all images' },
    { key: 'pending', label: 'Pending', color: 'gray', description: 'Jump to first pending' },
    { key: 'skipped', label: 'Skipped', color: 'orange', description: 'Jump to first skipped' },
    { key: 'tagged', label: 'Completed', color: 'green', description: 'Jump to first tagged' }
  ]

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {filters.map((filter) => {
            const count = statusCounts[filter.key]
            const isActive = currentFilter === filter.key

            return (
              <button
                key={filter.key}
                onClick={() => onFilterChange(filter.key)}
                disabled={count === 0 && filter.key !== 'all'}
                title={filter.description}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? filter.color === 'orange'
                      ? 'bg-orange-100 text-orange-800 border-2 border-orange-400'
                      : filter.color === 'green'
                      ? 'bg-green-100 text-green-800 border-2 border-green-400'
                      : 'bg-gray-200 text-gray-900 border-2 border-gray-400'
                    : count === 0 && filter.key !== 'all'
                    ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                }`}
              >
                {filter.label}
                <span className={`ml-2 ${
                  isActive ? 'font-bold' : 'font-normal'
                }`}>
                  ({count})
                </span>
              </button>
            )
          })}
        </div>

        {statusCounts.skipped > 0 && (
          <button
            onClick={onReviewSkipped}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors shadow-sm"
          >
            Review Skipped ({statusCounts.skipped})
          </button>
        )}
      </div>
    </div>
  )
}

// Progress Indicator Component
interface ProgressIndicatorProps {
  current: number
  total: number
  currentStatus?: 'pending' | 'tagged' | 'skipped'
}

function ProgressIndicator({ current, total, currentStatus }: ProgressIndicatorProps) {
  const percentage = (current / total) * 100

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-gray-500', textColor: 'text-gray-700' },
    skipped: { label: 'Skipped', color: 'bg-orange-500', textColor: 'text-orange-700' },
    tagged: { label: 'Tagged', color: 'bg-green-500', textColor: 'text-green-700' }
  }

  const status = currentStatus ? statusConfig[currentStatus] : null

  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-gray-900">
            Image {current} of {total}
          </span>
          {status && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.textColor} bg-${status.color}/10`}>
              <span className={`w-2 h-2 rounded-full ${status.color}`} />
              {status.label}
            </span>
          )}
        </div>
        <span className="text-sm font-medium text-gray-600">
          {Math.round(percentage)}% Complete
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-black h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Tag Form Component (Dynamic)
interface TagFormProps {
  vocabConfig: VocabularyConfig | null
  vocabulary: TagVocabulary
  currentTags: ImageTags
  onUpdateTags: (tags: Partial<ImageTags>) => void
  onOpenAddTagModal: (categoryKey: string) => void
  aiSuggestions?: AISuggestion
  isLoadingAI?: boolean
}

function TagForm({ vocabConfig, vocabulary, currentTags, onUpdateTags, onOpenAddTagModal, aiSuggestions, isLoadingAI = false }: TagFormProps) {
  const handleTagToggle = (categoryKey: string, tagValue: string) => {
    const currentValues = currentTags[categoryKey] as string[]
    const newValues = currentValues.includes(tagValue)
      ? currentValues.filter(v => v !== tagValue)
      : [...currentValues, tagValue]

    onUpdateTags({ [categoryKey]: newValues })
  }

  const handleTextChange = (categoryKey: string, value: string) => {
    onUpdateTags({ [categoryKey]: value })
  }

  if (!vocabConfig) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Loading configuration...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6 max-h-[85vh] overflow-y-auto sticky top-0">
      <h3 className="text-xl font-semibold text-gray-900 pb-3 border-b sticky top-0 bg-white z-10">
        Tag Image
      </h3>

      {/* AI Insights Panel */}
      {aiSuggestions && aiSuggestions.reasoning && (
        <div className={`rounded-lg p-4 border-2 ${
          aiSuggestions.confidence === 'high' ? 'bg-blue-50 border-blue-200' :
          aiSuggestions.confidence === 'medium' ? 'bg-yellow-50 border-yellow-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg">✨</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">AI Analysis</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  aiSuggestions.confidence === 'high' ? 'bg-blue-200 text-blue-800' :
                  aiSuggestions.confidence === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-gray-200 text-gray-800'
                }`}>
                  {aiSuggestions.confidence} confidence
                </span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">
                {aiSuggestions.reasoning}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Form Sections */}
      {vocabConfig.structure.categories.map((category) => (
        <div key={category.key}>
          {/* Multi-select categories (checkboxes) */}
          {(category.storage_type === 'array' || category.storage_type === 'jsonb_array') && (
            <>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                {category.label} ({(currentTags[category.key] as string[])?.length || 0})
                {isLoadingAI && <span className="ml-2 text-xs text-gray-500">🤖 Analyzing...</span>}
              </label>
              {category.description && (
                <p className="text-xs text-gray-600 mb-2">{category.description}</p>
              )}
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {(vocabulary[category.key] || []).map((tagValue: string) => {
                  const currentValues = (currentTags[category.key] || []) as string[]
                  const aiSuggestedValues = (aiSuggestions?.[category.key] || []) as string[]
                  const isSelected = currentValues.includes(tagValue)
                  const wasAiSuggested = aiSuggestedValues.includes(tagValue)

                  return (
                    <TagCheckbox
                      key={tagValue}
                      label={tagValue}
                      checked={isSelected}
                      onChange={() => handleTagToggle(category.key, tagValue)}
                      aiSuggested={wasAiSuggested}
                    />
                  )
                })}
              </div>
              <button
                onClick={() => onOpenAddTagModal(category.key)}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                + Add custom {category.label.toLowerCase()}
              </button>
            </>
          )}

          {/* Text field categories (textarea) */}
          {category.storage_type === 'text' && (
            <>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                {category.label} {!category.label.includes('Optional') && '(Optional)'}
              </label>
              {category.description && (
                <p className="text-xs text-gray-600 mb-2">{category.description}</p>
              )}
              <textarea
                value={(currentTags[category.key] || '') as string}
                onChange={(e) => handleTextChange(category.key, e.target.value)}
                placeholder={category.placeholder || `Enter ${category.label.toLowerCase()}...`}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
              />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// Add Tag Modal Component
interface AddTagModalProps {
  category: string
  categoryLabel: string
  newTagValue: string
  similarTags: string[]
  isAdding: boolean
  error: string | null
  onInputChange: (value: string) => void
  onAdd: () => void
  onUseSimilar: (tag: string) => void
  onClose: () => void
}

function AddTagModal({
  categoryLabel,
  newTagValue,
  similarTags,
  isAdding,
  error,
  onInputChange,
  onAdd,
  onUseSimilar,
  onClose
}: AddTagModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagValue.trim() && !isAdding) {
      onAdd()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Add Custom {categoryLabel}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isAdding}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newTagValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`e.g., "${categoryLabel.toLowerCase()}"`}
              disabled={isAdding}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              Tag will be normalized to lowercase
            </p>
          </div>

          {/* Similar Tags Warning */}
          {similarTags.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Similar tags found:
              </p>
              <div className="flex flex-wrap gap-2">
                {similarTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onUseSimilar(tag)}
                    disabled={isAdding}
                    className="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-yellow-700">
                Click a tag to use it instead
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={isAdding}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            disabled={!newTagValue.trim() || isAdding}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAdding ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Adding...
              </>
            ) : (
              'Add Tag'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
