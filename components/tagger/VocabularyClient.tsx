'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'
import { useToast, useConfirmDialog } from '@/components/ui'
import EditTagModal from './Vocabulary/EditTagModal'
import MergeTagModal from './Vocabulary/MergeTagModal'
import AddTagModal from './Vocabulary/AddTagModal'
import AddCategoryModal from './Vocabulary/AddCategoryModal'
import EditCategoryModal from './Vocabulary/EditCategoryModal'

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

interface VocabularyClientProps {
  tags: VocabularyTag[]
}

export default function VocabularyClient({ tags: initialTags }: VocabularyClientProps) {
  const supabase = createClientComponentClient()
  const toast = useToast()
  const { confirmDialog, showConfirm } = useConfirmDialog()
  const [tags, setTags] = useState<VocabularyTag[]>(initialTags)
  const [selectedTag, setSelectedTag] = useState<VocabularyTag | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeView, setActiveView] = useState<'all' | 'analytics' | 'categories'>('all')

  // Vocabulary config state
  const [vocabConfig, setVocabConfig] = useState<VocabularyConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  // Category management state
  const [categories, setCategories] = useState<VocabularyCategory[]>([])
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<VocabularyCategory | null>(null)
  const [newCategory, setNewCategory] = useState({
    key: '',
    label: '',
    storage_type: 'jsonb_array' as 'array' | 'jsonb_array' | 'text',
    storage_path: '',
    search_weight: 2,
    description: '',
    placeholder: ''
  })

  // Load vocabulary config from API on mount
  useEffect(() => {
    loadVocabularyConfig()
  }, [])

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
      setCategories(config.structure.categories)
    } catch (error) {
      console.error('❌ Error loading vocabulary config:', error)
      setConfigError(error instanceof Error ? error.message : 'Failed to load vocabulary config')
    } finally {
      setConfigLoading(false)
    }
  }

  // Group tags by category dynamically
  const tagsByCategory = useMemo(() => {
    if (!vocabConfig) return {}

    const groups: Record<string, VocabularyTag[]> = {}

    // Initialize groups for all categories from config
    vocabConfig.structure.categories.forEach(category => {
      groups[category.key] = []
    })

    // Group tags directly by category (tag.category now matches config key)
    tags.forEach(tag => {
      if (groups[tag.category]) {
        groups[tag.category].push(tag)
      }
    })

    return groups
  }, [tags, vocabConfig])

  // Category labels from config
  const categoryLabels = useMemo(() => {
    if (!vocabConfig) return {}

    const labels: Record<string, string> = {}
    vocabConfig.structure.categories.forEach(category => {
      labels[category.key] = category.label
    })

    return labels
  }, [vocabConfig])

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
    const confirmed = await showConfirm({
      title: 'Archive Tag',
      message: `Archive "${tag.tag_value}"? It will be hidden from the tagger but data will be preserved.`,
      confirmText: 'Archive',
      variant: 'warning'
    })

    if (!confirmed) return

    const { error } = await supabase
      .from('tag_vocabulary')
      .update({ is_active: false })
      .eq('id', tag.id)

    if (error) {
      console.error('Failed to archive tag:', error)
      toast.error('Failed to archive tag', getErrorMessage(error, ErrorMessages.TAG_UPDATE_FAILED))
      return
    }

    toast.success('Tag archived', `"${tag.tag_value}" has been archived`)
    setTags(prev => prev.map(t => t.id === tag.id ? { ...t, is_active: false } : t))
  }

  const handleDeleteTag = async (tag: VocabularyTag) => {
    if (tag.times_used > 0) {
      toast.warning('Cannot delete tag', 'This tag has been used. Archive it instead to preserve data integrity.')
      return
    }

    const confirmed = await showConfirm({
      title: 'Delete Tag',
      message: `Permanently delete "${tag.tag_value}"? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger'
    })

    if (!confirmed) return

    const { error } = await supabase
      .from('tag_vocabulary')
      .delete()
      .eq('id', tag.id)

    if (error) {
      console.error('Failed to delete tag:', error)
      toast.error('Failed to delete tag', getErrorMessage(error, ErrorMessages.TAG_DELETE_FAILED))
      return
    }

    toast.success('Tag deleted', `"${tag.tag_value}" has been permanently deleted`)

    setTags(prev => prev.filter(t => t.id !== tag.id))
  }

  const handleTagUpdate = (updatedTag: VocabularyTag) => {
    setTags(prev => prev.map(t => t.id === updatedTag.id ? updatedTag : t))
  }

  const handleTagAdd = (newTag: VocabularyTag) => {
    setTags(prev => [...prev, newTag])
  }

  const handleMergeComplete = (sourceId: string) => {
    // Archive source tag and update usage count for target
    setTags(prev => prev.map(t => {
      if (t.id === sourceId) {
        return { ...t, is_active: false }
      }
      return t
    }))
  }

  // Category Management Functions
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Validation
      if (!newCategory.key || !newCategory.label || !newCategory.storage_path) {
        toast.error('Validation error', ErrorMessages.CATEGORY_REQUIRED_FIELDS)
        return
      }

      // Check for duplicate keys
      if (categories.some(cat => cat.key === newCategory.key)) {
        toast.error('Duplicate category key', ErrorMessages.CATEGORY_DUPLICATE_KEY)
        return
      }

      // Check for duplicate storage paths
      if (categories.some(cat => cat.storage_path === newCategory.storage_path)) {
        toast.error('Duplicate storage path', ErrorMessages.CATEGORY_DUPLICATE_PATH)
        return
      }

      // Get current vocabulary config
      const { data: config, error: fetchError } = await supabase
        .from('vocabulary_config')
        .select('*')
        .eq('is_active', true)
        .single()

      if (fetchError) throw fetchError

      if (!config) {
        toast.error('Configuration error', ErrorMessages.VOCAB_CONFIG_LOAD_FAILED)
        return
      }

      // Add new category to structure
      const updatedStructure = {
        ...config.structure,
        categories: [
          ...config.structure.categories,
          {
            key: newCategory.key,
            label: newCategory.label,
            storage_type: newCategory.storage_type,
            storage_path: newCategory.storage_path,
            search_weight: newCategory.search_weight,
            description: newCategory.description || undefined,
            placeholder: newCategory.placeholder || undefined
          }
        ]
      }

      // Update vocabulary config
      const { error } = await supabase
        .from('vocabulary_config')
        .update({
          structure: updatedStructure,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id)

      if (error) throw error

      toast.success('Category added', `"${newCategory.label}" has been added to the vocabulary`)

      // Reset form and close modal
      setNewCategory({
        key: '',
        label: '',
        storage_type: 'jsonb_array',
        storage_path: '',
        search_weight: 2,
        description: '',
        placeholder: ''
      })
      setShowAddCategoryModal(false)

      // Reload categories
      loadVocabularyConfig()

    } catch (error: any) {
      console.error('Error adding category:', error)
      toast.error('Failed to add category', getErrorMessage(error, ErrorMessages.CATEGORY_REQUIRED_FIELDS))
    }
  }

  const handleEditCategory = (category: VocabularyCategory) => {
    setEditingCategory(category)
    setShowEditCategoryModal(true)
  }

  const handleUpdateCategory = async (categoryKey: string, updates: Partial<VocabularyCategory>) => {
    try {
      const { data: config, error: fetchError } = await supabase
        .from('vocabulary_config')
        .select('*')
        .eq('is_active', true)
        .single()

      if (fetchError) throw fetchError
      if (!config) throw new Error('No active config')

      // Update the specific category
      const updatedCategories = config.structure.categories.map((cat: any) =>
        cat.key === categoryKey ? { ...cat, ...updates } : cat
      )

      const { error } = await supabase
        .from('vocabulary_config')
        .update({
          structure: { ...config.structure, categories: updatedCategories },
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id)

      if (error) throw error

      toast.success('Category updated', 'Category properties have been updated successfully')
      setShowEditCategoryModal(false)
      setEditingCategory(null)
      loadVocabularyConfig()

    } catch (error: any) {
      console.error('Error updating category:', error)
      toast.error('Failed to update category', getErrorMessage(error, 'Failed to update category. Please try again.'))
    }
  }

  const handleDeleteCategory = async (categoryKey: string) => {
    // Check if category has tags
    const tagCount = tags.filter(t => t.category === categoryKey).length

    const confirmMessage = tagCount > 0
      ? `Delete "${categoryKey}" and its ${tagCount} tag(s)? This cannot be undone.`
      : `Delete "${categoryKey}"? This cannot be undone.`

    const confirmed = await showConfirm({
      title: 'Delete Category',
      message: confirmMessage,
      confirmText: 'Delete',
      variant: 'danger'
    })

    if (!confirmed) return

    try {
      // Get current config
      const { data: config, error: fetchError } = await supabase
        .from('vocabulary_config')
        .select('*')
        .eq('is_active', true)
        .single()

      if (fetchError) throw fetchError
      if (!config) throw new Error('No active config')

      // Remove category from structure
      const updatedCategories = config.structure.categories.filter(
        (cat: any) => cat.key !== categoryKey
      )

      // Update config
      const { error: configError } = await supabase
        .from('vocabulary_config')
        .update({
          structure: { ...config.structure, categories: updatedCategories },
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id)

      if (configError) throw configError

      // Delete all tags in this category
      if (tagCount > 0) {
        const { error: tagsError } = await supabase
          .from('tag_vocabulary')
          .delete()
          .eq('category', categoryKey)

        if (tagsError) throw tagsError
      }

      toast.success('Category deleted', `"${categoryKey}" and its ${tagCount} tags have been deleted`)

      // Update local state
      setTags(prev => prev.filter(t => t.category !== categoryKey))
      loadVocabularyConfig()

    } catch (error: any) {
      console.error('Error deleting category:', error)
      toast.error('Failed to delete category', getErrorMessage(error, ErrorMessages.CATEGORY_DELETE_FAILED))
    }
  }

  // Show loading state while config is loading
  if (configLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
        <div className="text-4xl mb-4">⏳</div>
        <h3 className="text-xl font-semibold text-white mb-2">Loading vocabulary...</h3>
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
    <div className="space-y-6">
      {/* View Toggle and Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('categories')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'categories'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveView('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            All Tags ({tags.length})
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'analytics'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            Analytics
          </button>
        </div>

        {activeView === 'categories' ? (
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            + Add New Category
          </button>
        ) : (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Add New Tag
          </button>
        )}
      </div>

      {/* Categories View */}
      {activeView === 'categories' && (
        <div className="space-y-6">
          {categories.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
              <div className="text-4xl mb-4">📂</div>
              <h3 className="text-xl font-semibold text-white mb-2">No categories yet</h3>
              <p className="text-gray-300 mb-6">Get started by adding your first category</p>
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                + Add Your First Category
              </button>
            </div>
          ) : (
            categories.map(category => {
              const categoryTagCount = tags.filter(t => t.category === category.key).length
              
              return (
                <div key={category.key} className="bg-gray-800 rounded-lg border-2 border-gray-700 overflow-hidden shadow-xl hover:shadow-2xl transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{category.label}</h3>
                          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded font-mono">
                            {category.key}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            category.storage_type === 'array' 
                              ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                              : category.storage_type === 'jsonb_array'
                              ? 'bg-purple-900/50 text-purple-300 border border-purple-700'
                              : 'bg-green-900/50 text-green-300 border border-green-700'
                          }`}>
                            {category.storage_type}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm text-gray-300 mb-3">
                          <div>
                            <span className="font-medium text-gray-400">Storage Path:</span>
                            <span className="ml-2 font-mono bg-gray-900 px-2 py-0.5 rounded text-white">{category.storage_path}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-400">Search Weight:</span>
                            <span className="ml-2 font-semibold text-white">{category.search_weight}/10</span>
                          </div>
                        </div>
                        
                        {category.description && (
                          <p className="text-sm text-gray-300 mb-2">
                            <span className="font-medium text-gray-400">Description:</span> {category.description}
                          </p>
                        )}
                        
                        {category.placeholder && (
                          <p className="text-sm text-gray-300 mb-2">
                            <span className="font-medium text-gray-400">Placeholder:</span> 
                            <span className="ml-2 italic">{category.placeholder}</span>
                          </p>
                        )}
                        
                        <div className="mt-3 flex items-center gap-4">
                          <span className="inline-flex items-center text-sm font-medium text-white bg-gray-700 px-3 py-1.5 rounded-full border border-gray-600">
                            📝 {categoryTagCount} {categoryTagCount === 1 ? 'tag' : 'tags'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="px-4 py-2 text-sm font-medium text-blue-300 bg-blue-900/50 hover:bg-blue-800/50 rounded-lg transition-colors border border-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.key)}
                          className="px-4 py-2 text-sm font-medium text-red-300 bg-red-900/50 hover:bg-red-800/50 rounded-lg transition-colors border border-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* All Tags View */}
      {activeView === 'all' && (
        <div className="space-y-6">
          {Object.entries(tagsByCategory).filter(([_, categoryTags]) => categoryTags.length > 0).length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-white mb-2">No tags yet</h3>
              <p className="text-gray-300 mb-6">Get started by adding your first tag</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                + Add Your First Tag
              </button>
            </div>
          ) : (
            Object.entries(tagsByCategory)
              .filter(([_, categoryTags]) => categoryTags.length > 0) // Only show categories with tags
              .map(([category, categoryTags]) => (
            <div key={category} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-xl">
              <div className="px-6 py-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">
                  {categoryLabels[category as keyof typeof categoryLabels]} 
                  <span className="ml-2 text-sm font-normal text-gray-400">({categoryTags.length} tags)</span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900 border-b-2 border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wide">
                        Tag Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wide">
                        Description
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wide">
                        Times Used
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wide">
                        Last Used
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {categoryTags.map(tag => (
                      <tr key={tag.id} className={!tag.is_active ? 'bg-gray-900/50 opacity-60' : 'hover:bg-gray-750 transition-colors'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-white">{tag.tag_value}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-300 max-w-xs truncate">
                            {tag.description || <span className="text-gray-500 italic">No description</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-white">{tag.times_used}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-400">
                            {tag.last_used_at
                              ? new Date(tag.last_used_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : <span className="text-gray-500 italic">Never</span>
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            tag.is_active
                              ? 'bg-green-900/50 text-green-300 border border-green-700'
                              : 'bg-gray-700 text-gray-400 border border-gray-600'
                          }`}>
                            {tag.is_active ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex gap-2 justify-end items-center">
                            <button
                              onClick={() => handleEditTag(tag)}
                              className="px-3 py-1.5 text-xs font-medium text-blue-300 hover:text-blue-200 hover:bg-blue-900/50 rounded-md transition-colors border border-blue-700"
                            >
                              Edit
                            </button>
                            {tag.times_used > 0 && (
                              <button
                                onClick={() => handleMergeTag(tag)}
                                className="px-3 py-1.5 text-xs font-medium text-purple-300 hover:text-purple-200 hover:bg-purple-900/50 rounded-md transition-colors border border-purple-700"
                              >
                                Merge
                              </button>
                            )}
                            {tag.is_active ? (
                              <button
                                onClick={() => handleArchiveTag(tag)}
                                className="px-3 py-1.5 text-xs font-medium text-yellow-300 hover:text-yellow-200 hover:bg-yellow-900/50 rounded-md transition-colors border border-yellow-700"
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
                                className="px-3 py-1.5 text-xs font-medium text-green-300 hover:text-green-200 hover:bg-green-900/50 rounded-md transition-colors border border-green-700"
                              >
                                Activate
                              </button>
                            )}
                            {tag.times_used === 0 && (
                              <button
                                onClick={() => handleDeleteTag(tag)}
                                className="px-3 py-1.5 text-xs font-medium text-red-300 hover:text-red-200 hover:bg-red-900/50 rounded-md transition-colors border border-red-700"
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
          )))}
        </div>
      )}

      {/* Analytics View */}
      {activeView === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Most Used Tags */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Most Used Tags</h3>
            <div className="space-y-2">
              {analytics.mostUsed.map((tag, idx) => (
                <div key={tag.id} className="flex items-center justify-between py-2 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{tag.tag_value}</p>
                      <p className="text-xs text-gray-400 capitalize">{tag.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-blue-400">{tag.times_used} uses</span>
                </div>
              ))}
            </div>
          </div>

          {/* Least Used Tags */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Least Used Tags</h3>
            <div className="space-y-2">
              {analytics.leastUsed.map((tag, idx) => (
                <div key={tag.id} className="flex items-center justify-between py-2 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{tag.tag_value}</p>
                      <p className="text-xs text-gray-400 capitalize">{tag.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-orange-400">{tag.times_used} uses</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recently Added Tags */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Recently Added (Last 30 Days)</h3>
            <div className="space-y-2">
              {analytics.recentlyAdded.length === 0 ? (
                <p className="text-sm text-gray-400">No tags added in the last 30 days</p>
              ) : (
                analytics.recentlyAdded.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between py-2 border-b border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-white">{tag.tag_value}</p>
                      <p className="text-xs text-gray-400 capitalize">{tag.category.replace('_', ' ')}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(tag.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Never Used Tags */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Never Used Tags</h3>
            <div className="space-y-2">
              {analytics.neverUsed.length === 0 ? (
                <p className="text-sm text-gray-400">All tags have been used at least once!</p>
              ) : (
                analytics.neverUsed.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between py-2 border-b border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-white">{tag.tag_value}</p>
                      <p className="text-xs text-gray-400 capitalize">{tag.category.replace('_', ' ')}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteTag(tag)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/50 px-2 py-1 rounded transition-colors"
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
          supabase={supabase}
        />
      )}

      {/* Merge Tag Modal */}
      {showMergeModal && selectedTag && vocabConfig && (
        <MergeTagModal
          sourceTag={selectedTag}
          allTags={tags.filter(t => t.category === selectedTag.category && t.id !== selectedTag.id && t.is_active)}
          vocabConfig={vocabConfig}
          onClose={() => {
            setShowMergeModal(false)
            setSelectedTag(null)
          }}
          onMerge={handleMergeComplete}
          supabase={supabase}
        />
      )}

      {/* Add Tag Modal */}
      {showAddModal && vocabConfig && (
        <AddTagModal
          vocabConfig={vocabConfig}
          onClose={() => setShowAddModal(false)}
          onAdd={handleTagAdd}
          supabase={supabase}
        />
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <AddCategoryModal
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          onSubmit={handleAddCategory}
          onClose={() => {
            setShowAddCategoryModal(false)
            setNewCategory({
              key: '',
              label: '',
              storage_type: 'jsonb_array',
              storage_path: '',
              search_weight: 2,
              description: '',
              placeholder: ''
            })
          }}
        />
      )}

      {/* Edit Category Modal */}
      {showEditCategoryModal && editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          onClose={() => {
            setShowEditCategoryModal(false)
            setEditingCategory(null)
          }}
          onSave={handleUpdateCategory}
        />
      )}

      {/* Confirm Dialog */}
      {confirmDialog}
    </div>
  )
}
