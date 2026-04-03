'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
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
import AddTagModal from './ImageTagger/AddTagModal'
import { useToast } from '@/components/ui'

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
  const [showFullPalette, setShowFullPalette] = useState(false)
  const toast = useToast()

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

  // Flatten all selected tags with category info for the summary view
  const selectedTagsSummary = useMemo(() => {
    if (!vocabConfig || !filteredCurrentImage) return []
    const aiSuggestion = aiSuggestions.suggestions[filteredCurrentImage.id]

    return vocabConfig.structure.categories
      .filter(cat => cat.storage_type !== 'text')
      .flatMap(category => {
        const selected = (currentImageData[category.key] as string[]) || []
        const aiTags = aiSuggestion ? (aiSuggestion[category.key] as string[]) || [] : []
        return selected.map(tag => ({
          tag,
          categoryKey: category.key,
          categoryLabel: category.label,
          isAISuggested: aiTags.includes(tag),
        }))
      })
  }, [vocabConfig, filteredCurrentImage, currentImageData, aiSuggestions.suggestions])

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
  const handlePrevious = useCallback(() => {
    const newIndex = Math.max(0, currentIndex - 1)
    navigation.setCurrentIndex(newIndex)
  }, [currentIndex, navigation])

  const handleNext = useCallback(() => {
    const newIndex = Math.min(filteredImages.length - 1, currentIndex + 1)
    navigation.setCurrentIndex(newIndex)
  }, [currentIndex, filteredImages.length, navigation])

  const handleSkip = useCallback(() => {
    if (!currentImage) return
    imageUpload.updateImageStatus(currentImage.id, 'skipped')

    // Move to next untagged image
    const nextUntaggedIndex = uploadedImages.findIndex((img, idx) =>
      idx > currentIndex && (img.status === 'pending' || img.status === 'skipped')
    )

    if (nextUntaggedIndex !== -1) {
      navigation.setCurrentIndex(nextUntaggedIndex)
    } else {
      const newIndex = Math.min(filteredImages.length - 1, currentIndex + 1)
      navigation.setCurrentIndex(newIndex)
    }
  }, [currentImage, currentIndex, uploadedImages, filteredImages.length, imageUpload, navigation])

  // Save and move to next
  const handleSaveAndNext = useCallback(async () => {
    if (!currentImage) return

    const currentTags = tags.getTagsForImage(currentImage.id, vocabConfig)
    await imageSaver.saveImage(currentImage, currentTags)

    // Find next untagged image
    const nextUntaggedIndex = uploadedImages.findIndex((img, idx) =>
      idx > currentIndex && img.status === 'pending'
    )

    if (nextUntaggedIndex !== -1) {
      navigation.setCurrentIndex(nextUntaggedIndex)
    } else {
      const nextIndex = Math.min(uploadedImages.length - 1, currentIndex + 1)
      navigation.setCurrentIndex(nextIndex)
    }

    setShowFullPalette(false)
  }, [currentImage, currentIndex, uploadedImages, tags, vocabConfig, imageSaver, navigation])

  // Tag changes
  const handleTagChange = (categoryKey: string, tagValue: string, isChecked: boolean) => {
    if (!currentImage) return

    const currentTags = tags.getTagsForImage(currentImage.id, vocabConfig)
    const currentCategoryTags = (currentTags[categoryKey] as string[]) || []

    if (isChecked) {
      tags.updateTags(currentImage.id, {
        [categoryKey]: [...currentCategoryTags, tagValue]
      })
    } else {
      tags.updateTags(currentImage.id, {
        [categoryKey]: currentCategoryTags.filter(t => t !== tagValue)
      })
    }
  }

  // Remove a tag from the summary view
  const handleRemoveTag = (categoryKey: string, tagValue: string) => {
    handleTagChange(categoryKey, tagValue, false)
  }

  // Notes change
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentImage || !vocabConfig) return

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

  // ====== EFFECTS ======

  // Keyboard shortcuts for tagging mode
  useEffect(() => {
    if (!isTaggingMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          handleSaveAndNext()
          break
        case 's':
          e.preventDefault()
          handleSkip()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTaggingMode, handleSaveAndNext, handleSkip, handlePrevious, handleNext])

  // Reset full palette when switching images
  useEffect(() => {
    setShowFullPalette(false)
  }, [filteredCurrentImage?.id])

  // Show save success/error toasts
  useEffect(() => {
    if (imageSaver.saveSuccess) {
      toast.success('Image saved successfully!')
    }
  }, [imageSaver.saveSuccess])

  useEffect(() => {
    if (imageSaver.saveError) {
      toast.error(imageSaver.saveError)
    }
  }, [imageSaver.saveError])

  // ====== RENDER ======

  // Loading state
  if (configLoading || isLoadingVocabulary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-sm text-gray-400">Loading vocabulary...</p>
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

  // Get notes category and value
  const notesCategory = vocabConfig.structure.categories.find(cat => cat.storage_type === 'text')
  const notesValue = notesCategory ? (currentImageData[notesCategory.key] as string) || '' : ''

  return (
    <div className="text-white">
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
                <p className="text-lg mb-2">
                  {duplicateDetection.isChecking ? 'Checking for duplicates...' : 'Drop images here or click to upload'}
                </p>
                <p className="text-sm text-gray-500">
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
                    Start Tagging
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {uploadedImages.map((image) => (
                    <div
                      key={image.id}
                      className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800"
                    >
                      <div className="aspect-square bg-gray-900 overflow-hidden relative">
                        <Image
                          src={image.previewUrl}
                          alt={image.filename}
                          fill
                          className="object-cover"
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
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleBackToUpload}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
              >
                <span>←</span>
                <span>Back to Upload</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Compact filter pills */}
                {(['all', 'pending', 'skipped', 'tagged'] as const).map(filter => {
                  const count = filter === 'all'
                    ? uploadedImages.length
                    : uploadedImages.filter(img => img.status === filter).length
                  return (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${
                        activeFilter === filter
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)} ({count})
                    </button>
                  )
                })}

                <span className="text-xs text-gray-500 ml-2">
                  {currentIndex + 1}/{filteredImages.length}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="w-full bg-gray-800 rounded-full h-1">
                <div
                  className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Main Content: Image + Review Panel */}
            {filteredCurrentImage ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
                {/* Left: Image Preview */}
                <div className="lg:sticky lg:top-16 lg:self-start">
                  <ImagePreview image={filteredCurrentImage} />
                </div>

                {/* Right: Review Panel */}
                <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col max-h-[calc(100vh-140px)]">

                  {/* Primary action + AI status */}
                  <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
                    {aiSuggestions.isLoading[filteredCurrentImage.id] ? (
                      <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-400">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>AI analyzing...</span>
                      </div>
                    ) : filteredCurrentImage.status !== 'tagged' ? (
                      <button
                        onClick={handleSaveAndNext}
                        disabled={imageSaver.isSaving}
                        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          imageSaver.isSaving
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {imageSaver.isSaving ? 'Saving...' : (
                          <span className="flex items-center justify-center gap-2">
                            Accept & Next
                            <kbd className="text-[10px] bg-blue-700 px-1.5 py-0.5 rounded opacity-70">Enter</kbd>
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Tagged
                      </div>
                    )}
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto">

                    {/* Zone A: AI Selections Summary */}
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          {selectedTagsSummary.length} tags selected
                        </span>
                        {aiSuggestions.isPrefetching && (
                          <span className="text-[10px] text-gray-600">Prefetching next...</span>
                        )}
                      </div>

                      {selectedTagsSummary.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedTagsSummary.map(({ tag, categoryKey, categoryLabel, isAISuggested }) => (
                            <button
                              key={`${categoryKey}-${tag}`}
                              onClick={() => handleRemoveTag(categoryKey, tag)}
                              className="group inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-full bg-blue-600 text-white hover:bg-red-600 transition-colors"
                              title={`${categoryLabel} — click to remove`}
                            >
                              <span>{tag}</span>
                              {isAISuggested && <span className="text-[10px] opacity-60">ai</span>}
                              <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity -mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          {aiSuggestions.isLoading[filteredCurrentImage?.id] ? 'Waiting for AI...' : 'No tags selected'}
                        </p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-800" />

                    {/* Zone B: Full Palette (expandable) */}
                    <div className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setShowFullPalette(!showFullPalette)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <span className="text-xs font-medium text-gray-400">
                          {showFullPalette ? 'Hide tag palette' : 'Edit tags by category'}
                        </span>
                        <svg className={`w-4 h-4 text-gray-500 transition-transform ${showFullPalette ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showFullPalette && (
                        <div className="mt-3 space-y-4">
                          {vocabConfig.structure.categories.map((category) => {
                            if (category.storage_type === 'text') return null

                            const categoryTags = vocabulary[category.key] || []
                            const selectedTags = (currentImageData[category.key] as string[]) || []
                            const aiSuggestion = aiSuggestions.suggestions[filteredCurrentImage.id]
                            const aiSuggestedTags = aiSuggestion ? (aiSuggestion[category.key] as string[]) || [] : []

                            return (
                              <div key={category.key}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-300">
                                    {category.label}
                                    {selectedTags.length > 0 && (
                                      <span className="ml-1.5 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                                        {selectedTags.length}
                                      </span>
                                    )}
                                  </span>
                                  <button
                                    onClick={() => customTagModal.openModal(category.key)}
                                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    + Add
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {categoryTags.map((tag) => {
                                    const isSelected = selectedTags.includes(tag)
                                    const wasAISuggested = aiSuggestedTags.includes(tag)
                                    return (
                                      <button
                                        key={tag}
                                        type="button"
                                        onClick={() => handleTagChange(category.key, tag, !isSelected)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                          isSelected
                                            ? 'bg-blue-600 border-blue-500 text-white'
                                            : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                                        }`}
                                      >
                                        {tag}
                                        {wasAISuggested && !isSelected && <span className="text-[9px] opacity-60">ai</span>}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {notesCategory && (
                      <>
                        <div className="border-t border-gray-800" />
                        <div className="px-4 py-3">
                          <label className="block text-xs font-medium text-gray-400 mb-2">Notes</label>
                          <textarea
                            value={notesValue}
                            onChange={handleNotesChange}
                            placeholder={notesCategory.placeholder}
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Bottom nav */}
                  <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-800 flex-shrink-0 bg-gray-900 rounded-b-lg">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className={`px-3 py-1.5 text-xs rounded transition-colors ${
                        currentIndex === 0
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                      title="Previous (Left arrow)"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={handleSkip}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                      title="Skip (S)"
                    >
                      Skip
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={handleNext}
                      disabled={currentIndex === filteredImages.length - 1}
                      className={`px-3 py-1.5 text-xs rounded transition-colors ${
                        currentIndex === filteredImages.length - 1
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                      title="Next (Right arrow)"
                    >
                      Next →
                    </button>
                  </div>
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
