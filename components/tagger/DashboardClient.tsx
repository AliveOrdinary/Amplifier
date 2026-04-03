'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'
import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'
import { useToast, useConfirmDialog } from '@/components/ui'
import Link from 'next/link'
import Image from 'next/image'

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
    byCategory: Record<string, number>
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
    tags: Record<string, any>
  }>
}

interface DashboardClientProps {
  stats: DashboardStats
}

export default function DashboardClient({ stats }: DashboardClientProps) {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const toast = useToast()
  const { confirmDialog, showConfirm } = useConfirmDialog()
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
      alert('Please type "DELETE" in all caps to confirm this destructive action.')
      return
    }

    setIsDeleting(true)
    setDeleteProgress('Starting deletion...')

    try {
      const response = await fetch('/api/admin/delete-all-images', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete images')
      }

      if (data.deletedCount === 0) {
        alert('No images found to delete. The database is already empty.')
        setShowDeleteModal(false)
        setDeleteConfirmation('')
        return
      }

      setDeleteProgress(`Successfully deleted ${data.deletedCount} images!`)

      await new Promise(resolve => setTimeout(resolve, 1500))

      setShowDeleteModal(false)
      setDeleteConfirmation('')
      router.refresh()

    } catch (error) {
      console.error('Error deleting all images:', error)
      alert(getErrorMessage(error, ErrorMessages.DELETE_ALL_IMAGES_FAILED))
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

      const grouped = images?.reduce((acc, img) => {
        const filename = img.original_filename
        if (!acc[filename]) {
          acc[filename] = []
        }
        acc[filename].push(img)
        return acc
      }, {} as Record<string, any[]>) || {}

      const dupes = Object.entries(grouped)
        .filter(([, imgs]) => imgs.length > 1)
        .map(([filename, imgs]) => ({ filename, images: imgs }))

      setDuplicates(dupes)
    } catch (error) {
      console.error('Error finding duplicates:', error)
      alert(getErrorMessage(error, ErrorMessages.DUPLICATE_DETECTION_FAILED))
    } finally {
      setIsLoadingDuplicates(false)
    }
  }

  const handleDeleteDuplicate = async (imageId: string, storagePath: string, thumbnailPath: string) => {
    try {
      const originalUrl = new URL(storagePath)
      const originalPath = originalUrl.pathname.split('/reference-images/')[1]

      const thumbnailUrl = new URL(thumbnailPath)
      const thumbPath = thumbnailUrl.pathname.split('/reference-images/')[1]

      await supabase.storage.from('reference-images').remove([originalPath, thumbPath])

      await supabase.from('reference_images').delete().eq('id', imageId)

      setDuplicates(prev => {
        const updated = prev.map(dup => ({
          ...dup,
          images: dup.images.filter(img => img.id !== imageId)
        })).filter(dup => dup.images.length > 1)

        return updated
      })

      router.refresh()
    } catch (error) {
      console.error('Error deleting duplicate:', error)
      alert(getErrorMessage(error, ErrorMessages.IMAGE_DELETE_FAILED))
    }
  }

  const handleExportTestData = async () => {
    try {
      const { data: vocab } = await supabase
        .from('tag_vocabulary')
        .select('*')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

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
      toast.error('Export failed', getErrorMessage(error, ErrorMessages.EXPORT_DATA_FAILED))
    }
  }

  const handleResetVocabulary = async () => {
    const confirmed = await showConfirm({
      title: 'Reset Vocabulary',
      message: 'This will delete all custom tags and reset to the original mock vocabulary. Continue?',
      confirmText: 'Reset',
      variant: 'danger'
    })

    if (!confirmed) return

    try {
      await supabase
        .from('tag_vocabulary')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      const mockVocabulary = [
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
        { category: 'project_type', tag_value: 'branding', sort_order: 1 },
        { category: 'project_type', tag_value: 'website', sort_order: 2 },
        { category: 'project_type', tag_value: 'packaging', sort_order: 3 },
        { category: 'project_type', tag_value: 'social-media', sort_order: 4 },
        { category: 'project_type', tag_value: 'print', sort_order: 5 },
        { category: 'project_type', tag_value: 'interior', sort_order: 6 },
        { category: 'project_type', tag_value: 'signage', sort_order: 7 },
        { category: 'project_type', tag_value: 'app-design', sort_order: 8 },
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

      alert('Vocabulary reset to original mock data successfully.')
      router.refresh()
    } catch (error) {
      console.error('Error resetting vocabulary:', error)
      alert(getErrorMessage(error, ErrorMessages.RESET_VOCABULARY_FAILED))
    }
  }

  const estimatedStorage = stats.images.total * 2.5

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Images */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
            <div className="text-sm text-gray-400 mb-1">Total Images</div>
            <div className="text-3xl font-semibold text-white mb-3">{stats.images.total}</div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Pending</span>
                <span className="text-white">{stats.images.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tagged</span>
                <span className="text-green-400">{stats.images.tagged}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Approved</span>
                <span className="text-blue-400">{stats.images.approved}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Skipped</span>
                <span className="text-amber-400">{stats.images.skipped}</span>
              </div>
            </div>
          </div>

          {/* Vocabulary */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
            <div className="text-sm text-gray-400 mb-1">Tag Vocabulary</div>
            <div className="text-3xl font-semibold text-white mb-3">{stats.vocabulary.total}</div>
            <div className="space-y-1.5 text-sm max-h-40 overflow-y-auto">
              {Object.entries(stats.vocabulary.byCategory).map(([category, count]) => (
                <div key={category} className="flex justify-between">
                  <span className="text-gray-500 capitalize">{category.replace(/_/g, ' ')}</span>
                  <span className="text-white">{count}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1.5 border-t border-gray-800">
                <span className="text-gray-500">Never Used</span>
                <span className="text-gray-500">{stats.vocabulary.neverUsed}</span>
              </div>
            </div>
          </div>

          {/* AI Accuracy */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
            <div className="text-sm text-gray-400 mb-1">AI Accuracy</div>
            {stats.aiAccuracy ? (
              <>
                <div className="text-3xl font-semibold text-blue-400 mb-3">
                  {((1 - (stats.aiAccuracy.averageTagsRemoved / 5)) * 100).toFixed(0)}%
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Corrections</span>
                    <span className="text-white">{stats.aiAccuracy.totalCorrections}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Added</span>
                    <span className="text-green-400">{stats.aiAccuracy.averageTagsAdded.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Removed</span>
                    <span className="text-red-400">{stats.aiAccuracy.averageTagsRemoved.toFixed(1)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 pt-4">No AI data yet</div>
            )}
          </div>

          {/* Storage & Activity */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
            <div className="text-sm text-gray-400 mb-1">Storage Used</div>
            <div className="text-3xl font-semibold text-white mb-1">
              {estimatedStorage.toFixed(0)}
              <span className="text-lg text-gray-500 ml-1">MB</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="text-xs text-gray-500 mb-1">Last Tagged</div>
              <div className="text-sm text-gray-300">
                {stats.lastTaggedAt
                  ? new Date(stats.lastTaggedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                  : <span className="text-gray-500">No images tagged yet</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {stats.recentImages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {stats.recentImages.map(image => (
                <Link
                  key={image.id}
                  href="/tagger/gallery"
                  className="group"
                >
                  <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden mb-2 relative">
                    <Image
                      src={image.thumbnail_path}
                      alt={image.original_filename}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="text-sm text-white truncate">{image.original_filename}</div>
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
          className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-medium mb-3"
        >
          <span>Admin Controls</span>
          <span className="text-xs">{showAdminControls ? '\u25BC' : '\u25B6'}</span>
        </button>

        {showAdminControls && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
            <div className="text-sm text-gray-400 mb-3">
              These actions are irreversible. Use with caution.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={stats.images.total === 0}
                className="bg-red-900/40 text-red-300 border border-red-800 rounded-lg p-4 hover:bg-red-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="font-medium text-sm mb-1">Delete All Images</div>
                <div className="text-xs text-red-400/70">
                  Remove all {stats.images.total} images and reset usage counts
                </div>
              </button>

              <button
                onClick={handleFindDuplicates}
                disabled={stats.images.total === 0}
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg p-4 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="font-medium text-sm mb-1">Find Duplicates</div>
                <div className="text-xs text-gray-500">
                  Detect and remove duplicate images by filename
                </div>
              </button>

              <button
                onClick={handleExportTestData}
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg p-4 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="font-medium text-sm mb-1">Export Test Data</div>
                <div className="text-xs text-gray-500">
                  Download backup of vocabulary and sample images
                </div>
              </button>

              <button
                onClick={handleResetVocabulary}
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg p-4 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="font-medium text-sm mb-1">Reset Vocabulary</div>
                <div className="text-xs text-gray-500">
                  Clear custom tags and restore original vocabulary
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete All Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-800">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">Delete All Images?</h3>
              <p className="text-sm text-gray-400">
                This will permanently delete all <span className="font-medium text-white">{stats.images.total} images</span> from
                storage and database. This cannot be undone.
              </p>
            </div>

            {deleteProgress ? (
              <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <div className="text-sm text-blue-300">{deleteProgress}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">
                    Type <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-white">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    disabled={isDeleting}
                    className="w-full px-3 py-2 border border-gray-700 bg-gray-950 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-800 placeholder-gray-600 text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteConfirmation('')
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllImages}
                    disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8 border border-gray-800">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Duplicate Images {duplicates.length > 0 && `(${duplicates.length})`}
              </h3>
              <button
                onClick={() => setShowDuplicates(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {isLoadingDuplicates ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">Scanning for duplicates...</p>
                </div>
              ) : duplicates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg font-medium text-white mb-1">No duplicates found</p>
                  <p className="text-sm text-gray-500">All images have unique filenames.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {duplicates.map(dup => (
                    <div key={dup.filename} className="bg-gray-950 rounded-lg p-4 border border-gray-800">
                      <div className="font-medium text-sm text-white mb-3">
                        {dup.filename} ({dup.images.length} copies)
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {dup.images.map((img, idx) => (
                          <div key={img.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                            <div className="aspect-square bg-gray-800 rounded overflow-hidden mb-2 relative">
                              <Image
                                src={img.thumbnail_path}
                                alt={img.original_filename}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                className="object-cover"
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
                                className="w-full px-2 py-1 bg-red-900/40 text-red-300 text-xs rounded border border-red-800 hover:bg-red-900/60"
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

      {confirmDialog}
    </div>
  )
}
