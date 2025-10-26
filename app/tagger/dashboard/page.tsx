import { createServerClient } from '@/lib/supabase'
import DashboardClient from '@/components/tagger/DashboardClient'
import SignOutButton from '@/components/tagger/SignOutButton'

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

    // Get vocabulary stats
    const { data: vocab, error: vocabError } = await supabaseAdmin
      .from('tag_vocabulary')
      .select('category, times_used')

    if (vocabError) throw vocabError

    const vocabStats = {
      total: vocab?.length || 0,
      byCategory: {
        industry: vocab?.filter(v => v.category === 'industry').length || 0,
        project_type: vocab?.filter(v => v.category === 'project_type').length || 0,
        style: vocab?.filter(v => v.category === 'style').length || 0,
        mood: vocab?.filter(v => v.category === 'mood').length || 0,
        elements: vocab?.filter(v => v.category === 'elements').length || 0
      },
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

    // Get recent images
    const { data: recentImages, error: recentError } = await supabaseAdmin
      .from('reference_images')
      .select('id, thumbnail_path, original_filename, tagged_at, industries, project_types')
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
        byCategory: { industry: 0, project_type: 0, style: 0, mood: 0, elements: 0 },
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
    <div className="min-h-screen bg-custom-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Sign Out Button */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-50 mb-2">Reference Image Tagger</h1>
            <p className="text-gray-600">
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
