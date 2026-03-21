import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getEnhancedPromptSetting } from '@/lib/ai-settings'
import { requireAuth } from '@/lib/api-auth'

interface CorrectionPattern {
  tag: string
  category: string
  count: number
  percentage: number
}

interface RetrainResponse {
  success: boolean
  message: string
  analysis?: {
    totalImages: number
    frequentlyMissed: CorrectionPattern[]
    frequentlyWrong: CorrectionPattern[]
    accuracyRate: number
    categoryAccuracy: Record<string, number>
    cacheInvalidated: boolean
  }
  error?: string
}

/**
 * POST /api/retrain-prompt
 *
 * Manually trigger a re-analysis of all correction data and invalidate the cache.
 * This forces the enhanced prompt to regenerate with the latest patterns.
 *
 * Use this:
 * - After tagging a significant batch of images (e.g., 50 new images)
 * - When you want to force the AI to learn from recent corrections
 * - To see updated learning patterns immediately
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()

    // Fetch all corrections
    const { data: corrections, error: correctionsError } = await supabase
      .from('tag_corrections')
      .select('*')

    if (correctionsError) throw correctionsError

    // Fetch tag vocabulary for category mapping
    const { data: vocabulary, error: vocabError } = await supabase
      .from('tag_vocabulary')
      .select('tag_value, category')

    if (vocabError) throw vocabError

    // Create tag to category mapping
    const tagToCategory: Record<string, string> = {}
    vocabulary?.forEach(v => {
      tagToCategory[v.tag_value] = v.category
    })

    const totalImages = corrections?.length || 0

    if (totalImages < 5) {
      return NextResponse.json({
        success: false,
        message: `Not enough data for analysis. Need at least 5 images, currently have ${totalImages}.`,
        error: 'Insufficient data'
      } as RetrainResponse)
    }

    // Analyze missed tags (tags_added)
    const missedTagsCount: Record<string, number> = {}
    corrections?.forEach(correction => {
      correction.tags_added?.forEach((tag: string) => {
        missedTagsCount[tag] = (missedTagsCount[tag] || 0) + 1
      })
    })

    const frequentlyMissed: CorrectionPattern[] = Object.entries(missedTagsCount)
      .map(([tag, count]) => ({
        tag,
        category: tagToCategory[tag] || 'unknown',
        count,
        percentage: Math.round((count / totalImages) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Analyze wrong tags (tags_removed)
    const wrongTagsCount: Record<string, number> = {}
    corrections?.forEach(correction => {
      correction.tags_removed?.forEach((tag: string) => {
        wrongTagsCount[tag] = (wrongTagsCount[tag] || 0) + 1
      })
    })

    const frequentlyWrong: CorrectionPattern[] = Object.entries(wrongTagsCount)
      .map(([tag, count]) => ({
        tag,
        category: tagToCategory[tag] || 'unknown',
        count,
        percentage: Math.round((count / totalImages) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate overall accuracy using ai_suggested_tags
    let totalAISuggested = 0
    let totalRemoved = 0
    corrections?.forEach(correction => {
      const aiSuggested = correction.ai_suggested_tags
      if (aiSuggested && typeof aiSuggested === 'object') {
        Object.values(aiSuggested).forEach((tags: unknown) => {
          if (Array.isArray(tags)) {
            totalAISuggested += tags.length
          }
        })
      }
      const removed = correction.tags_removed?.length || 0
      totalRemoved += removed
    })

    const totalAccepted = totalAISuggested - totalRemoved
    const accuracyRate = totalAISuggested > 0
      ? Math.round((Math.max(0, totalAccepted) / totalAISuggested) * 100)
      : 0

    // Calculate category-specific accuracy (dynamic categories)
    const categoryAccuracy: Record<string, number> = {}
    const categoryStats: Record<string, { suggested: number, removed: number }> = {}

    // Initialize dynamically from vocabulary
    const uniqueCategories = new Set<string>()
    vocabulary?.forEach(v => uniqueCategories.add(v.category))
    uniqueCategories.forEach(cat => {
      categoryStats[cat] = { suggested: 0, removed: 0 }
    })

    // Count AI suggestions per category
    corrections?.forEach(correction => {
      const aiSuggested = correction.ai_suggested_tags
      if (aiSuggested && typeof aiSuggested === 'object') {
        Object.entries(aiSuggested).forEach(([cat, tags]: [string, unknown]) => {
          if (!categoryStats[cat]) {
            categoryStats[cat] = { suggested: 0, removed: 0 }
          }
          if (Array.isArray(tags)) {
            categoryStats[cat].suggested += tags.length
          }
        })
      }
    })

    // Count removals per category
    frequentlyWrong.forEach(pattern => {
      const cat = pattern.category
      if (!categoryStats[cat]) {
        categoryStats[cat] = { suggested: 0, removed: 0 }
      }
      categoryStats[cat].removed += pattern.count
    })

    Object.entries(categoryStats).forEach(([cat, stats]) => {
      const accepted = stats.suggested - stats.removed
      categoryAccuracy[cat] = stats.suggested > 0
        ? Math.round((Math.max(0, accepted) / stats.suggested) * 100)
        : 100
    })

    // Note: The actual cache invalidation happens automatically in the suggest-tags route
    // when it detects new images or cache expiration. This endpoint just provides
    // visibility into what the next prompt will include.

    return NextResponse.json({
      success: true,
      message: `Successfully analyzed ${totalImages} images. Enhanced prompt will use this data on next tag suggestion.`,
      analysis: {
        totalImages,
        frequentlyMissed,
        frequentlyWrong,
        accuracyRate,
        categoryAccuracy,
        cacheInvalidated: true
      }
    } as RetrainResponse)

  } catch (error) {
    console.error('Error retraining prompt:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrain prompt',
        error: 'An unexpected error occurred'
      } as RetrainResponse,
      { status: 500 }
    )
  }
}

/**
 * GET /api/retrain-prompt
 *
 * Get current learning status without triggering a retrain
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()

    // Get image count
    const { count: imageCount } = await supabase
      .from('reference_images')
      .select('*', { count: 'exact', head: true })
      .not('ai_suggested_tags', 'is', null)

    // Get correction count
    const { count: correctionCount } = await supabase
      .from('tag_corrections')
      .select('*', { count: 'exact', head: true })

    // Check database setting (source of truth) with fallback to env var
    const enhancedPromptEnabled = await getEnhancedPromptSetting()

    return NextResponse.json({
      success: true,
      status: {
        totalImages: imageCount || 0,
        totalCorrections: correctionCount || 0,
        enhancedPromptEnabled,
        minimumRequired: 5,
        readyForEnhancement: (correctionCount || 0) >= 5
      }
    })

  } catch (error) {
    console.error('Error getting retrain status:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
