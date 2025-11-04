'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { getImageValue } from '@/lib/vocabulary-utils'

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
  [key: string]: any
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

interface ImageDetailModalProps {
  image: ReferenceImage
  vocabConfig: VocabularyConfig
  onClose: () => void
  onEdit: () => void
}

export default function ImageDetailModal({ image, vocabConfig, onClose, onEdit }: ImageDetailModalProps) {
  // Collect actual tags dynamically
  const actualTags: Record<string, string[]> = {}
  vocabConfig.structure.categories.forEach(category => {
    const value = getImageValue(image, category.storage_path)
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
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto my-8 border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-white">Image Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
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
              <div className="bg-gray-900 rounded-lg overflow-hidden relative">
                <Image
                  src={image.storage_path}
                  alt={image.original_filename}
                  width={800}
                  height={600}
                  sizes="(max-width: 1024px) 100vw, 800px"
                  className="w-full h-auto"
                />
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-white">{image.original_filename}</p>
                <p className="text-xs text-gray-400">
                  Tagged: {new Date(image.tagged_at).toLocaleString()}
                </p>
                {image.updated_at && image.updated_at !== image.tagged_at && (
                  <p className="text-xs text-gray-400">
                    Updated: {new Date(image.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Tags and Info */}
            <div className="space-y-6">
              {/* Tags */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Tags</h3>

                <div className="space-y-4">
                  {/* Dynamically render all categories */}
                  {vocabConfig.structure.categories.map((category, catIdx) => {
                    const tags = actualTags[category.key] || []
                    if (tags.length === 0) return null

                    // Color rotation for visual variety
                    const colors = [
                      'bg-gray-700 text-gray-300',
                      'bg-blue-900/50 text-blue-300 border border-blue-700',
                      'bg-purple-900/50 text-purple-300 border border-purple-700',
                      'bg-green-900/50 text-green-300 border border-green-700',
                      'bg-orange-900/50 text-orange-300 border border-orange-700',
                      'bg-pink-900/50 text-pink-300 border border-pink-700',
                      'bg-indigo-900/50 text-indigo-300 border border-indigo-700',
                      'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                    ]
                    const colorClass = colors[catIdx % colors.length]

                    return (
                      <div key={category.key}>
                        <p className="text-sm font-medium text-gray-300 mb-2">{category.label}</p>
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
                  <h3 className="text-lg font-semibold text-white mb-2">Notes</h3>
                  <p className="text-sm text-gray-300 bg-gray-900 p-4 rounded-lg border border-gray-700">
                    {image.notes}
                  </p>
                </div>
              )}

              {/* AI Analysis */}
              {corrections?.hadSuggestions && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">AI Analysis</h3>

                  {/* Confidence Score */}
                  {image.ai_confidence_score !== null && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-300">Confidence</span>
                        <span className={`font-medium ${
                          image.ai_confidence_score >= 0.8 ? 'text-green-400' :
                          image.ai_confidence_score >= 0.5 ? 'text-yellow-400' :
                          'text-gray-400'
                        }`}>
                          {image.ai_confidence_score >= 0.8 ? 'High' :
                           image.ai_confidence_score >= 0.5 ? 'Medium' : 'Low'}
                          {' '}({Math.round(image.ai_confidence_score * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            image.ai_confidence_score >= 0.8 ? 'bg-green-500' :
                            image.ai_confidence_score >= 0.5 ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}
                          style={{ width: `${image.ai_confidence_score * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Corrections */}
                  {(corrections.added.length > 0 || corrections.removed.length > 0) && (
                    <div className="bg-gray-900 rounded-lg p-4 space-y-3 border border-gray-700">
                      <p className="text-sm font-medium text-white">Designer Corrections:</p>

                      {corrections.added.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-400 mb-1">Added Tags:</p>
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
