'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface DashboardStats {
  images: {
    total: number
    pending: number
    tagged: number
    approved: number
    skipped: number
  }
  vocabulary: {
    total: number
    byCategory: {
      industry: number
      project_type: number
      style: number
      mood: number
      elements: number
    }
    neverUsed: number
  }
  aiAccuracy?: {
    totalCorrections: number
    averageTagsAdded: number
    averageTagsRemoved: number
  }
  lastTaggedAt: string | null
  recentImages: Array<{
    id: string
    thumbnail_path: string
    original_filename: string
    tagged_at: string
    industries: string[]
    project_types: string[]
  }>
}

interface DashboardClientProps {
  stats: DashboardStats
}

export default function DashboardClient({ stats }: DashboardClientProps) {
  const router = useRouter()
  const [showAdminControls, setShowAdminControls] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState('')
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [duplicates, setDuplicates] = useState<Array<{ filename: string; images: any[] }>>([])
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false)

  const handleDeleteAllImages = async () => {
    if (deleteConfirmation !== 'DELETE') {
      alert('Please type DELETE to confirm')
      return
    }

    setIsDeleting(true)
    setDeleteProgress('Starting deletion...')

    try {
      // 1. Get all images to delete their storage files
      setDeleteProgress('Fetching images...')
      const { data: images, error: fetchError } = await supabase
        .from('reference_images')
        .select('id, storage_path, thumbnail_path')

      if (fetchError) throw fetchError

      if (!images || images.length === 0) {
        alert('No images to delete')
        setIsDeleting(false)
        setShowDeleteModal(false)
        return
      }

      // 2. Delete storage files
      setDeleteProgress(`Deleting ${images.length} images from storage...`)

      const originalPaths = images
        .map(img => {
          const url = new URL(img.storage_path)
          const path = url.pathname.split('/reference-images/')[1]
          return path
        })
        .filter(Boolean)

      const thumbnailPaths = images
        .map(img => {
          const url = new URL(img.thumbnail_path)
          const path = url.pathname.split('/reference-images/')[1]
          return path
        })
        .filter(Boolean)

      // Delete originals
      if (originalPaths.length > 0) {
        const { error: deleteOriginalsError } = await supabase.storage
          .from('reference-images')
          .remove(originalPaths)

        if (deleteOriginalsError) {
          console.error('Error deleting originals:', deleteOriginalsError)
        }
      }

      // Delete thumbnails
      if (thumbnailPaths.length > 0) {
        const { error: deleteThumbnailsError } = await supabase.storage
          .from('reference-images')
          .remove(thumbnailPaths)

        if (deleteThumbnailsError) {
          console.error('Error deleting thumbnails:', deleteThumbnailsError)
        }
      }

      // 3. Delete tag corrections
      setDeleteProgress('Deleting tag corrections...')
      const { error: correctionsError } = await supabase
        .from('tag_corrections')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

      if (correctionsError) {
        console.error('Error deleting corrections:', correctionsError)
      }

      // 4. Delete reference images
      setDeleteProgress('Deleting database records...')
      const { error: imagesError } = await supabase
        .from('reference_images')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

      if (imagesError) throw imagesError

      // 5. Reset tag vocabulary usage counts
      setDeleteProgress('Resetting vocabulary usage counts...')
      const { error: resetError } = await supabase
        .from('tag_vocabulary')
        .update({ times_used: 0, last_used_at: null })
        .neq('id', '00000000-0000-0000-0000-000000000000') // Update all rows

      if (resetError) throw resetError

      setDeleteProgress('All test data cleared successfully!')

      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Close modal and refresh page
      setShowDeleteModal(false)
      setDeleteConfirmation('')
      router.refresh()

    } catch (error) {
      console.error('Error deleting all images:', error)
      alert(`Failed to delete all images: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDeleting(false)
      setDeleteProgress('')
    }
  }

  const handleFindDuplicates = async () => {
    setIsLoadingDuplicates(true)
    setShowDuplicates(true)

    try {
      const { data: images, error } = await supabase
        .from('reference_images')
        .select('id, original_filename, thumbnail_path, tagged_at')
        .order('tagged_at', { ascending: true })

      if (error) throw error

      // Group by filename
      const grouped = images?.reduce((acc, img) => {
        const filename = img.original_filename
        if (!acc[filename]) {
          acc[filename] = []
        }
        acc[filename].push(img)
        return acc
      }, {} as Record<string, any[]>) || {}

      // Filter to only duplicates (more than 1 image with same filename)
      const dupes = Object.entries(grouped)
        .filter(([_, imgs]) => imgs.length > 1)
        .map(([filename, imgs]) => ({ filename, images: imgs }))

      setDuplicates(dupes)
    } catch (error) {
      console.error('Error finding duplicates:', error)
      alert('Failed to find duplicates')
    } finally {
      setIsLoadingDuplicates(false)
    }
  }

  const handleDeleteDuplicate = async (imageId: string, storagePath: string, thumbnailPath: string) => {
    try {
      // Delete from storage
      const originalUrl = new URL(storagePath)
      const originalPath = originalUrl.pathname.split('/reference-images/')[1]

      const thumbnailUrl = new URL(thumbnailPath)
      const thumbPath = thumbnailUrl.pathname.split('/reference-images/')[1]

      await supabase.storage.from('reference-images').remove([originalPath, thumbPath])

      // Delete from database
      await supabase.from('reference_images').delete().eq('id', imageId)

      // Update local state
      setDuplicates(prev => {
        const updated = prev.map(dup => ({
          ...dup,
          images: dup.images.filter(img => img.id !== imageId)
        })).filter(dup => dup.images.length > 1) // Remove if no longer duplicate

        return updated
      })

      router.refresh()
    } catch (error) {
      console.error('Error deleting duplicate:', error)
      alert('Failed to delete duplicate')
    }
  }

  const handleExportTestData = async () => {
    try {
      // Fetch vocabulary
      const { data: vocab } = await supabase
        .from('tag_vocabulary')
        .select('*')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

      // Fetch sample images (5 random)
      const { data: images } = await supabase
        .from('reference_images')
        .select('*')
        .in('status', ['tagged', 'approved'])
        .limit(5)

      const exportData = {
        exported_at: new Date().toISOString(),
        vocabulary: vocab || [],
        sample_images: images || [],
        stats: stats
      }

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tagger-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Failed to export data')
    }
  }

  const handleResetVocabulary = async () => {
    if (!confirm('⚠️ This will delete all custom tags and reset to the original mock vocabulary. Continue?')) {
      return
    }

    try {
      // Delete all existing vocabulary
      await supabase
        .from('tag_vocabulary')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      // Re-insert mock vocabulary
      const mockVocabulary = [
        // Industries
        { category: 'industry', tag_value: 'restaurant', sort_order: 1 },
        { category: 'industry', tag_value: 'hospitality', sort_order: 2 },
        { category: 'industry', tag_value: 'retail', sort_order: 3 },
        { category: 'industry', tag_value: 'tech', sort_order: 4 },
        { category: 'industry', tag_value: 'fashion', sort_order: 5 },
        { category: 'industry', tag_value: 'healthcare', sort_order: 6 },
        { category: 'industry', tag_value: 'real-estate', sort_order: 7 },
        { category: 'industry', tag_value: 'finance', sort_order: 8 },
        { category: 'industry', tag_value: 'education', sort_order: 9 },
        { category: 'industry', tag_value: 'entertainment', sort_order: 10 },

        // Project Types
        { category: 'project_type', tag_value: 'branding', sort_order: 1 },
        { category: 'project_type', tag_value: 'website', sort_order: 2 },
        { category: 'project_type', tag_value: 'packaging', sort_order: 3 },
        { category: 'project_type', tag_value: 'social-media', sort_order: 4 },
        { category: 'project_type', tag_value: 'print', sort_order: 5 },
        { category: 'project_type', tag_value: 'interior', sort_order: 6 },
        { category: 'project_type', tag_value: 'signage', sort_order: 7 },
        { category: 'project_type', tag_value: 'app-design', sort_order: 8 },

        // Styles
        { category: 'style', tag_value: 'minimalist', sort_order: 1 },
        { category: 'style', tag_value: 'modern', sort_order: 2 },
        { category: 'style', tag_value: 'vintage', sort_order: 3 },
        { category: 'style', tag_value: 'rustic', sort_order: 4 },
        { category: 'style', tag_value: 'industrial', sort_order: 5 },
        { category: 'style', tag_value: 'elegant', sort_order: 6 },
        { category: 'style', tag_value: 'playful', sort_order: 7 },
        { category: 'style', tag_value: 'editorial', sort_order: 8 },
        { category: 'style', tag_value: 'brutalist', sort_order: 9 },
        { category: 'style', tag_value: 'geometric', sort_order: 10 },
        { category: 'style', tag_value: 'organic', sort_order: 11 },
        { category: 'style', tag_value: 'sophisticated', sort_order: 12 },

        // Moods
        { category: 'mood', tag_value: 'calm', sort_order: 1 },
        { category: 'mood', tag_value: 'energetic', sort_order: 2 },
        { category: 'mood', tag_value: 'luxury', sort_order: 3 },
        { category: 'mood', tag_value: 'casual', sort_order: 4 },
        { category: 'mood', tag_value: 'professional', sort_order: 5 },
        { category: 'mood', tag_value: 'warm', sort_order: 6 },
        { category: 'mood', tag_value: 'cool', sort_order: 7 },
        { category: 'mood', tag_value: 'inviting', sort_order: 8 },
        { category: 'mood', tag_value: 'bold', sort_order: 9 },
        { category: 'mood', tag_value: 'serene', sort_order: 10 },
        { category: 'mood', tag_value: 'sophisticated', sort_order: 11 },

        // Elements
        { category: 'elements', tag_value: 'typography-heavy', sort_order: 1 },
        { category: 'elements', tag_value: 'photography', sort_order: 2 },
        { category: 'elements', tag_value: 'illustration', sort_order: 3 },
        { category: 'elements', tag_value: 'gradient', sort_order: 4 },
        { category: 'elements', tag_value: 'pattern', sort_order: 5 },
        { category: 'elements', tag_value: 'texture', sort_order: 6 },
        { category: 'elements', tag_value: 'minimal-text', sort_order: 7 },
        { category: 'elements', tag_value: 'hand-drawn', sort_order: 8 },
        { category: 'elements', tag_value: 'abstract', sort_order: 9 },
        { category: 'elements', tag_value: 'geometric-shapes', sort_order: 10 },
        { category: 'elements', tag_value: 'natural-materials', sort_order: 11 },
        { category: 'elements', tag_value: 'high-contrast', sort_order: 12 }
      ].map(tag => ({
        ...tag,
        is_active: true,
        times_used: 0,
        last_used_at: null,
        added_by: null,
        description: null
      }))

      const { error } = await supabase
        .from('tag_vocabulary')
        .insert(mockVocabulary)

      if (error) throw error

      alert('Vocabulary reset to original mock data')
      router.refresh()
    } catch (error) {
      console.error('Error resetting vocabulary:', error)
      alert('Failed to reset vocabulary')
    }
  }

  const estimatedStorage = stats.images.total * 2.5 // Rough estimate: 2.5MB per image (original + thumbnail)

  return (
    <div className="space-y-12">
      {/* Overview Stats */}
      <div>
        <h2 className="text-3xl font-bold text-gray-50 mb-6">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Images */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Images</div>
            <div className="text-5xl font-bold text-gray-900 mb-4">{stats.images.total}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending:</span>
                <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{stats.images.pending}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tagged:</span>
                <span className="font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">{stats.images.tagged}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Approved:</span>
                <span className="font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{stats.images.approved}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Skipped:</span>
                <span className="font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">{stats.images.skipped}</span>
              </div>
            </div>
          </div>

          {/* Vocabulary */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Tag Vocabulary</div>
            <div className="text-5xl font-bold text-gray-900 mb-4">{stats.vocabulary.total}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Industries:</span>
                <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{stats.vocabulary.byCategory.industry}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Project Types:</span>
                <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{stats.vocabulary.byCategory.project_type}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Styles:</span>
                <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{stats.vocabulary.byCategory.style}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Never Used:</span>
                <span className="font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{stats.vocabulary.neverUsed}</span>
              </div>
            </div>
          </div>

          {/* AI Accuracy */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">AI Accuracy</div>
            {stats.aiAccuracy ? (
              <>
                <div className="text-5xl font-bold text-blue-600 mb-4">
                  {((1 - (stats.aiAccuracy.averageTagsRemoved / 5)) * 100).toFixed(0)}%
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Corrections:</span>
                    <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{stats.aiAccuracy.totalCorrections}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg Added:</span>
                    <span className="font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                      {stats.aiAccuracy.averageTagsAdded.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg Removed:</span>
                    <span className="font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      {stats.aiAccuracy.averageTagsRemoved.toFixed(1)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400 italic pt-4">No AI data yet</div>
            )}
          </div>

          {/* Storage & Activity */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Storage Used</div>
            <div className="text-5xl font-bold text-gray-900 mb-1">
              {estimatedStorage.toFixed(0)}
              <span className="text-2xl text-gray-500 ml-2">MB</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Last Tagged</div>
              <div className="text-sm text-gray-700">
                {stats.lastTaggedAt
                  ? new Date(stats.lastTaggedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                  : <span className="text-gray-400 italic">No images tagged yet</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-3xl font-bold text-gray-50 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/tagger"
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 p-8 group"
          >
            <div className="text-4xl mb-4">🏷️</div>
            <div className="font-bold text-xl mb-2">Start Tagging</div>
            <div className="text-sm text-blue-50 opacity-90">Tag new reference images with AI assistance</div>
          </Link>

          <Link
            href="/tagger/gallery"
            className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 p-8 group"
          >
            <div className="text-4xl mb-4">🖼️</div>
            <div className="font-bold text-xl mb-2">View Gallery</div>
            <div className="text-sm text-green-50 opacity-90">Browse {stats.images.tagged + stats.images.approved} tagged images</div>
          </Link>

          <Link
            href="/tagger/vocabulary"
            className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 p-8 group"
          >
            <div className="text-4xl mb-4">📚</div>
            <div className="font-bold text-xl mb-2">Manage Vocabulary</div>
            <div className="text-sm text-purple-50 opacity-90">Edit tags and categories</div>
          </Link>

          <Link
            href="/tagger/vocabulary-config"
            className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 p-8 group"
          >
            <div className="text-4xl mb-4">⚙️</div>
            <div className="font-bold text-xl mb-2">Vocabulary Config</div>
            <div className="text-sm text-pink-50 opacity-90">Manage vocabulary structure</div>
          </Link>

          <Link
            href="/tagger/ai-analytics"
            className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 p-8 group"
          >
            <div className="text-4xl mb-4">🤖</div>
            <div className="font-bold text-xl mb-2">AI Analytics</div>
            <div className="text-sm text-orange-50 opacity-90">View AI learning and performance</div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      {stats.recentImages.length > 0 && (
        <div>
          <h2 className="text-3xl font-bold text-gray-50 mb-6">Recent Activity</h2>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {stats.recentImages.map(image => (
                <Link
                  key={image.id}
                  href="/tagger/gallery"
                  className="group"
                >
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3 shadow-sm group-hover:shadow-md transition-shadow">
                    <img
                      src={image.thumbnail_path}
                      alt={image.original_filename}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-800 truncate mb-1">{image.original_filename}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(image.tagged_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Controls */}
      <div>
        <button
          onClick={() => setShowAdminControls(!showAdminControls)}
          className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium mb-4"
        >
          <span className="text-xl">⚙️</span>
          <span>Admin Controls (Test Phase)</span>
          <span className="text-sm">{showAdminControls ? '▼' : '▶'}</span>
        </button>

        {showAdminControls && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-2 text-red-800 mb-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-semibold">Danger Zone</div>
                <div className="text-sm text-red-700">
                  These actions are irreversible. Use with caution.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Delete All Images */}
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={stats.images.total === 0}
                className="bg-red-600 text-white rounded-lg p-4 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="font-semibold mb-1">Delete All Images</div>
                <div className="text-sm text-red-100">
                  Remove all {stats.images.total} images and reset usage counts
                </div>
              </button>

              {/* Find Duplicates */}
              <button
                onClick={handleFindDuplicates}
                disabled={stats.images.total === 0}
                className="bg-orange-600 text-white rounded-lg p-4 hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="font-semibold mb-1">Find Duplicates</div>
                <div className="text-sm text-orange-100">
                  Detect and remove duplicate images by filename
                </div>
              </button>

              {/* Export Test Data */}
              <button
                onClick={handleExportTestData}
                className="bg-blue-600 text-white rounded-lg p-4 hover:bg-blue-700 transition-colors text-left"
              >
                <div className="font-semibold mb-1">Export Test Data</div>
                <div className="text-sm text-blue-100">
                  Download backup of vocabulary and sample images
                </div>
              </button>

              {/* Reset Vocabulary */}
              <button
                onClick={handleResetVocabulary}
                className="bg-purple-600 text-white rounded-lg p-4 hover:bg-purple-700 transition-colors text-left"
              >
                <div className="font-semibold mb-1">Reset Vocabulary to Mock</div>
                <div className="text-sm text-purple-100">
                  Clear custom tags and restore original vocabulary
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete All Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-2xl font-bold text-red-600 mb-2">Delete All Images?</h3>
              <p className="text-gray-600">
                This will permanently delete all <span className="font-bold">{stats.images.total} images</span> from
                storage and database. This cannot be undone.
              </p>
            </div>

            {deleteProgress ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <div className="text-sm text-blue-800">{deleteProgress}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    disabled={isDeleting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteConfirmation('')
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllImages}
                    disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Everything'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Duplicates Modal */}
      {showDuplicates && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">
                Duplicate Images {duplicates.length > 0 && `(${duplicates.length})`}
              </h3>
              <button
                onClick={() => setShowDuplicates(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {isLoadingDuplicates ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Scanning for duplicates...</p>
                </div>
              ) : duplicates.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <p className="text-xl font-semibold text-gray-900 mb-2">No duplicates found!</p>
                  <p className="text-gray-600">All images have unique filenames.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {duplicates.map(dup => (
                    <div key={dup.filename} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="font-semibold text-gray-900 mb-3">
                        {dup.filename} ({dup.images.length} copies)
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {dup.images.map((img, idx) => (
                          <div key={img.id} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="aspect-square bg-gray-100 rounded overflow-hidden mb-2">
                              <img
                                src={img.thumbnail_path}
                                alt={img.original_filename}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              {idx === 0 ? 'Original' : `Duplicate ${idx}`}
                              <br />
                              {new Date(img.tagged_at).toLocaleDateString()}
                            </div>
                            {idx > 0 && (
                              <button
                                onClick={() => handleDeleteDuplicate(img.id, img.storage_path, img.thumbnail_path)}
                                className="w-full px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
