'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface VocabularyTag {
  id: string
  category: string
  tag_value: string
  description: string | null
  sort_order: number
  is_active: boolean
  times_used: number
  last_used_at: string | null
  created_at: string
}

interface VocabularyClientProps {
  tags: VocabularyTag[]
}

export default function VocabularyClient({ tags: initialTags }: VocabularyClientProps) {
  const [tags, setTags] = useState<VocabularyTag[]>(initialTags)
  const [selectedTag, setSelectedTag] = useState<VocabularyTag | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeView, setActiveView] = useState<'all' | 'analytics'>('all')

  // Group tags by category
  const tagsByCategory = useMemo(() => {
    const groups: Record<string, VocabularyTag[]> = {
      industry: [],
      project_type: [],
      style: [],
      mood: [],
      element: []
    }

    tags.forEach(tag => {
      if (groups[tag.category]) {
        groups[tag.category].push(tag)
      }
    })

    return groups
  }, [tags])

  // Analytics data
  const analytics = useMemo(() => {
    const sortedByUsage = [...tags].sort((a, b) => b.times_used - a.times_used)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    return {
      mostUsed: sortedByUsage.slice(0, 10),
      leastUsed: sortedByUsage.filter(t => t.times_used > 0).slice(-10).reverse(),
      recentlyAdded: tags.filter(t => new Date(t.created_at) > thirtyDaysAgo),
      neverUsed: tags.filter(t => t.times_used === 0)
    }
  }, [tags])

  const handleEditTag = (tag: VocabularyTag) => {
    setSelectedTag(tag)
    setShowEditModal(true)
  }

  const handleMergeTag = (tag: VocabularyTag) => {
    setSelectedTag(tag)
    setShowMergeModal(true)
  }

  const handleArchiveTag = async (tag: VocabularyTag) => {
    if (!confirm(`Archive "${tag.tag_value}"? It will be hidden from the tagger but data will be preserved.`)) {
      return
    }

    const { error } = await supabase
      .from('tag_vocabulary')
      .update({ is_active: false })
      .eq('id', tag.id)

    if (error) {
      alert('Failed to archive tag')
      console.error(error)
      return
    }

    setTags(prev => prev.map(t => t.id === tag.id ? { ...t, is_active: false } : t))
  }

  const handleDeleteTag = async (tag: VocabularyTag) => {
    if (tag.times_used > 0) {
      alert('Cannot delete a tag that has been used. Archive it instead.')
      return
    }

    if (!confirm(`Permanently delete "${tag.tag_value}"? This cannot be undone.`)) {
      return
    }

    const { error } = await supabase
      .from('tag_vocabulary')
      .delete()
      .eq('id', tag.id)

    if (error) {
      alert('Failed to delete tag')
      console.error(error)
      return
    }

    setTags(prev => prev.filter(t => t.id !== tag.id))
  }

  const handleTagUpdate = (updatedTag: VocabularyTag) => {
    setTags(prev => prev.map(t => t.id === updatedTag.id ? updatedTag : t))
  }

  const handleTagAdd = (newTag: VocabularyTag) => {
    setTags(prev => [...prev, newTag])
  }

  const handleMergeComplete = (sourceId: string, targetId: string) => {
    // Archive source tag and update usage count for target
    setTags(prev => prev.map(t => {
      if (t.id === sourceId) {
        return { ...t, is_active: false }
      }
      return t
    }))
  }

  const categoryLabels = {
    industry: 'Industries',
    project_type: 'Project Types',
    style: 'Styles',
    mood: 'Moods',
    element: 'Elements'
  }

  return (
    <div className="space-y-6">
      {/* View Toggle and Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'all'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            All Tags ({tags.length})
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'analytics'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Analytics
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Add New Tag
        </button>
      </div>

      {/* All Tags View */}
      {activeView === 'all' && (
        <div className="space-y-6">
          {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
            <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-xl font-semibold">
                  {categoryLabels[category as keyof typeof categoryLabels]} ({categoryTags.length})
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Tag Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Times Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Last Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categoryTags.map(tag => (
                      <tr key={tag.id} className={!tag.is_active ? 'bg-gray-50 opacity-60' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{tag.tag_value}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-xs truncate">
                            {tag.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{tag.times_used}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {tag.last_used_at
                              ? new Date(tag.last_used_at).toLocaleDateString()
                              : 'Never'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            tag.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {tag.is_active ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleEditTag(tag)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            {tag.times_used > 0 && (
                              <button
                                onClick={() => handleMergeTag(tag)}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                Merge
                              </button>
                            )}
                            {tag.is_active ? (
                              <button
                                onClick={() => handleArchiveTag(tag)}
                                className="text-yellow-600 hover:text-yellow-900"
                              >
                                Archive
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from('tag_vocabulary')
                                    .update({ is_active: true })
                                    .eq('id', tag.id)

                                  if (!error) {
                                    setTags(prev => prev.map(t =>
                                      t.id === tag.id ? { ...t, is_active: true } : t
                                    ))
                                  }
                                }}
                                className="text-green-600 hover:text-green-900"
                              >
                                Activate
                              </button>
                            )}
                            {tag.times_used === 0 && (
                              <button
                                onClick={() => handleDeleteTag(tag)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics View */}
      {activeView === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Most Used Tags */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Most Used Tags</h3>
            <div className="space-y-2">
              {analytics.mostUsed.map((tag, idx) => (
                <div key={tag.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-6">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tag.tag_value}</p>
                      <p className="text-xs text-gray-500 capitalize">{tag.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{tag.times_used} uses</span>
                </div>
              ))}
            </div>
          </div>

          {/* Least Used Tags */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Least Used Tags</h3>
            <div className="space-y-2">
              {analytics.leastUsed.map((tag, idx) => (
                <div key={tag.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-6">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tag.tag_value}</p>
                      <p className="text-xs text-gray-500 capitalize">{tag.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-orange-600">{tag.times_used} uses</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recently Added Tags */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Recently Added (Last 30 Days)</h3>
            <div className="space-y-2">
              {analytics.recentlyAdded.length === 0 ? (
                <p className="text-sm text-gray-500">No tags added in the last 30 days</p>
              ) : (
                analytics.recentlyAdded.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tag.tag_value}</p>
                      <p className="text-xs text-gray-500 capitalize">{tag.category.replace('_', ' ')}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(tag.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Never Used Tags */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Never Used Tags</h3>
            <div className="space-y-2">
              {analytics.neverUsed.length === 0 ? (
                <p className="text-sm text-gray-500">All tags have been used at least once!</p>
              ) : (
                analytics.neverUsed.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tag.tag_value}</p>
                      <p className="text-xs text-gray-500 capitalize">{tag.category.replace('_', ' ')}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteTag(tag)}
                      className="text-xs text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditModal && selectedTag && (
        <EditTagModal
          tag={selectedTag}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTag(null)
          }}
          onSave={handleTagUpdate}
        />
      )}

      {/* Merge Tag Modal */}
      {showMergeModal && selectedTag && (
        <MergeTagModal
          sourceTag={selectedTag}
          allTags={tags.filter(t => t.category === selectedTag.category && t.id !== selectedTag.id && t.is_active)}
          onClose={() => {
            setShowMergeModal(false)
            setSelectedTag(null)
          }}
          onMerge={handleMergeComplete}
        />
      )}

      {/* Add Tag Modal */}
      {showAddModal && (
        <AddTagModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleTagAdd}
        />
      )}
    </div>
  )
}

// Edit Tag Modal
interface EditTagModalProps {
  tag: VocabularyTag
  onClose: () => void
  onSave: (updatedTag: VocabularyTag) => void
}

function EditTagModal({ tag, onClose, onSave }: EditTagModalProps) {
  const [tagValue, setTagValue] = useState(tag.tag_value)
  const [description, setDescription] = useState(tag.description || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)

    const { data, error } = await supabase
      .from('tag_vocabulary')
      .update({
        tag_value: tagValue,
        description: description || null
      })
      .eq('id', tag.id)
      .select()
      .single()

    if (error) {
      alert('Failed to update tag')
      console.error(error)
      setIsSaving(false)
      return
    }

    onSave(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Edit Tag</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tag Name
            </label>
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Add a description for this tag..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !tagValue.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Merge Tag Modal
interface MergeTagModalProps {
  sourceTag: VocabularyTag
  allTags: VocabularyTag[]
  onClose: () => void
  onMerge: (sourceId: string, targetId: string) => void
}

function MergeTagModal({ sourceTag, allTags, onClose, onMerge }: MergeTagModalProps) {
  const [targetTagId, setTargetTagId] = useState('')
  const [isMerging, setIsMerging] = useState(false)

  const handleMerge = async () => {
    if (!targetTagId) {
      alert('Please select a target tag')
      return
    }

    if (!confirm(`Merge "${sourceTag.tag_value}" into the selected tag? This will update all ${sourceTag.times_used} references and archive the source tag.`)) {
      return
    }

    setIsMerging(true)

    try {
      // Get all reference images using the source tag
      const { data: images, error: fetchError } = await supabase
        .from('reference_images')
        .select('*')

      if (fetchError) throw fetchError

      const targetTag = allTags.find(t => t.id === targetTagId)
      if (!targetTag) throw new Error('Target tag not found')

      // Update each image that uses the source tag
      for (const image of images || []) {
        let needsUpdate = false
        const updates: any = {}

        // Check and update each category
        if (sourceTag.category === 'industry' && image.industries?.includes(sourceTag.tag_value)) {
          updates.industries = image.industries
            .filter((t: string) => t !== sourceTag.tag_value)
            .concat(targetTag.tag_value)
          needsUpdate = true
        }

        if (sourceTag.category === 'project_type' && image.project_types?.includes(sourceTag.tag_value)) {
          updates.project_types = image.project_types
            .filter((t: string) => t !== sourceTag.tag_value)
            .concat(targetTag.tag_value)
          needsUpdate = true
        }

        if (sourceTag.category === 'style' && image.tags?.style?.includes(sourceTag.tag_value)) {
          updates.tags = {
            ...image.tags,
            style: image.tags.style
              .filter((t: string) => t !== sourceTag.tag_value)
              .concat(targetTag.tag_value)
          }
          needsUpdate = true
        }

        if (sourceTag.category === 'mood' && image.tags?.mood?.includes(sourceTag.tag_value)) {
          updates.tags = {
            ...image.tags,
            mood: image.tags.mood
              .filter((t: string) => t !== sourceTag.tag_value)
              .concat(targetTag.tag_value)
          }
          needsUpdate = true
        }

        if (sourceTag.category === 'element' && image.tags?.elements?.includes(sourceTag.tag_value)) {
          updates.tags = {
            ...image.tags,
            elements: image.tags.elements
              .filter((t: string) => t !== sourceTag.tag_value)
              .concat(targetTag.tag_value)
          }
          needsUpdate = true
        }

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('reference_images')
            .update(updates)
            .eq('id', image.id)

          if (updateError) throw updateError
        }
      }

      // Archive the source tag
      const { error: archiveError } = await supabase
        .from('tag_vocabulary')
        .update({ is_active: false })
        .eq('id', sourceTag.id)

      if (archiveError) throw archiveError

      onMerge(sourceTag.id, targetTagId)
      onClose()
    } catch (error) {
      console.error('Merge failed:', error)
      alert('Failed to merge tags')
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Merge Tag</h2>

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            This will replace all uses of <strong>{sourceTag.tag_value}</strong> with the selected tag
            and archive the original. This affects {sourceTag.times_used} images.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merge into:
            </label>
            <select
              value={targetTagId}
              onChange={(e) => setTargetTagId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">Select target tag...</option>
              {allTags.map(tag => (
                <option key={tag.id} value={tag.id}>
                  {tag.tag_value} ({tag.times_used} uses)
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={isMerging || !targetTagId}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isMerging ? 'Merging...' : 'Merge Tags'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Add Tag Modal
interface AddTagModalProps {
  onClose: () => void
  onAdd: (newTag: VocabularyTag) => void
}

function AddTagModal({ onClose, onAdd }: AddTagModalProps) {
  const [category, setCategory] = useState('industry')
  const [tagValue, setTagValue] = useState('')
  const [description, setDescription] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!tagValue.trim()) {
      alert('Please enter a tag name')
      return
    }

    setIsAdding(true)

    // Get max sort_order for this category
    const { data: existingTags } = await supabase
      .from('tag_vocabulary')
      .select('sort_order')
      .eq('category', category)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextSortOrder = existingTags && existingTags.length > 0
      ? existingTags[0].sort_order + 1
      : 1

    const { data, error } = await supabase
      .from('tag_vocabulary')
      .insert({
        category,
        tag_value: tagValue.toLowerCase().trim(),
        description: description || null,
        sort_order: nextSortOrder,
        is_active: true,
        times_used: 0
      })
      .select()
      .single()

    if (error) {
      alert('Failed to add tag')
      console.error(error)
      setIsAdding(false)
      return
    }

    onAdd(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Add New Tag</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="industry">Industry</option>
              <option value="project_type">Project Type</option>
              <option value="style">Style</option>
              <option value="mood">Mood</option>
              <option value="element">Element</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tag Name
            </label>
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="e.g., minimalist, luxury, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Add a description for this tag..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={isAdding || !tagValue.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isAdding ? 'Adding...' : 'Add Tag'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
