'use client'

import { useState, useEffect } from 'react'
import TagCheckbox from './TagCheckbox'
import ImagePreview from './ImagePreview'

// All hooks
import {
  useVocabularyConfig,
  useVocabulary,
  useImageUpload,
  useImageNavigation,
  useImageTags,
  useAISuggestions,
  useDuplicateDetection,
  useCustomTagModal,
  useImageSaver
} from '@/hooks/useTagger'

// UI components
import DuplicateDetectionModal from './ImageTagger/DuplicateDetectionModal'
import ErrorState from './ImageTagger/ErrorState'
import Toast from './ImageTagger/Toast'
import AddTagModal from './ImageTagger/AddTagModal'

interface ImageTags {
  [categoryKey: string]: string[] | string
}

interface UploadedImage {
  id: string
  file: File
  previewUrl: string
  filename: string
  status: 'pending' | 'tagged' | 'skipped'
  fileHash?: string
  fileSize?: number
  perceptualHash?: string
}

export default function ImageTaggerClient() {

  // ====== PHASE 2: Core hooks ======
  const {
    config: vocabConfig,
    isLoading: configLoading,
    error: configError
  } = useVocabularyConfig()

  const {
    vocabulary,
    isLoading: isLoadingVocabulary,
    error: vocabularyError
  } = useVocabulary(vocabConfig)

  const imageUpload = useImageUpload()
  const uploadedImages = imageUpload.images

  const navigation = useImageNavigation()
  const { currentIndex, isTaggingMode } = navigation

  const tags = useImageTags()

  // ====== PHASE 3: Advanced hooks ======
  const aiSuggestions = useAISuggestions({
    vocabulary,
    vocabConfig,
    uploadedImages,
    currentIndex,
    isTaggingMode,
    tagsHook: tags
  })

  const duplicateDetection = useDuplicateDetection({
    imageUploadHook: imageUpload
  })

  const currentImage = uploadedImages[currentIndex]
  const customTagModal = useCustomTagModal({
    vocabulary,
    vocabConfig,
    tagsHook: tags,
    currentImageId: currentImage?.id
  })

  const imageSaver = useImageSaver({
    vocabConfig,
    imageUploadHook: imageUpload,
    uploadedImages,
    aiSuggestionsHook: aiSuggestions
  })

  // ====== LOCAL STATE ======
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'skipped' | 'tagged'>('all')
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  // ====== COMPUTED VALUES ======
  const currentImageData = currentImage ? tags.getTagsForImage(currentImage.id, vocabConfig) : {}

  // Filter images based on active filter
  const filteredImages = uploadedImages.filter(img => {
    if (activeFilter === 'all') return true
    return img.status === activeFilter
  })

  // Get current image from filtered list
  const filteredCurrentImage = filteredImages[currentIndex]

  // Progress calculation
  const taggedCount = uploadedImages.filter(img => img.status === 'tagged' || img.status === 'skipped').length
  const totalImages = uploadedImages.length
  const progressPercentage = totalImages > 0 ? (taggedCount / totalImages) * 100 : 0

  // ====== HANDLERS ======

  // File upload
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    await duplicateDetection.checkFiles(fileArray)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    await handleFilesSelected(files)
  }

  // Start tagging mode
  const handleStartTagging = () => {
    navigation.setIsTaggingMode(true)
    navigation.setCurrentIndex(0)
  }

  // Navigation
  const handlePrevious = () => {
    const newIndex = Math.max(0, currentIndex - 1)
    navigation.setCurrentIndex(newIndex)
  }

  const handleNext = () => {
    const newIndex = Math.min(filteredImages.length - 1, currentIndex + 1)
    navigation.setCurrentIndex(newIndex)
  }

  const handleSkip = () => {
    if (!currentImage) return
    imageUpload.updateImageStatus(currentImage.id, 'skipped')

    // Move to next untagged image
    const nextUntaggedIndex = uploadedImages.findIndex((img, idx) =>
      idx > currentIndex && (img.status === 'pending' || img.status === 'skipped')
    )

    if (nextUntaggedIndex !== -1) {
      navigation.setCurrentIndex(nextUntaggedIndex)
    } else {
      handleNext()
    }
  }

  // Save and move to next
  const handleSaveAndNext = async () => {
    await handleSaveImage()

    // Find next untagged image
    const nextUntaggedIndex = uploadedImages.findIndex((img, idx) =>
      idx > currentIndex && img.status === 'pending'
    )

    if (nextUntaggedIndex !== -1) {
      navigation.setCurrentIndex(nextUntaggedIndex)
    } else {
      // All done - stay on current or go to next
      const nextIndex = Math.min(uploadedImages.length - 1, currentIndex + 1)
      navigation.setCurrentIndex(nextIndex)
    }
  }

  // Save current image
  const handleSaveImage = async () => {
    if (!currentImage) return

    const currentTags = tags.getTagsForImage(currentImage.id, vocabConfig)
    await imageSaver.saveImage(currentImage, currentTags)
  }

  // Tag changes
  const handleTagChange = (categoryKey: string, tagValue: string, isChecked: boolean) => {
    if (!currentImage) return

    const currentTags = tags.getTagsForImage(currentImage.id, vocabConfig)
    const currentCategoryTags = (currentTags[categoryKey] as string[]) || []

    if (isChecked) {
      // Add tag
      tags.updateTags(currentImage.id, {
        [categoryKey]: [...currentCategoryTags, tagValue]
      })
    } else {
      // Remove tag
      tags.updateTags(currentImage.id, {
        [categoryKey]: currentCategoryTags.filter(t => t !== tagValue)
      })
    }
  }

  // Notes change
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentImage || !vocabConfig) return

    // Find the notes category
    const notesCategory = vocabConfig.structure.categories.find(cat => cat.storage_type === 'text')
    if (!notesCategory) return

    tags.updateTags(currentImage.id, {
      [notesCategory.key]: e.target.value
    })
  }

  // Back to upload mode
  const handleBackToUpload = () => {
    navigation.setIsTaggingMode(false)
  }

  // Toast helpers
  const showToastMessage = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  // ====== EFFECTS ======

  // Show save success/error toasts
  useEffect(() => {
    if (imageSaver.saveSuccess) {
      showToastMessage('Image saved successfully!', 'success')
    }
  }, [imageSaver.saveSuccess])

  useEffect(() => {
    if (imageSaver.saveError) {
      showToastMessage(imageSaver.saveError, 'error')
    }
  }, [imageSaver.saveError])

  // ====== RENDER ======

  // Loading state
  if (configLoading || isLoadingVocabulary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <p className="text-gray-400">Loading vocabulary...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (configError || vocabularyError) {
    return (
      <ErrorState
        title="Configuration Error"
        message={configError || vocabularyError || 'Failed to load vocabulary configuration'}
      />
    )
  }

  // No config
  if (!vocabConfig) {
    return (
      <ErrorState
        title="No Active Configuration"
        message="No active vocabulary configuration found. Please activate a configuration in the vocabulary settings."
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Duplicate Detection Modal */}
      {duplicateDetection.duplicateData && (
        <DuplicateDetectionModal
          file={duplicateDetection.duplicateData.file}
          fileHash={duplicateDetection.duplicateData.fileHash}
          fileSize={duplicateDetection.duplicateData.fileSize}
          perceptualHash={duplicateDetection.duplicateData.perceptualHash}
          existingImage={duplicateDetection.duplicateData.existingImage}
          matchType={duplicateDetection.duplicateData.matchType}
          confidence={duplicateDetection.duplicateData.confidence}
          message={duplicateDetection.duplicateData.message}
          onSkip={duplicateDetection.skipDuplicate}
          onKeep={duplicateDetection.keepDuplicate}
          onViewExisting={duplicateDetection.viewExisting}
        />
      )}

      {/* Custom Tag Modal */}
      {customTagModal.isOpen && (
        <AddTagModal
          category={customTagModal.categoryKey || ''}
          categoryLabel={customTagModal.categoryLabel}
          newTagValue={customTagModal.newTagValue}
          similarTags={customTagModal.similarTags}
          isAdding={customTagModal.isAdding}
          error={customTagModal.error}
          onInputChange={customTagModal.handleInputChange}
          onAdd={customTagModal.addTag}
          onUseSimilar={customTagModal.useSimilarTag}
          onClose={customTagModal.closeModal}
        />
      )}

      {/* Toast Notifications */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setShowToast(false)}
        />
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {!isTaggingMode ? (
          // ====== UPLOAD MODE ======
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Image Tagger</h1>

            {/* Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-gray-500 transition-colors cursor-pointer"
            >
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
                id="file-upload"
                disabled={duplicateDetection.isChecking}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-6xl mb-4">📸</div>
                <p className="text-xl mb-2">
                  {duplicateDetection.isChecking ? 'Checking for duplicates...' : 'Drop images here or click to upload'}
                </p>
                <p className="text-gray-400">
                  Supports JPG, PNG, WEBP
                </p>
              </label>
            </div>

            {/* Uploaded Images Grid */}
            {uploadedImages.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    Uploaded Images ({uploadedImages.length})
                  </h2>
                  <button
                    onClick={handleStartTagging}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    disabled={uploadedImages.length === 0}
                  >
                    Start Tagging →
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {uploadedImages.map((image) => (
                    <div
                      key={image.id}
                      className="bg-gray-800 rounded-lg overflow-hidden shadow-xl hover:shadow-2xl transition-shadow border border-gray-700"
                    >
                      <div className="aspect-square bg-gray-900 overflow-hidden">
                        <img
                          src={image.previewUrl}
                          alt={image.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-gray-300 truncate" title={image.filename}>
                          {image.filename}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            image.status === 'tagged'
                              ? 'bg-green-900/50 text-green-300 border border-green-700'
                              : image.status === 'skipped'
                              ? 'bg-orange-900/50 text-orange-300 border border-orange-700'
                              : 'bg-gray-700 text-gray-400'
                          }`}>
                            {image.status === 'tagged' ? 'Tagged' :
                             image.status === 'skipped' ? 'Skipped' :
                             'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // ====== TAGGING MODE ======
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleBackToUpload}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <span>←</span>
                <span>Back to Upload</span>
              </button>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                  Image {currentIndex + 1} of {filteredImages.length}
                </div>
                <div className="text-sm text-gray-400">
                  Progress: {taggedCount}/{totalImages} ({Math.round(progressPercentage)}%)
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                All ({uploadedImages.length})
              </button>
              <button
                onClick={() => setActiveFilter('pending')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter === 'pending'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Pending ({uploadedImages.filter(img => img.status === 'pending').length})
              </button>
              <button
                onClick={() => setActiveFilter('skipped')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter === 'skipped'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Skipped ({uploadedImages.filter(img => img.status === 'skipped').length})
              </button>
              <button
                onClick={() => setActiveFilter('tagged')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter === 'tagged'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Tagged ({uploadedImages.filter(img => img.status === 'tagged').length})
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Main Content: Image + Tags */}
            {filteredCurrentImage ? (
              <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6">
                {/* Left: Image Preview with navigation */}
                <div>
                  <ImagePreview
                    image={filteredCurrentImage}
                    currentIndex={currentIndex}
                    totalImages={uploadedImages.length}
                    onPrevious={handlePrevious}
                    onNext={handleNext}
                    onSkip={handleSkip}
                    onSaveAndNext={handleSaveAndNext}
                    isSaving={imageSaver.isSaving}
                  />
                </div>

                {/* Right: Tag Form */}
                <div className="bg-gray-800 rounded-lg p-6 overflow-y-auto" style={{ maxHeight: '80vh' }}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Tags</h2>

                    {/* AI Status Messages - Now visible at top */}
                    <div className="flex items-center gap-3">
                      {aiSuggestions.isLoading[filteredCurrentImage.id] && (
                        <div className="flex items-center gap-2 text-sm text-blue-400">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>AI analyzing...</span>
                        </div>
                      )}
                      {aiSuggestions.isPrefetching && (
                        <div className="text-sm text-gray-500">
                          🔄 Prefetching...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tag Categories */}
                  {vocabConfig.structure.categories.map((category) => {
                    if (category.storage_type === 'text') {
                      // Notes field
                      return (
                        <div key={category.key} className="mb-6">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            {category.label}
                          </label>
                          <textarea
                            value={(currentImageData[category.key] as string) || ''}
                            onChange={handleNotesChange}
                            placeholder={category.placeholder}
                            rows={4}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {category.description && (
                            <p className="mt-1 text-xs text-gray-500">{category.description}</p>
                          )}
                        </div>
                      )
                    }

                    // Array categories (checkboxes)
                    const categoryTags = vocabulary[category.key] || []
                    const selectedTags = (currentImageData[category.key] as string[]) || []
                    const aiSuggestion = aiSuggestions.suggestions[filteredCurrentImage.id]
                    const aiSuggestedTags = aiSuggestion ? (aiSuggestion[category.key] as string[]) || [] : []

                    return (
                      <div key={category.key} className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-300">
                            {category.label}
                          </label>
                          <button
                            onClick={() => customTagModal.openModal(category.key)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            + Add Custom
                          </button>
                        </div>

                        {category.description && (
                          <p className="text-xs text-gray-500 mb-3">{category.description}</p>
                        )}

                        <div className="space-y-2">
                          {categoryTags.map((tag) => {
                            const isSelected = selectedTags.includes(tag)
                            const wasAISuggested = aiSuggestedTags.includes(tag)

                            return (
                              <TagCheckbox
                                key={tag}
                                label={tag}
                                checked={isSelected}
                                aiSuggested={wasAISuggested}
                                onChange={(checked) => handleTagChange(category.key, tag, checked)}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-xl text-gray-400">
                  {activeFilter === 'all'
                    ? 'No images to display'
                    : `No ${activeFilter} images`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
