import { createServerClient } from '@/lib/supabase'
import DashboardClient from '@/components/tagger/DashboardClient'
import SignOutButton from '@/components/tagger/SignOutButton'

// Disable caching - always fetch fresh data
export const revalidate = 0
export const dynamic = 'force-dynamic'

// Get server-side Supabase client
const supabaseAdmin = createServerClient()

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

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Get image counts by status
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('reference_images')
      .select('status, tagged_at')

    if (imagesError) throw imagesError

    const imageCounts = {
      total: images?.length || 0,
      pending: images?.filter(img => img.status === 'pending').length || 0,
      tagged: images?.filter(img => img.status === 'tagged').length || 0,
      approved: images?.filter(img => img.status === 'approved').length || 0,
      skipped: images?.filter(img => img.status === 'skipped').length || 0
    }

    // Get vocabulary stats (dynamic categories)
    const { data: vocab, error: vocabError } = await supabaseAdmin
      .from('tag_vocabulary')
      .select('category, times_used')

    if (vocabError) throw vocabError

    // Build byCategory dynamically
    const byCategory: Record<string, number> = {}
    vocab?.forEach(v => {
      if (!byCategory[v.category]) {
        byCategory[v.category] = 0
      }
      byCategory[v.category]++
    })

    const vocabStats = {
      total: vocab?.length || 0,
      byCategory,
      neverUsed: vocab?.filter(v => v.times_used === 0).length || 0
    }

    // Get AI accuracy stats from corrections
    const { data: corrections, error: correctionsError } = await supabaseAdmin
      .from('tag_corrections')
      .select('tags_added, tags_removed')

    let aiAccuracy = undefined
    if (!correctionsError && corrections && corrections.length > 0) {
      const totalAdded = corrections.reduce((sum, c) => sum + (c.tags_added?.length || 0), 0)
      const totalRemoved = corrections.reduce((sum, c) => sum + (c.tags_removed?.length || 0), 0)

      aiAccuracy = {
        totalCorrections: corrections.length,
        averageTagsAdded: corrections.length > 0 ? totalAdded / corrections.length : 0,
        averageTagsRemoved: corrections.length > 0 ? totalRemoved / corrections.length : 0
      }
    }

    // Get last tagged timestamp
    const lastTaggedAt = images
      ?.filter(img => img.tagged_at)
      .sort((a, b) => new Date(b.tagged_at).getTime() - new Date(a.tagged_at).getTime())[0]?.tagged_at || null

    // Get recent images (select all fields, let client handle display)
    const { data: recentImages, error: recentError } = await supabaseAdmin
      .from('reference_images')
      .select('id, thumbnail_path, original_filename, tagged_at, tags')
      .in('status', ['tagged', 'approved'])
      .order('tagged_at', { ascending: false })
      .limit(10)

    if (recentError) throw recentError

    return {
      images: imageCounts,
      vocabulary: vocabStats,
      aiAccuracy,
      lastTaggedAt,
      recentImages: recentImages || []
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    // Return empty stats on error
    return {
      images: { total: 0, pending: 0, tagged: 0, approved: 0, skipped: 0 },
      vocabulary: {
        total: 0,
        byCategory: {},
        neverUsed: 0
      },
      lastTaggedAt: null,
      recentImages: []
    }
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Sign Out Button */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Reference Image Tagger</h1>
            <p className="text-gray-300 font-medium">
              Manage your design reference library with AI-powered tagging
            </p>
          </div>
          <SignOutButton />
        </div>

        <DashboardClient stats={stats} />
      </div>
    </div>
  )
}
