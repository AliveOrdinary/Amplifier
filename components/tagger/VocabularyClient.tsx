'use client'

import { useState, useMemo, useEffect } from 'react'
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

  // Category Management Functions
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Validation
      if (!newCategory.key || !newCategory.label || !newCategory.storage_path) {
        alert('Please fill in all required fields')
        return
      }

      // Check for duplicate keys
      if (categories.some(cat => cat.key === newCategory.key)) {
        alert('Category key already exists. Please use a unique key.')
        return
      }

      // Check for duplicate storage paths
      if (categories.some(cat => cat.storage_path === newCategory.storage_path)) {
        alert('Storage path already in use. Please use a unique path.')
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
        alert('No active vocabulary configuration found')
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

      alert(`Category "${newCategory.label}" added successfully!`)

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
      alert(`Failed to add category: ${error.message}`)
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

      alert('Category updated successfully!')
      setShowEditCategoryModal(false)
      setEditingCategory(null)
      loadVocabularyConfig()

    } catch (error: any) {
      console.error('Error updating category:', error)
      alert(`Failed to update category: ${error.message}`)
    }
  }

  const handleDeleteCategory = async (categoryKey: string) => {
    // Check if category has tags
    const tagCount = tags.filter(t => t.category === categoryKey).length

    const confirmMessage = tagCount > 0
      ? `Are you sure you want to delete "${categoryKey}"? This will also delete ${tagCount} tag(s) in this category. This cannot be undone.`
      : `Are you sure you want to delete "${categoryKey}"?`

    if (!confirm(confirmMessage)) return

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

      alert(`Category "${categoryKey}" deleted successfully!`)
      
      // Update local state
      setTags(prev => prev.filter(t => t.category !== categoryKey))
      loadVocabularyConfig()

    } catch (error: any) {
      console.error('Error deleting category:', error)
      alert(`Failed to delete category: ${error.message}`)
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
        />
      )}

      {/* Add Tag Modal */}
      {showAddModal && vocabConfig && (
        <AddTagModal
          vocabConfig={vocabConfig}
          onClose={() => setShowAddModal(false)}
          onAdd={handleTagAdd}
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
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Edit Tag</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Tag Name
            </label>
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              placeholder="Add a description for this tag..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
  vocabConfig: VocabularyConfig
  onClose: () => void
  onMerge: (sourceId: string, targetId: string) => void
}

function MergeTagModal({ sourceTag, allTags, vocabConfig, onClose, onMerge }: MergeTagModalProps) {
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
      // Find the category config for the source tag
      const categoryConfig = vocabConfig.structure.categories.find(cat => cat.key === sourceTag.category)
      if (!categoryConfig) {
        throw new Error(`Category configuration not found for ${sourceTag.category}`)
      }

      // Get all reference images
      const { data: images, error: fetchError } = await supabase
        .from('reference_images')
        .select('*')

      if (fetchError) throw fetchError

      const targetTag = allTags.find(t => t.id === targetTagId)
      if (!targetTag) throw new Error('Target tag not found')

      // Helper function to get value from image based on storage_path
      const getImageValue = (image: any, storagePath: string): any => {
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

      // Update each image that uses the source tag
      for (const image of images || []) {
        const currentValue = getImageValue(image, categoryConfig.storage_path)
        
        let needsUpdate = false
        const updates: any = {}

        if (categoryConfig.storage_type === 'array' || categoryConfig.storage_type === 'jsonb_array') {
          // For array types, check if the source tag is in the array
          if (Array.isArray(currentValue) && currentValue.includes(sourceTag.tag_value)) {
            // Remove source tag and add target tag
            const newValue = currentValue
              .filter((t: string) => t !== sourceTag.tag_value)
              .concat(targetTag.tag_value)
            
            // Build update object dynamically based on storage_path
            if (categoryConfig.storage_path.includes('.')) {
              const parts = categoryConfig.storage_path.split('.')
              const topLevel = parts[0]
              const nested = parts[1]
              updates[topLevel] = {
                ...image[topLevel],
                [nested]: newValue
              }
            } else {
              updates[categoryConfig.storage_path] = newValue
            }
            
            needsUpdate = true
          }
        } else if (categoryConfig.storage_type === 'text') {
          // For text types, check if it matches exactly
          if (currentValue === sourceTag.tag_value) {
            if (categoryConfig.storage_path.includes('.')) {
              const parts = categoryConfig.storage_path.split('.')
              const topLevel = parts[0]
              const nested = parts[1]
              updates[topLevel] = {
                ...image[topLevel],
                [nested]: targetTag.tag_value
              }
            } else {
              updates[categoryConfig.storage_path] = targetTag.tag_value
            }
            
            needsUpdate = true
          }
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
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Merge Tag</h2>

        <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-600 rounded-lg">
          <p className="text-sm text-yellow-300">
            This will replace all uses of <strong>{sourceTag.tag_value}</strong> with the selected tag
            and archive the original. This affects {sourceTag.times_used} images.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Merge into:
            </label>
            <select
              value={targetTagId}
              onChange={(e) => setTargetTagId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
  vocabConfig: VocabularyConfig
  onClose: () => void
  onAdd: (newTag: VocabularyTag) => void
}

function AddTagModal({ vocabConfig, onClose, onAdd }: AddTagModalProps) {
  // Initialize with the first category from config
  const [category, setCategory] = useState(vocabConfig.structure.categories[0]?.key || '')
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl border-2 border-gray-700">
        {/* Header */}
        <div className="px-8 py-6 border-b-2 border-gray-700">
          <h2 className="text-3xl font-bold text-white">✨ Add New Tag</h2>
          <p className="text-gray-300 mt-2">Create a new tag for your vocabulary</p>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-900 text-white font-semibold transition-all hover:border-gray-500 cursor-pointer"
            >
              {vocabConfig.structure.categories.map(cat => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Name */}
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Tag Name *
            </label>
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              placeholder="e.g., minimalist, luxury, modern..."
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Description
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500 resize-none"
              placeholder="Add a helpful description for this tag..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-900 rounded-b-2xl border-t-2 border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-700 border-2 border-gray-600 text-white rounded-lg hover:bg-gray-600 hover:border-gray-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={isAdding || !tagValue.trim()}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? '⏳ Adding...' : '✓ Add Tag'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Add Category Modal
interface AddCategoryModalProps {
  newCategory: {
    key: string
    label: string
    storage_type: 'array' | 'jsonb_array' | 'text'
    storage_path: string
    search_weight: number
    description: string
    placeholder: string
  }
  setNewCategory: (category: any) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

function AddCategoryModal({ newCategory, setNewCategory, onSubmit, onClose }: AddCategoryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl max-w-3xl w-full shadow-2xl border-2 border-gray-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b-2 border-gray-700">
          <h2 className="text-3xl font-bold text-white">📂 Add New Category</h2>
          <p className="text-gray-300 mt-2">Configure a new category for organizing your tags</p>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          <form id="add-category-form" onSubmit={onSubmit} className="px-8 py-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Category Key *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              💡 Lowercase with underscores only (e.g., "color_palette")
            </p>
            <input
              type="text"
              value={newCategory.key}
              onChange={(e) => setNewCategory({
                ...newCategory, 
                key: e.target.value.toLowerCase().replace(/[^a-z_]/g, '')
              })}
              placeholder="color_palette"
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Display Label *
            </label>
            <input
              type="text"
              value={newCategory.label}
              onChange={(e) => setNewCategory({...newCategory, label: e.target.value})}
              placeholder="Color Palette"
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Storage Type *
            </label>
            <select
              value={newCategory.storage_type}
              onChange={(e) => setNewCategory({
                ...newCategory, 
                storage_type: e.target.value as 'array' | 'jsonb_array' | 'text'
              })}
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white font-semibold transition-all hover:border-gray-500 cursor-pointer"
              required
            >
              <option value="jsonb_array">JSONB Array (for nested in tags.*)</option>
              <option value="array">Array (for direct fields)</option>
              <option value="text">Text (for notes/descriptions)</option>
            </select>
            <div className="mt-3 p-4 bg-blue-900/50 border-2 border-blue-600 rounded-lg">
              <p className="text-sm text-blue-300 leading-relaxed">
                <span className="font-bold">Array:</span> Direct database field (e.g., industries)<br/>
                <span className="font-bold">JSONB Array:</span> Nested in tags field (e.g., tags.style)<br/>
                <span className="font-bold">Text:</span> Single text field (e.g., notes)
              </p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Storage Path *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              {newCategory.storage_type === 'jsonb_array' 
                ? '💡 Use format: tags.your_category_key' 
                : '💡 Use format: your_category_key'}
            </p>
            <input
              type="text"
              value={newCategory.storage_path}
              onChange={(e) => setNewCategory({...newCategory, storage_path: e.target.value})}
              placeholder={
                newCategory.storage_type === 'jsonb_array' 
                  ? 'tags.color_palette' 
                  : 'color_palette'
              }
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Search Weight *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              🔍 1-10, higher = more important in search
            </p>
            <input
              type="number"
              min="1"
              max="10"
              value={newCategory.search_weight}
              onChange={(e) => setNewCategory({
                ...newCategory, 
                search_weight: parseInt(e.target.value)
              })}
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Description
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <textarea
              value={newCategory.description}
              onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              placeholder="What this category is for..."
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500 resize-none"
              rows={2}
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Placeholder
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={newCategory.placeholder}
              onChange={(e) => setNewCategory({...newCategory, placeholder: e.target.value})}
              placeholder="e.g., warm, cool, vibrant..."
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
            />
          </div>
          </form>
        </div>
          
        {/* Footer */}
        <div className="px-8 py-6 bg-gray-900 rounded-b-2xl border-t-2 border-gray-700">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 border-2 border-gray-600 text-white rounded-lg hover:bg-gray-600 hover:border-gray-500 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-category-form"
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 hover:shadow-lg transition-all font-semibold"
            >
              ✓ Add Category
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Edit Category Modal
interface EditCategoryModalProps {
  category: VocabularyCategory
  onClose: () => void
  onSave: (categoryKey: string, updates: Partial<VocabularyCategory>) => void
}

function EditCategoryModal({ category, onClose, onSave }: EditCategoryModalProps) {
  const [label, setLabel] = useState(category.label)
  const [description, setDescription] = useState(category.description || '')
  const [placeholder, setPlaceholder] = useState(category.placeholder || '')
  const [searchWeight, setSearchWeight] = useState(category.search_weight)

  const handleSave = async () => {
    await onSave(category.key, {
      label,
      description: description || undefined,
      placeholder: placeholder || undefined,
      search_weight: searchWeight
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl max-w-3xl w-full shadow-2xl border-2 border-gray-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b-2 border-gray-700">
          <h2 className="text-3xl font-bold text-white">✏️ Edit Category</h2>
          <p className="text-gray-300 mt-2">Update properties for "{category.label}"</p>
        </div>

        {/* Info Banner */}
        <div className="px-8 pt-6">
          <div className="p-4 bg-yellow-900/50 border-2 border-yellow-600 rounded-lg">
            <p className="text-sm text-yellow-300 font-medium">
              <span className="font-bold">⚠️ Note:</span> Key, storage type, and storage path are read-only to protect existing data integrity.
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
          {/* Read-only Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 border-b-2 border-gray-700">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                Category Key
              </label>
              <div className="px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-gray-400 font-mono text-sm">
                {category.key}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                Storage Type
              </label>
              <div className="px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-gray-400 text-sm">
                {category.storage_type}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                Storage Path
              </label>
              <div className="px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-gray-400 font-mono text-sm">
                {category.storage_path}
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Display Label *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Search Weight *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              🔍 1-10, higher = more important in search
            </p>
            <input
              type="number"
              min="1"
              max="10"
              value={searchWeight}
              onChange={(e) => setSearchWeight(parseInt(e.target.value))}
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white transition-all hover:border-gray-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Description
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this category is for..."
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500 resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Placeholder
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="e.g., warm, cool, vibrant..."
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-900 rounded-b-2xl border-t-2 border-gray-700">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 border-2 border-gray-600 text-white rounded-lg hover:bg-gray-600 hover:border-gray-500 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 hover:shadow-lg transition-all font-semibold"
            >
              ✓ Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
