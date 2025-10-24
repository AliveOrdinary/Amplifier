'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

// Helper function to extract database category name from storage_path
function getDatabaseCategory(storagePath: string): string {
  if (storagePath.includes('.')) {
    // For nested paths like "tags.style", the db category is "style"
    return storagePath.split('.')[1]
  } else {
    // For direct paths, convert plural to singular
    // (the database uses singular form: industry, project_type)
    if (storagePath === 'industries') return 'industry'
    if (storagePath === 'project_types') return 'project_type'
    return storagePath
  }
}

// Helper function to update tag usage counts when tags change (dynamic)
async function updateTagUsageForChanges(
  oldTags: Record<string, string[]>,
  newTags: Record<string, string[]>,
  vocabularyConfig: any
) {
  try {
    const now = new Date().toISOString()

    // Fetch vocabulary config to get category mappings
    if (!vocabularyConfig) return

    const categories = vocabularyConfig.structure?.categories || []

    for (const category of categories) {
      const categoryKey = category.key
      const dbCategory = getDatabaseCategory(category.storage_path)

      // For array-type categories only
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        const oldSet = new Set(oldTags[categoryKey] || [])
        const newSet = new Set(newTags[categoryKey] || [])

        // Find added tags (in new but not in old)
        const added = Array.from(newSet).filter(tag => !oldSet.has(tag))

        // Find removed tags (in old but not in new)
        const removed = Array.from(oldSet).filter(tag => !newSet.has(tag))

        // Increment counts for added tags
        for (const tag of added) {
          const { error } = await supabase.rpc('increment_tag_usage', {
            p_category: dbCategory,
            p_tag_value: tag,
            p_last_used_at: now
          })
          if (error) {
            console.error(`⚠️ Error incrementing usage for ${dbCategory}:${tag}:`, error)
          }
        }

        // Decrement counts for removed tags
        for (const tag of removed) {
          const { error } = await supabase.rpc('decrement_tag_usage', {
            p_category: dbCategory,
            p_tag_value: tag
          })
          if (error) {
            console.error(`⚠️ Error decrementing usage for ${dbCategory}:${tag}:`, error)
          }
        }
      }
    }

    console.log('✅ Tag usage counts updated')
  } catch (error) {
    console.error('⚠️ Error updating tag usage counts:', error)
  }
}

export default function GalleryClient({ images: initialImages }: GalleryClientProps) {
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
          const dbCategory = getDatabaseCategory(category.storage_path)
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

        console.log('✅ Vocabulary loaded:', Object.keys(groupedVocabulary).length, 'categories')
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
      <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
        <div className="text-4xl mb-4">⏳</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading gallery...</h3>
        <p className="text-gray-600">Fetching vocabulary configuration</p>
      </div>
    )
  }

  if (configError) {
    return (
      <div className="bg-white rounded-lg p-12 text-center border border-red-200">
        <div className="text-4xl mb-4">❌</div>
        <h3 className="text-xl font-semibold text-red-900 mb-2">Configuration Error</h3>
        <p className="text-red-600">{configError}</p>
      </div>
    )
  }

  if (!vocabConfig) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Filters and Controls */}
      <div className="bg-white rounded-xl p-8 shadow-md border border-gray-200">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-50 mb-2">Filter Gallery</h2>
          <p className="text-sm text-gray-600">Search and filter your reference images</p>
        </div>

        {/* Search and Sort Row */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="🔍 Search by filename or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="w-56">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-colors bg-white"
            >
              <option value="newest">📅 Newest First</option>
              <option value="oldest">📅 Oldest First</option>
              <option value="updated">🔄 Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Dynamic Filter Row */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Filter by Categories</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vocabConfig.structure.categories.map(category => (
              <div key={category.key}>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  {category.label}
                </label>
                <select
                  value={categoryFilters[category.key] || 'all'}
                  onChange={(e) => setCategoryFilters(prev => ({
                    ...prev,
                    [category.key]: e.target.value
                  }))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-gray-900 transition-colors bg-white hover:border-gray-400 cursor-pointer"
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
        <div className="mt-6 pt-6 border-t-2 border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">
              Showing {filteredImages.length} of {images.length} images
            </span>
            {selectedImageIds.size > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                {selectedImageIds.size} selected
              </span>
            )}
          </div>

          {selectedImageIds.size === 0 ? (
            <button
              onClick={selectAll}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg font-semibold transition-colors"
            >
              Select All
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={clearSelection}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg font-semibold transition-colors"
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
        <div className="bg-white rounded-xl p-16 text-center border-2 border-dashed border-gray-300 shadow-sm">
          <div className="text-7xl mb-6">🔍</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">No images found</h3>
          <p className="text-gray-600 text-lg mb-6">Try adjusting your filters or search query</p>
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
            <h3 className="text-2xl font-bold text-gray-50">
              {filteredImages.length === images.length ? 'All Images' : 'Filtered Results'}
            </h3>
            <p className="text-gray-600 mt-1">
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
    <div className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-200 hover:shadow-xl transition-all duration-200 group relative">
      {/* Selection Checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          className="w-6 h-6 rounded-md border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm bg-white"
        />
      </div>

      {/* Thumbnail */}
      <div
        onClick={onClick}
        className="aspect-square bg-gray-100 overflow-hidden relative cursor-pointer"
      >
        <img
          src={image.thumbnail_path || image.storage_path}
          alt={image.original_filename}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
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
      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        <p className="text-sm font-semibold text-gray-900 truncate mb-1" title={image.original_filename}>
          {image.original_filename}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            📅 {new Date(image.tagged_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </span>
          {allTags.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              {allTags.length} tags
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Image Detail Modal Component
interface ImageDetailModalProps {
  image: ReferenceImage
  vocabConfig: VocabularyConfig
  onClose: () => void
  onEdit: () => void
}

function ImageDetailModal({ image, vocabConfig, onClose, onEdit }: ImageDetailModalProps) {
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

  // Collect actual tags dynamically
  const actualTags: Record<string, string[]> = {}
  vocabConfig.structure.categories.forEach(category => {
    const value = getImageValue(category.storage_path)
    if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
      actualTags[category.key] = Array.isArray(value) ? value : []
    } else if (category.storage_type === 'text') {
      actualTags[category.key] = value ? [value] : []
    }
  })

  const corrections = useMemo(() => {
    const aiSuggested = image.ai_suggested_tags
    if (!aiSuggested) return null

    // Flatten AI suggestions
    const aiFlat: string[] = []
    Object.keys(aiSuggested).forEach(key => {
      if (key !== 'confidence' && key !== 'reasoning' && key !== 'promptVersion') {
        const val = aiSuggested[key]
        if (Array.isArray(val)) {
          aiFlat.push(...val)
        } else if (typeof val === 'string') {
          aiFlat.push(val)
        }
      }
    })

    // Flatten actual tags
    const actualFlat: string[] = []
    Object.values(actualTags).forEach(arr => {
      actualFlat.push(...arr)
    })

    const added = actualFlat.filter(tag => !aiFlat.includes(tag))
    const removed = aiFlat.filter(tag => !actualFlat.includes(tag))

    return { added, removed, hadSuggestions: aiFlat.length > 0 }
  }, [image.ai_suggested_tags, actualTags])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">Image Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image */}
            <div>
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={image.storage_path}
                  alt={image.original_filename}
                  className="w-full h-auto"
                />
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900">{image.original_filename}</p>
                <p className="text-xs text-gray-500">
                  Tagged: {new Date(image.tagged_at).toLocaleString()}
                </p>
                {image.updated_at && image.updated_at !== image.tagged_at && (
                  <p className="text-xs text-gray-500">
                    Updated: {new Date(image.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Tags and Info */}
            <div className="space-y-6">
              {/* Tags */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>

                <div className="space-y-4">
                  {/* Dynamically render all categories */}
                  {vocabConfig.structure.categories.map((category, catIdx) => {
                    const tags = actualTags[category.key] || []
                    if (tags.length === 0) return null

                    // Color rotation for visual variety
                    const colors = [
                      'bg-gray-100 text-gray-800',
                      'bg-blue-100 text-blue-800',
                      'bg-purple-100 text-purple-800',
                      'bg-green-100 text-green-800',
                      'bg-orange-100 text-orange-800',
                      'bg-pink-100 text-pink-800',
                      'bg-indigo-100 text-indigo-800',
                      'bg-yellow-100 text-yellow-800'
                    ]
                    const colorClass = colors[catIdx % colors.length]

                    return (
                      <div key={category.key}>
                        <p className="text-sm font-medium text-gray-700 mb-2">{category.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag, idx) => (
                            <span key={idx} className={`px-3 py-1 text-sm rounded-full ${colorClass}`}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              {image.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {image.notes}
                  </p>
                </div>
              )}

              {/* AI Analysis */}
              {corrections?.hadSuggestions && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Analysis</h3>

                  {/* Confidence Score */}
                  {image.ai_confidence_score !== null && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">Confidence</span>
                        <span className={`font-medium ${
                          image.ai_confidence_score >= 0.8 ? 'text-green-600' :
                          image.ai_confidence_score >= 0.5 ? 'text-yellow-600' :
                          'text-gray-600'
                        }`}>
                          {image.ai_confidence_score >= 0.8 ? 'High' :
                           image.ai_confidence_score >= 0.5 ? 'Medium' : 'Low'}
                          {' '}({Math.round(image.ai_confidence_score * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            image.ai_confidence_score >= 0.8 ? 'bg-green-500' :
                            image.ai_confidence_score >= 0.5 ? 'bg-yellow-500' :
                            'bg-gray-400'
                          }`}
                          style={{ width: `${image.ai_confidence_score * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Reasoning */}
                  {image.ai_reasoning && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 mb-3">
                      <p className="font-medium mb-1">AI Reasoning:</p>
                      <p>{image.ai_reasoning}</p>
                    </div>
                  )}

                  {/* Corrections */}
                  {(corrections.added.length > 0 || corrections.removed.length > 0) && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-900">Designer Corrections:</p>

                      {corrections.added.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-700 mb-1">Added Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {corrections.added.map((tag, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                                + {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {corrections.removed.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-700 mb-1">Removed Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {corrections.removed.map((tag, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                - {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {corrections.added.length === 0 && corrections.removed.length === 0 && (
                        <p className="text-xs text-green-700">✓ All AI suggestions accepted</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => window.open(image.storage_path, '_blank')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  View Full Size
                </button>
                <button
                  onClick={onEdit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Edit Tags
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Edit Image Modal Component
interface EditImageModalProps {
  image: ReferenceImage
  vocabulary: TagVocabulary
  vocabConfig: VocabularyConfig
  onClose: () => void
  onSave: (updatedImage: ReferenceImage) => void
}

function EditImageModal({ image, vocabulary, vocabConfig, onClose, onSave }: EditImageModalProps) {
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

  // Initialize dynamic tag state based on vocabulary config
  const [categoryTags, setCategoryTags] = useState<Record<string, string[] | string>>(() => {
    const initialTags: Record<string, string[] | string> = {}
    vocabConfig.structure.categories.forEach(category => {
      const value = getImageValue(category.storage_path)
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        initialTags[category.key] = Array.isArray(value) ? value : []
      } else if (category.storage_type === 'text') {
        initialTags[category.key] = value || ''
      }
    })
    return initialTags
  })

  const [notes, setNotes] = useState<string>(image.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  const toggleTag = (categoryKey: string, tag: string) => {
    setCategoryTags(prev => {
      const current = prev[categoryKey]
      if (Array.isArray(current)) {
        if (current.includes(tag)) {
          return { ...prev, [categoryKey]: current.filter(t => t !== tag) }
        } else {
          return { ...prev, [categoryKey]: [...current, tag] }
        }
      }
      return prev
    })
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Prepare old tags for usage count updates
      const oldTags: Record<string, string[]> = {}
      vocabConfig.structure.categories.forEach(category => {
        const value = getImageValue(category.storage_path)
        if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
          oldTags[category.key] = Array.isArray(value) ? value : []
        }
      })

      // Prepare new tags for usage count updates
      const newTags: Record<string, string[]> = {}
      vocabConfig.structure.categories.forEach(category => {
        const value = categoryTags[category.key]
        if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
          newTags[category.key] = Array.isArray(value) ? value : []
        }
      })

      // Update tag usage counts
      await updateTagUsageForChanges(oldTags, newTags, vocabConfig)

      // Build update object dynamically
      const updateData: any = {
        notes: notes || null,
        updated_at: new Date().toISOString()
      }

      // Map category tags to database fields
      vocabConfig.structure.categories.forEach(category => {
        const value = categoryTags[category.key]
        const storagePath = category.storage_path

        if (storagePath.includes('.')) {
          // Nested path like "tags.style"
          const parts = storagePath.split('.')
          const topLevel = parts[0]
          const nested = parts[1]

          if (!updateData[topLevel]) {
            updateData[topLevel] = {}
          }
          updateData[topLevel][nested] = value
        } else {
          // Direct path like "industries"
          updateData[storagePath] = value
        }
      })

      const { data, error } = await supabase
        .from('reference_images')
        .update(updateData)
        .eq('id', image.id)
        .select()
        .single()

      if (error) throw error

      onSave(data)
    } catch (error) {
      console.error('Error updating image:', error)
      alert('Failed to update image')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">Edit Image Tags</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image Preview */}
            <div>
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={image.storage_path}
                  alt={image.original_filename}
                  className="w-full h-auto"
                />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900">{image.original_filename}</p>
            </div>

            {/* Tag Selection */}
            <div className="space-y-6">
              {/* Dynamic category sections */}
              {vocabConfig.structure.categories.map((category, catIdx) => {
                const categoryVocab = vocabulary[category.key] || []
                const selectedTags = categoryTags[category.key]
                const selectedCount = Array.isArray(selectedTags) ? selectedTags.length : 0

                // Skip if not array type (we don't support editing text types in this UI)
                if (category.storage_type !== 'array' && category.storage_type !== 'jsonb_array') {
                  return null
                }

                // Color schemes for visual variety
                const colorSchemes = [
                  { bg: 'bg-gray-100', hover: 'hover:bg-gray-200', text: 'text-gray-800', selected: 'bg-gray-800 text-white' },
                  { bg: 'bg-blue-100', hover: 'hover:bg-blue-200', text: 'text-blue-800', selected: 'bg-blue-600 text-white' },
                  { bg: 'bg-purple-100', hover: 'hover:bg-purple-200', text: 'text-purple-800', selected: 'bg-purple-600 text-white' },
                  { bg: 'bg-green-100', hover: 'hover:bg-green-200', text: 'text-green-800', selected: 'bg-green-600 text-white' },
                  { bg: 'bg-orange-100', hover: 'hover:bg-orange-200', text: 'text-orange-800', selected: 'bg-orange-600 text-white' },
                  { bg: 'bg-pink-100', hover: 'hover:bg-pink-200', text: 'text-pink-800', selected: 'bg-pink-600 text-white' },
                  { bg: 'bg-indigo-100', hover: 'hover:bg-indigo-200', text: 'text-indigo-800', selected: 'bg-indigo-600 text-white' },
                  { bg: 'bg-yellow-100', hover: 'hover:bg-yellow-200', text: 'text-yellow-800', selected: 'bg-yellow-600 text-white' }
                ]
                const colors = colorSchemes[catIdx % colorSchemes.length]

                return (
                  <div key={category.key}>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      {category.label} ({selectedCount} selected)
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                      {categoryVocab.map(tag => {
                        const isSelected = Array.isArray(selectedTags) && selectedTags.includes(tag)
                        return (
                          <button
                            key={`edit-${category.key}-${tag}`}
                            onClick={() => toggleTag(category.key, tag)}
                            className={`px-3 py-1 text-sm rounded-full transition-colors ${
                              isSelected
                                ? colors.selected
                                : `${colors.bg} ${colors.text} ${colors.hover}`
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Add any notes about this image..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Bulk Edit Modal Component
interface BulkEditModalProps {
  images: ReferenceImage[]
  vocabulary: TagVocabulary
  vocabConfig: VocabularyConfig
  onClose: () => void
  onSave: (updatedImages: ReferenceImage[]) => void
}

function BulkEditModal({ images, vocabulary, vocabConfig, onClose, onSave }: BulkEditModalProps) {
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [isSaving, setIsSaving] = useState(false)

  // Initialize dynamic tag state - start with empty selections
  const [categoryTags, setCategoryTags] = useState<Record<string, string[]>>(() => {
    const initialTags: Record<string, string[]> = {}
    vocabConfig.structure.categories.forEach(category => {
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        initialTags[category.key] = []
      }
    })
    return initialTags
  })

  const toggleTag = (categoryKey: string, tag: string) => {
    setCategoryTags(prev => {
      const current = prev[categoryKey] || []
      if (current.includes(tag)) {
        return { ...prev, [categoryKey]: current.filter(t => t !== tag) }
      } else {
        return { ...prev, [categoryKey]: [...current, tag] }
      }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const updatedImages: ReferenceImage[] = []

      for (const image of images) {
        // Helper to get current value from image
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

        // Build new tag values dynamically
        const newCategoryValues: Record<string, any> = {}
        
        vocabConfig.structure.categories.forEach(category => {
          if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
            const currentValue = getImageValue(category.storage_path)
            let newValue = Array.isArray(currentValue) ? [...currentValue] : []
            const selectedTags = categoryTags[category.key] || []

            if (mode === 'add') {
              // Add selected tags if not already present
              selectedTags.forEach(tag => {
                if (!newValue.includes(tag)) {
                  newValue.push(tag)
                }
              })
            } else {
              // Remove selected tags
              newValue = newValue.filter(tag => !selectedTags.includes(tag))
            }

            newCategoryValues[category.key] = newValue
          }
        })

        // Prepare old/new tags for usage count updates
        const oldTags: Record<string, string[]> = {}
        const newTags: Record<string, string[]> = {}
        
        vocabConfig.structure.categories.forEach(category => {
          if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
            const currentValue = getImageValue(category.storage_path)
            oldTags[category.key] = Array.isArray(currentValue) ? currentValue : []
            newTags[category.key] = newCategoryValues[category.key]
          }
        })

        // Update tag usage counts
        await updateTagUsageForChanges(oldTags, newTags, vocabConfig)

        // Build update object
        const updateData: any = {
          updated_at: new Date().toISOString()
        }

        vocabConfig.structure.categories.forEach(category => {
          const value = newCategoryValues[category.key]
          if (value === undefined) return

          const storagePath = category.storage_path
          if (storagePath.includes('.')) {
            const parts = storagePath.split('.')
            const topLevel = parts[0]
            const nested = parts[1]
            if (!updateData[topLevel]) {
              updateData[topLevel] = {}
            }
            updateData[topLevel][nested] = value
          } else {
            updateData[storagePath] = value
          }
        })

        const { data, error } = await supabase
          .from('reference_images')
          .update(updateData)
          .eq('id', image.id)
          .select()
          .single()

        if (error) throw error
        updatedImages.push(data)
      }

      onSave(updatedImages)
    } catch (error) {
      console.error('Error bulk updating images:', error)
      alert('Failed to update images')
    } finally {
      setIsSaving(false)
    }
  }

  const hasSelections = Object.values(categoryTags).some(tags => tags.length > 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Bulk Edit {images.length} Images</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('add')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'add'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Add Tags
            </button>
            <button
              onClick={() => setMode('remove')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'remove'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Remove Tags
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600">
            {mode === 'add'
              ? 'Select tags to add to all selected images. Existing tags will be preserved.'
              : 'Select tags to remove from all selected images.'}
          </p>

          {/* Dynamic category sections */}
          {vocabConfig.structure.categories.map((category, catIdx) => {
            const categoryVocab = vocabulary[category.key] || []
            const selectedTags = categoryTags[category.key] || []

            // Skip if not array type
            if (category.storage_type !== 'array' && category.storage_type !== 'jsonb_array') {
              return null
            }

            // Color schemes for visual variety
            const colorSchemes = [
              { bg: 'bg-gray-100', hover: 'hover:bg-gray-200', text: 'text-gray-800', selected: 'bg-gray-800 text-white' },
              { bg: 'bg-blue-100', hover: 'hover:bg-blue-200', text: 'text-blue-800', selected: 'bg-blue-600 text-white' },
              { bg: 'bg-purple-100', hover: 'hover:bg-purple-200', text: 'text-purple-800', selected: 'bg-purple-600 text-white' },
              { bg: 'bg-green-100', hover: 'hover:bg-green-200', text: 'text-green-800', selected: 'bg-green-600 text-white' },
              { bg: 'bg-orange-100', hover: 'hover:bg-orange-200', text: 'text-orange-800', selected: 'bg-orange-600 text-white' },
              { bg: 'bg-pink-100', hover: 'hover:bg-pink-200', text: 'text-pink-800', selected: 'bg-pink-600 text-white' },
              { bg: 'bg-indigo-100', hover: 'hover:bg-indigo-200', text: 'text-indigo-800', selected: 'bg-indigo-600 text-white' },
              { bg: 'bg-yellow-100', hover: 'hover:bg-yellow-200', text: 'text-yellow-800', selected: 'bg-yellow-600 text-white' }
            ]
            const colors = colorSchemes[catIdx % colorSchemes.length]

            return (
              <div key={category.key}>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {category.label} ({selectedTags.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {categoryVocab.map(tag => {
                    const isSelected = selectedTags.includes(tag)
                    return (
                      <button
                        key={`bulk-${category.key}-${tag}`}
                        onClick={() => toggleTag(category.key, tag)}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                          isSelected
                            ? colors.selected
                            : `${colors.bg} ${colors.text} ${colors.hover}`
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasSelections}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                mode === 'add'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isSaving
                ? 'Saving...'
                : mode === 'add'
                  ? `Add to ${images.length} Images`
                  : `Remove from ${images.length} Images`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
