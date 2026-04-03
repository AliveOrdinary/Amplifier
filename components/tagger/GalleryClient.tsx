'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import Image from 'next/image'
import ImageDetailModal from './Gallery/ImageDetailModal'
import EditImageModal from './Gallery/EditImageModal'
import BulkEditModal from './Gallery/BulkEditModal'
import { getImageValue } from '@/lib/vocabulary-utils'
import type { TaggerReferenceImage, VocabularyCategory, VocabularyConfig, TagVocabulary, TagVocabularyRow } from '@/lib/types/tagger'

interface GalleryClientProps {
  images: TaggerReferenceImage[]
}

export default function GalleryClient({ images: initialImages }: GalleryClientProps) {
  const supabase = createClientComponentClient()
  const [images, setImages] = useState<TaggerReferenceImage[]>(initialImages)
  const [selectedImage, setSelectedImage] = useState<TaggerReferenceImage | null>(null)
  const [editingImage, setEditingImage] = useState<TaggerReferenceImage | null>(null)
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
        console.error('Error loading vocabulary config:', error)
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
        const client = createClientComponentClient()
        const { data, error } = await client
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
          dbCategoryToConfigKey[category.key] = category.key
        })

        // Group tags by config category key (not database category)
        const groupedVocabulary = data.reduce((acc, row: TagVocabularyRow) => {
          const dbCategory = row.category
          const configKey = dbCategoryToConfigKey[dbCategory]
          
          if (!configKey) {
            console.warn(`No config mapping found for database category: ${dbCategory}`)
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
        console.error('Error loading vocabulary:', error)
      }
    }

    loadVocabulary()
  }, [vocabConfig])

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

    const filtered = images.filter(img => {
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
  const handleImageUpdate = (updatedImage: TaggerReferenceImage) => {
    setImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img))
    setEditingImage(null)
    setSelectedImage(null)
  }

  // Handle bulk update
  const handleBulkUpdate = (updatedImages: TaggerReferenceImage[]) => {
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
      <div className="bg-gray-900 rounded-lg p-12 text-center border border-gray-800">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
        <p className="text-sm text-gray-400">Loading gallery...</p>
      </div>
    )
  }

  if (configError) {
    return (
      <div className="bg-gray-900 rounded-lg p-12 text-center border border-red-900">
        <h3 className="text-base font-medium text-red-300 mb-1">Configuration Error</h3>
        <p className="text-sm text-red-400">{configError}</p>
      </div>
    )
  }

  if (!vocabConfig) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Filters and Controls */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        {/* Search and Sort Row */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by filename or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-950 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder-gray-500"
            />
          </div>
          <div className="w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'updated')}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-950 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Dynamic Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
          {vocabConfig.structure.categories.map(category => (
            <div key={category.key}>
              <label className="block text-xs text-gray-500 mb-1">
                {category.label}
              </label>
              <select
                value={categoryFilters[category.key] || 'all'}
                onChange={(e) => setCategoryFilters(prev => ({
                  ...prev,
                  [category.key]: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-950 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer"
              >
                <option value="all">
                  All {category.label}
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
                    <option key={value} value={value}>
                      {value} ({count})
                    </option>
                  )
                })}
              </select>
            </div>
          ))}
        </div>

        {/* Results count and bulk actions */}
        <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {filteredImages.length} of {images.length} images
            </span>
            {selectedImageIds.size > 0 && (
              <span className="text-sm text-blue-400">
                {selectedImageIds.size} selected
              </span>
            )}
          </div>

          {selectedImageIds.size === 0 ? (
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              Select All
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setShowBulkEdit(true)}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
              >
                Edit Selected ({selectedImageIds.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image Grid */}
      {filteredImages.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-12 text-center border border-dashed border-gray-800">
          <p className="text-base text-white mb-2">No images found</p>
          <p className="text-sm text-gray-500 mb-4">Try adjusting your filters or search query</p>
          <button
            onClick={() => {
              setSearchQuery('')
              setCategoryFilters({})
            }}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
  image: TaggerReferenceImage
  vocabConfig: VocabularyConfig
  isSelected: boolean
  onToggleSelect: () => void
  onClick: () => void
}

function ImageCard({ image, vocabConfig, isSelected, onToggleSelect, onClick }: ImageCardProps) {
  // Collect all tags from all categories dynamically
  const allTags: string[] = []
  vocabConfig.structure.categories.forEach(category => {
    const value = getImageValue(image, category.storage_path)
    if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
      if (Array.isArray(value)) {
        allTags.push(...value)
      }
    } else if (category.storage_type === 'text' && value) {
      allTags.push(value)
    }
  })

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 group relative">
      {/* Selection Checkbox */}
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          className="w-5 h-5 rounded border border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer bg-gray-900"
        />
      </div>

      {/* Thumbnail */}
      <div
        onClick={onClick}
        className="aspect-square bg-gray-950 overflow-hidden relative cursor-pointer"
      >
        <Image
          src={image.thumbnail_path || image.storage_path}
          alt={image.original_filename}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allTags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-black/70 text-white rounded text-xs">
                  {tag}
                </span>
              ))}
              {allTags.length > 3 && (
                <span className="px-2 py-0.5 bg-black/70 text-gray-300 rounded text-xs">
                  +{allTags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm text-white truncate mb-1" title={image.original_filename}>
          {image.original_filename}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {new Date(image.tagged_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          {allTags.length > 0 && (
            <span className="text-xs text-gray-500">
              {allTags.length} tags
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
