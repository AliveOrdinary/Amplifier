'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'
import Image from 'next/image'
import ImageDetailModal from './Gallery/ImageDetailModal'
import EditImageModal from './Gallery/EditImageModal'
import BulkEditModal from './Gallery/BulkEditModal'
import { getDatabaseCategory } from './Gallery/galleryHelpers'

interface ReferenceImage {
  id: string
  storage_path: string
  thumbnail_path: string
  original_filename: string
  notes: string | null
  status: string
  tagged_at: string
  updated_at: string
  ai_suggested_tags: any
  ai_confidence_score: number | null
  ai_reasoning: string | null
  // Dynamic category fields from vocabulary config
  [key: string]: any
}

interface GalleryClientProps {
  images: ReferenceImage[]
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

export default function GalleryClient({ images: initialImages }: GalleryClientProps) {
  const supabase = createClientComponentClient()
  const [images, setImages] = useState<ReferenceImage[]>(initialImages)
  const [selectedImage, setSelectedImage] = useState<ReferenceImage | null>(null)
  const [editingImage, setEditingImage] = useState<ReferenceImage | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated'>('newest')

  // Bulk selection
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  // Vocabulary config state
  const [vocabConfig, setVocabConfig] = useState<VocabularyConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  // Vocabulary for editing
  const [vocabulary, setVocabulary] = useState<TagVocabulary | null>(null)

  // Dynamic filter state - one filter per category
  const [categoryFilters, setCategoryFilters] = useState<Record<string, string>>({})

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

        // Initialize filters with 'all' for each category
        const initialFilters: Record<string, string> = {}
        config.structure.categories.forEach((cat: VocabularyCategory) => {
          initialFilters[cat.key] = 'all'
        })
        setCategoryFilters(initialFilters)
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
        // Fetch all active tags, sorted by category and sort_order
        const { data, error } = await supabase
          .from('tag_vocabulary')
          .select('category, tag_value, sort_order')
          .eq('is_active', true)
          .order('category', { ascending: true })
          .order('sort_order', { ascending: true })

        if (error) throw error

        if (!data) {
          throw new Error('No vocabulary data returned')
        }

        // Create a mapping from database category to config category key
        const dbCategoryToConfigKey: Record<string, string> = {}
        vocabConfig.structure.categories.forEach(category => {
          const dbCategory = getDatabaseCategory(category.storage_path, category.key)
          dbCategoryToConfigKey[dbCategory] = category.key
        })

        // Group tags by config category key (not database category)
        const groupedVocabulary = data.reduce((acc, row: TagVocabularyRow) => {
          const dbCategory = row.category
          const configKey = dbCategoryToConfigKey[dbCategory]
          
          if (!configKey) {
            console.warn(`⚠️ No config mapping found for database category: ${dbCategory}`)
            return acc
          }
          
          if (!acc[configKey]) {
            acc[configKey] = []
          }
          acc[configKey].push(row.tag_value)
          return acc
        }, {} as TagVocabulary)

        setVocabulary(groupedVocabulary)
      } catch (error) {
        console.error('❌ Error loading vocabulary:', error)
      }
    }

    loadVocabulary()
  }, [vocabConfig])

  // Helper function to get value from image based on storage_path
  const getImageValue = (image: ReferenceImage, storagePath: string): any => {
    if (storagePath.includes('.')) {
      // Nested path like "tags.style"
      const parts = storagePath.split('.')
      let value: any = image
      for (const part of parts) {
        value = value?.[part]
      }
      return value
    } else {
      // Direct path like "industries"
      return image[storagePath]
    }
  }

  // Extract unique values for each category filter
  const categoryFilterOptions = useMemo(() => {
    if (!vocabConfig) return {}

    const options: Record<string, string[]> = {}

    vocabConfig.structure.categories.forEach(category => {
      const values = new Set<string>()
      
      images.forEach(img => {
        const value = getImageValue(img, category.storage_path)
        
        if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
          // For array types, add each item
          if (Array.isArray(value)) {
            value.forEach(v => values.add(v))
          }
        } else if (category.storage_type === 'text') {
          // For text types, add the single value
          if (value) {
            values.add(value)
          }
        }
      })

      options[category.key] = Array.from(values).sort()
    })

    return options
  }, [images, vocabConfig])

  // Filter and sort images
  const filteredImages = useMemo(() => {
    if (!vocabConfig) return images

    let filtered = images.filter(img => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        img.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        false

      // Dynamic category filters
      const matchesAllFilters = vocabConfig.structure.categories.every(category => {
        const filterValue = categoryFilters[category.key]
        if (filterValue === 'all') return true

        const imageValue = getImageValue(img, category.storage_path)

        if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
          // For array types, check if the filter value is in the array
          return Array.isArray(imageValue) && imageValue.includes(filterValue)
        } else if (category.storage_type === 'text') {
          // For text types, check exact match
          return imageValue === filterValue
        }

        return false
      })

      return matchesSearch && matchesAllFilters
    })

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.tagged_at).getTime() - new Date(a.tagged_at).getTime()
      } else if (sortBy === 'oldest') {
        return new Date(a.tagged_at).getTime() - new Date(b.tagged_at).getTime()
      } else { // updated
        return new Date(b.updated_at || b.tagged_at).getTime() - new Date(a.updated_at || a.tagged_at).getTime()
      }
    })

    return filtered
  }, [images, searchQuery, categoryFilters, sortBy, vocabConfig])

  // Handle image update after edit
  const handleImageUpdate = (updatedImage: ReferenceImage) => {
    setImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img))
    setEditingImage(null)
    setSelectedImage(null)
  }

  // Handle bulk update
  const handleBulkUpdate = (updatedImages: ReferenceImage[]) => {
    const updateMap = new Map(updatedImages.map(img => [img.id, img]))
    setImages(prev => prev.map(img => updateMap.get(img.id) || img))
    setSelectedImageIds(new Set())
    setShowBulkEdit(false)
  }

  // Toggle selection
  const toggleSelection = (imageId: string) => {
    setSelectedImageIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(imageId)) {
        newSet.delete(imageId)
      } else {
        newSet.add(imageId)
      }
      return newSet
    })
  }

  // Select all visible
  const selectAll = () => {
    setSelectedImageIds(new Set(filteredImages.map(img => img.id)))
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedImageIds(new Set())
  }

  // Show loading state while config is loading
  if (configLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
        <div className="text-4xl mb-4">⏳</div>
        <h3 className="text-xl font-semibold text-white mb-2">Loading gallery...</h3>
        <p className="text-gray-300">Fetching vocabulary configuration</p>
      </div>
    )
  }

  if (configError) {
    return (
      <div className="bg-gray-800 rounded-lg p-12 text-center border border-red-700">
        <div className="text-4xl mb-4">❌</div>
        <h3 className="text-xl font-semibold text-red-300 mb-2">Configuration Error</h3>
        <p className="text-red-400">{configError}</p>
      </div>
    )
  }

  if (!vocabConfig) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Filters and Controls */}
      <div className="bg-gray-800 rounded-xl p-8 shadow-xl border border-gray-700">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Filter Gallery</h2>
          <p className="text-sm text-gray-300">Search and filter your reference images</p>
        </div>

        {/* Search and Sort Row */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="🔍 Search by filename or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder-gray-500"
            />
          </div>
          <div className="w-56">
            <label className="block text-sm font-semibold text-gray-300 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-4 py-3 border-2 border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-colors"
            >
              <option value="newest">📅 Newest First</option>
              <option value="oldest">📅 Oldest First</option>
              <option value="updated">🔄 Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Dynamic Filter Row */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-3">Filter by Categories</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vocabConfig.structure.categories.map(category => (
              <div key={category.key}>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">
                  {category.label}
                </label>
                <select
                  value={categoryFilters[category.key] || 'all'}
                  onChange={(e) => setCategoryFilters(prev => ({
                    ...prev,
                    [category.key]: e.target.value
                  }))}
                  className="w-full px-4 py-3 border-2 border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold transition-colors hover:border-gray-500 cursor-pointer"
                >
                  <option value="all" className="font-semibold">
                    ✨ All {category.label} ({images.length})
                  </option>
                  {(categoryFilterOptions[category.key] || []).map(value => {
                    const count = images.filter(img => {
                      const imgValue = getImageValue(img, category.storage_path)
                      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
                        return Array.isArray(imgValue) && imgValue.includes(value)
                      } else {
                        return imgValue === value
                      }
                    }).length
                    return (
                      <option key={value} value={value} className="font-medium">
                        {value} ({count} images)
                      </option>
                    )
                  })}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Results count and bulk actions */}
        <div className="mt-6 pt-6 border-t-2 border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              Showing {filteredImages.length} of {images.length} images
            </span>
            {selectedImageIds.size > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-600 text-white border border-blue-500">
                {selectedImageIds.size} selected
              </span>
            )}
          </div>

          {selectedImageIds.size === 0 ? (
            <button
              onClick={selectAll}
              className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
            >
              Select All
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={clearSelection}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg font-semibold transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={() => setShowBulkEdit(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md transition-all font-semibold text-sm"
              >
                ✏️ Edit Selected ({selectedImageIds.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image Grid */}
      {filteredImages.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-16 text-center border-2 border-dashed border-gray-600 shadow-sm">
          <div className="text-7xl mb-6">🔍</div>
          <h3 className="text-2xl font-bold text-white mb-3">No images found</h3>
          <p className="text-gray-300 text-lg mb-6">Try adjusting your filters or search query</p>
          <button
            onClick={() => {
              setSearchQuery('')
              setCategoryFilters({})
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md transition-all font-semibold"
          >
            🔄 Clear All Filters
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white">
              {filteredImages.length === images.length ? 'All Images' : 'Filtered Results'}
            </h3>
            <p className="text-gray-300 mt-1">
              {filteredImages.length === images.length 
                ? `Viewing all ${images.length} images in your collection`
                : `Found ${filteredImages.length} images matching your criteria`}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredImages.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                vocabConfig={vocabConfig}
                isSelected={selectedImageIds.has(image.id)}
                onToggleSelect={() => toggleSelection(image.id)}
                onClick={() => setSelectedImage(image)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImage && !editingImage && vocabConfig && (
        <ImageDetailModal
          image={selectedImage}
          vocabConfig={vocabConfig}
          onClose={() => setSelectedImage(null)}
          onEdit={() => {
            setEditingImage(selectedImage)
          }}
        />
      )}

      {/* Edit Image Modal */}
      {editingImage && vocabulary && vocabConfig && (
        <EditImageModal
          image={editingImage}
          vocabulary={vocabulary}
          vocabConfig={vocabConfig}
          onClose={() => {
            setEditingImage(null)
            setSelectedImage(null)
          }}
          onSave={handleImageUpdate}
          supabase={supabase}
        />
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && vocabulary && vocabConfig && (
        <BulkEditModal
          images={images.filter(img => selectedImageIds.has(img.id))}
          vocabulary={vocabulary}
          vocabConfig={vocabConfig}
          onClose={() => setShowBulkEdit(false)}
          onSave={handleBulkUpdate}
          supabase={supabase}
        />
      )}
    </div>
  )
}

// Image Card Component
interface ImageCardProps {
  image: ReferenceImage
  vocabConfig: VocabularyConfig
  isSelected: boolean
  onToggleSelect: () => void
  onClick: () => void
}

function ImageCard({ image, vocabConfig, isSelected, onToggleSelect, onClick }: ImageCardProps) {
  // Helper function to get value from image based on storage_path
  const getImageValue = (storagePath: string): any => {
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

  // Collect all tags from all categories dynamically
  const allTags: string[] = []
  vocabConfig.structure.categories.forEach(category => {
    const value = getImageValue(category.storage_path)
    if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
      if (Array.isArray(value)) {
        allTags.push(...value)
      }
    } else if (category.storage_type === 'text' && value) {
      allTags.push(value)
    }
  })

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden shadow-xl border border-gray-700 hover:shadow-2xl transition-all duration-200 group relative">
      {/* Selection Checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          className="w-6 h-6 rounded-md border-2 border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm bg-gray-900"
        />
      </div>

      {/* Thumbnail */}
      <div
        onClick={onClick}
        className="aspect-square bg-gray-900 overflow-hidden relative cursor-pointer"
      >
        <Image
          src={image.thumbnail_path || image.storage_path}
          alt={image.original_filename}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover group-hover:scale-110 transition-transform duration-300"
        />

        {/* Hover Overlay - Improved Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4">
          <div className="text-center">
            {/* Main Action */}
            <div className="mb-4 pb-4 border-b border-white/30">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
                <span className="text-gray-900 font-bold text-sm">👁️ Click to View Details</span>
              </div>
            </div>
            
            {/* Tags Preview */}
            {allTags.length > 0 && (
              <div className="space-y-2">
                <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">Tags Preview</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                  {allTags.slice(0, 4).map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 bg-white/90 backdrop-blur-sm text-gray-900 rounded-full text-xs font-semibold shadow-md">
                      {tag}
                    </span>
                  ))}
                  {allTags.length > 4 && (
                    <span className="px-3 py-1 bg-blue-500/90 backdrop-blur-sm text-white rounded-full text-xs font-bold shadow-md">
                      +{allTags.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 bg-gradient-to-b from-gray-800 to-gray-900">
        <p className="text-sm font-semibold text-white truncate mb-1" title={image.original_filename}>
          {image.original_filename}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            📅 {new Date(image.tagged_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </span>
          {allTags.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white border border-blue-500">
              {allTags.length} tags
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
