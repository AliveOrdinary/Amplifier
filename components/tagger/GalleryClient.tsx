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
  industries: string[]
  project_types: string[]
  tags: {
    style: string[]
    mood: string[]
    elements: string[]
  }
  notes: string | null
  status: string
  tagged_at: string
  updated_at: string
  ai_suggested_tags: any
  ai_confidence_score: number | null
  ai_reasoning: string | null
}

interface GalleryClientProps {
  images: ReferenceImage[]
}

interface TagVocabulary {
  industries: string[]
  projectTypes: string[]
  styles: string[]
  moods: string[]
  elements: string[]
}

// Helper function to update tag usage counts when tags change
async function updateTagUsageForChanges(
  oldTags: { industries: string[], projectTypes: string[], styles: string[], moods: string[], elements: string[] },
  newTags: { industries: string[], projectTypes: string[], styles: string[], moods: string[], elements: string[] }
) {
  try {
    const now = new Date().toISOString()

    // Map frontend categories to database categories
    const categoryMap = {
      industries: 'industry',
      projectTypes: 'project_type',
      styles: 'style',
      moods: 'mood',
      elements: 'elements'
    }

    // Track added and removed tags
    const categories: Array<keyof typeof categoryMap> = ['industries', 'projectTypes', 'styles', 'moods', 'elements']

    for (const category of categories) {
      const dbCategory = categoryMap[category]
      const oldSet = new Set(oldTags[category] || [])
      const newSet = new Set(newTags[category] || [])

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
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all')
  const [selectedProjectType, setSelectedProjectType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated'>('newest')

  // Bulk selection
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  // Vocabulary for editing
  const [vocabulary, setVocabulary] = useState<TagVocabulary | null>(null)

  // Load vocabulary on mount
  useEffect(() => {
    loadVocabulary()
  }, [])

  const loadVocabulary = async () => {
    try {
      const { data, error } = await supabase
        .from('tag_vocabulary')
        .select('*')
        .order('category', { ascending: true })

      if (error) throw error

      const vocab: TagVocabulary = {
        industries: [],
        projectTypes: [],
        styles: [],
        moods: [],
        elements: []
      }

      data?.forEach((item: any) => {
        if (item.category === 'industry') vocab.industries.push(item.tag_value)
        else if (item.category === 'project_type') vocab.projectTypes.push(item.tag_value)
        else if (item.category === 'style') vocab.styles.push(item.tag_value)
        else if (item.category === 'mood') vocab.moods.push(item.tag_value)
        else if (item.category === 'element') vocab.elements.push(item.tag_value)
      })

      setVocabulary(vocab)
    } catch (error) {
      console.error('Error loading vocabulary:', error)
    }
  }

  // Extract unique values for filters
  const allIndustries = useMemo(() => {
    const industries = new Set<string>()
    images.forEach(img => img.industries?.forEach(ind => industries.add(ind)))
    return Array.from(industries).sort()
  }, [images])

  const allProjectTypes = useMemo(() => {
    const types = new Set<string>()
    images.forEach(img => img.project_types?.forEach(type => types.add(type)))
    return Array.from(types).sort()
  }, [images])

  // Filter and sort images
  const filteredImages = useMemo(() => {
    let filtered = images.filter(img => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        img.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        false

      // Industry filter
      const matchesIndustry = selectedIndustry === 'all' ||
        img.industries?.includes(selectedIndustry) ||
        false

      // Project type filter
      const matchesProjectType = selectedProjectType === 'all' ||
        img.project_types?.includes(selectedProjectType) ||
        false

      return matchesSearch && matchesIndustry && matchesProjectType
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
  }, [images, searchQuery, selectedIndustry, selectedProjectType, sortBy])

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

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        {/* Search and Sort Row */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by filename or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="updated">Recently Updated</option>
          </select>
        </div>

        {/* Filter Row */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="all">All Industries ({images.length})</option>
              {allIndustries.map(industry => (
                <option key={industry} value={industry}>
                  {industry} ({images.filter(img => img.industries?.includes(industry)).length})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Type
            </label>
            <select
              value={selectedProjectType}
              onChange={(e) => setSelectedProjectType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="all">All Types ({images.length})</option>
              {allProjectTypes.map(type => (
                <option key={type} value={type}>
                  {type} ({images.filter(img => img.project_types?.includes(type)).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count and bulk actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredImages.length} of {images.length} images
            {selectedImageIds.size > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({selectedImageIds.size} selected)
              </span>
            )}
          </div>

          {selectedImageIds.size === 0 ? (
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Select All
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-700 font-medium"
              >
                Clear Selection
              </button>
              <button
                onClick={() => setShowBulkEdit(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Edit Selected ({selectedImageIds.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image Grid */}
      {filteredImages.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No images found</h3>
          <p className="text-gray-600">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredImages.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              isSelected={selectedImageIds.has(image.id)}
              onToggleSelect={() => toggleSelection(image.id)}
              onClick={() => setSelectedImage(image)}
            />
          ))}
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImage && !editingImage && (
        <ImageDetailModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onEdit={() => {
            setEditingImage(selectedImage)
          }}
        />
      )}

      {/* Edit Image Modal */}
      {editingImage && vocabulary && (
        <EditImageModal
          image={editingImage}
          vocabulary={vocabulary}
          onClose={() => {
            setEditingImage(null)
            setSelectedImage(null)
          }}
          onSave={handleImageUpdate}
        />
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && vocabulary && (
        <BulkEditModal
          images={images.filter(img => selectedImageIds.has(img.id))}
          vocabulary={vocabulary}
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
  isSelected: boolean
  onToggleSelect: () => void
  onClick: () => void
}

function ImageCard({ image, isSelected, onToggleSelect, onClick }: ImageCardProps) {
  const allTags = [
    ...(image.industries || []),
    ...(image.project_types || []),
    ...(image.tags?.style || []),
    ...(image.tags?.mood || []),
    ...(image.tags?.elements || [])
  ]

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-lg transition-shadow group relative">
      {/* Selection Checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="text-white text-center px-4">
            <p className="text-sm font-medium mb-2">Click to view details</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {allTags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-white bg-opacity-20 rounded text-xs">
                  {tag}
                </span>
              ))}
              {allTags.length > 3 && (
                <span className="px-2 py-0.5 bg-white bg-opacity-20 rounded text-xs">
                  +{allTags.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-sm font-medium text-gray-900 truncate" title={image.original_filename}>
          {image.original_filename}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(image.tagged_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </p>
      </div>
    </div>
  )
}

// Image Detail Modal Component
interface ImageDetailModalProps {
  image: ReferenceImage
  onClose: () => void
  onEdit: () => void
}

function ImageDetailModal({ image, onClose, onEdit }: ImageDetailModalProps) {
  // Compare AI suggestions with actual tags
  const aiSuggested = image.ai_suggested_tags
  const actualTags = {
    industries: image.industries || [],
    projectTypes: image.project_types || [],
    styles: image.tags?.style || [],
    moods: image.tags?.mood || [],
    elements: image.tags?.elements || []
  }

  const corrections = useMemo(() => {
    if (!aiSuggested) return null

    const aiFlat = [
      ...(aiSuggested.industries || []),
      ...(aiSuggested.projectTypes || []),
      ...(aiSuggested.styles || []),
      ...(aiSuggested.moods || []),
      ...(aiSuggested.elements || [])
    ]

    const actualFlat = [
      ...actualTags.industries,
      ...actualTags.projectTypes,
      ...actualTags.styles,
      ...actualTags.moods,
      ...actualTags.elements
    ]

    const added = actualFlat.filter(tag => !aiFlat.includes(tag))
    const removed = aiFlat.filter(tag => !actualFlat.includes(tag))

    return { added, removed, hadSuggestions: aiFlat.length > 0 }
  }, [aiSuggested, actualTags])

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
                  {/* Industries */}
                  {actualTags.industries.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Industries</p>
                      <div className="flex flex-wrap gap-2">
                        {actualTags.industries.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project Types */}
                  {actualTags.projectTypes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Project Types</p>
                      <div className="flex flex-wrap gap-2">
                        {actualTags.projectTypes.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Styles */}
                  {actualTags.styles.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Styles</p>
                      <div className="flex flex-wrap gap-2">
                        {actualTags.styles.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Moods */}
                  {actualTags.moods.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Moods</p>
                      <div className="flex flex-wrap gap-2">
                        {actualTags.moods.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Elements */}
                  {actualTags.elements.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Elements</p>
                      <div className="flex flex-wrap gap-2">
                        {actualTags.elements.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
  onClose: () => void
  onSave: (updatedImage: ReferenceImage) => void
}

function EditImageModal({ image, vocabulary, onClose, onSave }: EditImageModalProps) {
  const [industries, setIndustries] = useState<string[]>(image.industries || [])
  const [projectTypes, setProjectTypes] = useState<string[]>(image.project_types || [])
  const [styles, setStyles] = useState<string[]>(image.tags?.style || [])
  const [moods, setMoods] = useState<string[]>(image.tags?.mood || [])
  const [elements, setElements] = useState<string[]>(image.tags?.elements || [])
  const [notes, setNotes] = useState<string>(image.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  const toggleTag = (category: 'industries' | 'projectTypes' | 'styles' | 'moods' | 'elements', tag: string) => {
    const setters = { industries: setIndustries, projectTypes: setProjectTypes, styles: setStyles, moods: setMoods, elements: setElements }
    const values = { industries, projectTypes, styles, moods, elements }

    const current = values[category]
    const setter = setters[category]

    if (current.includes(tag)) {
      setter(current.filter(t => t !== tag))
    } else {
      setter([...current, tag])
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Update tag usage counts (compare old vs new)
      await updateTagUsageForChanges(
        {
          industries: image.industries || [],
          projectTypes: image.project_types || [],
          styles: image.tags?.style || [],
          moods: image.tags?.mood || [],
          elements: image.tags?.elements || []
        },
        {
          industries,
          projectTypes,
          styles,
          moods,
          elements
        }
      )

      const { data, error } = await supabase
        .from('reference_images')
        .update({
          industries,
          project_types: projectTypes,
          tags: {
            style: styles,
            mood: moods,
            elements: elements
          },
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
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
              {/* Industries */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Industries ({industries.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {vocabulary.industries.map(tag => (
                    <button
                      key={`edit-industry-${tag}`}
                      onClick={() => toggleTag('industries', tag)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        industries.includes(tag)
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project Types */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Project Types ({projectTypes.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {vocabulary.projectTypes.map(tag => (
                    <button
                      key={`edit-projectType-${tag}`}
                      onClick={() => toggleTag('projectTypes', tag)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        projectTypes.includes(tag)
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Styles */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Styles ({styles.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {vocabulary.styles.map(tag => (
                    <button
                      key={`edit-style-${tag}`}
                      onClick={() => toggleTag('styles', tag)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        styles.includes(tag)
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Moods */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Moods ({moods.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {vocabulary.moods.map(tag => (
                    <button
                      key={`edit-mood-${tag}`}
                      onClick={() => toggleTag('moods', tag)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        moods.includes(tag)
                          ? 'bg-green-600 text-white'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Elements */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Elements ({elements.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {vocabulary.elements.map(tag => (
                    <button
                      key={`edit-element-${tag}`}
                      onClick={() => toggleTag('elements', tag)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        elements.includes(tag)
                          ? 'bg-orange-600 text-white'
                          : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

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
  onClose: () => void
  onSave: (updatedImages: ReferenceImage[]) => void
}

function BulkEditModal({ images, vocabulary, onClose, onSave }: BulkEditModalProps) {
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [industries, setIndustries] = useState<string[]>([])
  const [projectTypes, setProjectTypes] = useState<string[]>([])
  const [styles, setStyles] = useState<string[]>([])
  const [moods, setMoods] = useState<string[]>([])
  const [elements, setElements] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const toggleTag = (category: 'industries' | 'projectTypes' | 'styles' | 'moods' | 'elements', tag: string) => {
    const setters = { industries: setIndustries, projectTypes: setProjectTypes, styles: setStyles, moods: setMoods, elements: setElements }
    const values = { industries, projectTypes, styles, moods, elements }

    const current = values[category]
    const setter = setters[category]

    if (current.includes(tag)) {
      setter(current.filter(t => t !== tag))
    } else {
      setter([...current, tag])
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const updatedImages: ReferenceImage[] = []

      for (const image of images) {
        let newIndustries = [...(image.industries || [])]
        let newProjectTypes = [...(image.project_types || [])]
        let newStyles = [...(image.tags?.style || [])]
        let newMoods = [...(image.tags?.mood || [])]
        let newElements = [...(image.tags?.elements || [])]

        if (mode === 'add') {
          // Add selected tags
          industries.forEach(tag => { if (!newIndustries.includes(tag)) newIndustries.push(tag) })
          projectTypes.forEach(tag => { if (!newProjectTypes.includes(tag)) newProjectTypes.push(tag) })
          styles.forEach(tag => { if (!newStyles.includes(tag)) newStyles.push(tag) })
          moods.forEach(tag => { if (!newMoods.includes(tag)) newMoods.push(tag) })
          elements.forEach(tag => { if (!newElements.includes(tag)) newElements.push(tag) })
        } else {
          // Remove selected tags
          newIndustries = newIndustries.filter(tag => !industries.includes(tag))
          newProjectTypes = newProjectTypes.filter(tag => !projectTypes.includes(tag))
          newStyles = newStyles.filter(tag => !styles.includes(tag))
          newMoods = newMoods.filter(tag => !moods.includes(tag))
          newElements = newElements.filter(tag => !elements.includes(tag))
        }

        // Update tag usage counts for this image
        await updateTagUsageForChanges(
          {
            industries: image.industries || [],
            projectTypes: image.project_types || [],
            styles: image.tags?.style || [],
            moods: image.tags?.mood || [],
            elements: image.tags?.elements || []
          },
          {
            industries: newIndustries,
            projectTypes: newProjectTypes,
            styles: newStyles,
            moods: newMoods,
            elements: newElements
          }
        )

        const { data, error } = await supabase
          .from('reference_images')
          .update({
            industries: newIndustries,
            project_types: newProjectTypes,
            tags: {
              style: newStyles,
              mood: newMoods,
              elements: newElements
            },
            updated_at: new Date().toISOString()
          })
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

  const hasSelections = industries.length > 0 || projectTypes.length > 0 || styles.length > 0 || moods.length > 0 || elements.length > 0

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

          {/* Industries */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Industries ({industries.length} selected)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {vocabulary.industries.map(tag => (
                <button
                  key={`industry-${tag}`}
                  onClick={() => toggleTag('industries', tag)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    industries.includes(tag)
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Project Types */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Project Types ({projectTypes.length} selected)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {vocabulary.projectTypes.map(tag => (
                <button
                  key={`projectType-${tag}`}
                  onClick={() => toggleTag('projectTypes', tag)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    projectTypes.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Styles */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Styles ({styles.length} selected)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {vocabulary.styles.map(tag => (
                <button
                  key={`style-${tag}`}
                  onClick={() => toggleTag('styles', tag)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    styles.includes(tag)
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Moods */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Moods ({moods.length} selected)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {vocabulary.moods.map(tag => (
                <button
                  key={`mood-${tag}`}
                  onClick={() => toggleTag('moods', tag)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    moods.includes(tag)
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Elements */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Elements ({elements.length} selected)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
              {vocabulary.elements.map(tag => (
                <button
                  key={`element-${tag}`}
                  onClick={() => toggleTag('elements', tag)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    elements.includes(tag)
                      ? 'bg-orange-600 text-white'
                      : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
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
