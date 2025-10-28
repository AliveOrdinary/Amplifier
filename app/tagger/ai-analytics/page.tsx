import { createClient } from '@supabase/supabase-js'
import AIAnalyticsClient from '@/components/tagger/AIAnalyticsClient'
import Link from 'next/link'

// Disable caching - always fetch fresh data
export const revalidate = 0
export const dynamic = 'force-dynamic'

// Server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Type definitions
interface TagCategoryStats {
  category: string
  avgSuggestedByAI: number
  avgSelectedByDesigner: number
  accuracy: number
}

interface TagAnalysis {
  tag: string
  category: string
  count: number
  percentage: number
}

interface ConfidenceBucket {
  range: string
  imageCount: number
  avgCorrections: number
  correctionRate: number
}

interface ImageAnalysis {
  id: string
  thumbnail_path: string
  original_filename: string
  ai_confidence_score: number | null
  ai_suggested_tags: any
  actual_tags: Record<string, string[]> // Dynamic categories
  corrections: {
    tags_added: string[]
    tags_removed: string[]
  } | null
  correctionPercentage: number
  tagged_at: string
}

interface VocabularyConfig {
  structure: {
    categories: Array<{
      key: string
      label: string
      storage_path: string
      storage_type: 'array' | 'jsonb_array' | 'text'
      search_weight: number
    }>
  }
}

interface AIAnalytics {
  overallMetrics: {
    totalImagesAnalyzed: number
    averageConfidence: number
    totalCorrections: number
    overallAccuracy: number
    accuracyTrend: 'improving' | 'declining' | 'stable'
    trendPercentage: number
  }
  categoryBreakdown: TagCategoryStats[]
  missedTags: TagAnalysis[]
  wrongTags: TagAnalysis[]
  confidenceBuckets: ConfidenceBucket[]
  imageAnalysis: ImageAnalysis[]
  insights: string[]
  vocabConfig: VocabularyConfig // Add config to pass to client
}

async function getAIAnalytics(): Promise<AIAnalytics> {
  try {
    // Fetch active vocabulary config
    const { data: vocabConfig, error: configError } = await supabaseAdmin
      .from('vocabulary_config')
      .select('*')
      .eq('is_active', true)
      .single()

    if (configError) throw configError

    // Fetch all images with AI suggestions
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('reference_images')
      .select('*')
      .not('ai_suggested_tags', 'is', null)
      .in('status', ['tagged', 'approved'])

    if (imagesError) throw imagesError

    // Fetch all tag corrections
    const { data: corrections, error: correctionsError } = await supabaseAdmin
      .from('tag_corrections')
      .select('*')

    if (correctionsError) throw correctionsError

    // Fetch tag vocabulary for category mapping
    const { data: vocabulary, error: vocabError} = await supabaseAdmin
      .from('tag_vocabulary')
      .select('tag_value, category')

    if (vocabError) throw vocabError

    // Create tag to category mapping
    const tagToCategory: Record<string, string> = {}
    vocabulary?.forEach(v => {
      tagToCategory[v.tag_value] = v.category
    })

    const totalImages = images?.length || 0

    // 1. Calculate Overall Performance Metrics
    const totalCorrections = corrections?.length || 0
    const avgConfidence = totalImages > 0
      ? images!.reduce((sum, img) => sum + (img.ai_confidence_score || 0), 0) / totalImages
      : 0

    // Calculate overall accuracy
    let totalSuggestions = 0
    let totalAccepted = 0
    corrections?.forEach(correction => {
      const added = correction.tags_added?.length || 0
      const removed = correction.tags_removed?.length || 0
      const aiSuggestedCount = added + removed // Total AI suggestions for this image
      totalSuggestions += aiSuggestedCount
      totalAccepted += (aiSuggestedCount - removed) // Suggestions kept (not removed)
    })

    const overallAccuracy = totalSuggestions > 0
      ? (totalAccepted / totalSuggestions) * 100
      : 0

    // Calculate accuracy trend (first 50% vs last 50% of images)
    const sortedImages = [...(images || [])].sort((a, b) =>
      new Date(a.tagged_at).getTime() - new Date(b.tagged_at).getTime()
    )
    const midpoint = Math.floor(sortedImages.length / 2)
    const firstHalfIds = new Set(sortedImages.slice(0, midpoint).map(img => img.id))
    const secondHalfIds = new Set(sortedImages.slice(midpoint).map(img => img.id))

    const firstHalfCorrections = corrections?.filter(c => firstHalfIds.has(c.image_id)) || []
    const secondHalfCorrections = corrections?.filter(c => secondHalfIds.has(c.image_id)) || []

    const calcAccuracy = (corrs: any[]) => {
      let sugs = 0, accepted = 0
      corrs.forEach(c => {
        const added = c.tags_added?.length || 0
        const removed = c.tags_removed?.length || 0
        sugs += added + removed
        accepted += (added + removed - removed)
      })
      return sugs > 0 ? (accepted / sugs) * 100 : 0
    }

    const firstHalfAccuracy = calcAccuracy(firstHalfCorrections)
    const secondHalfAccuracy = calcAccuracy(secondHalfCorrections)
    const trendPercentage = secondHalfAccuracy - firstHalfAccuracy
    const accuracyTrend = Math.abs(trendPercentage) < 5 ? 'stable'
      : trendPercentage > 0 ? 'improving' : 'declining'

    // Helper to get value from image based on storage_path
    const getImageValue = (img: any, storagePath: string): any => {
      if (storagePath.includes('.')) {
        const parts = storagePath.split('.')
        let value: any = img
        for (const part of parts) {
          value = value?.[part]
        }
        return value
      } else {
        return img[storagePath]
      }
    }

    // 2. Tag Category Breakdown (Dynamic)
    const categoryStats: Record<string, { suggested: number[], selected: number[] }> = {}

    // Initialize stats for each category from config
    vocabConfig.structure.categories.forEach(category => {
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        categoryStats[category.key] = { suggested: [], selected: [] }
      }
    })

    images?.forEach(img => {
      const aiSuggested = img.ai_suggested_tags || {}

      vocabConfig.structure.categories.forEach(category => {
        if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
          // Get AI suggested count (try both camelCase and snake_case)
          const suggestedValue = aiSuggested[category.key] || aiSuggested[category.storage_path] || []
          categoryStats[category.key].suggested.push(Array.isArray(suggestedValue) ? suggestedValue.length : 0)

          // Get actual selected count from image
          const actualValue = getImageValue(img, category.storage_path)
          categoryStats[category.key].selected.push(Array.isArray(actualValue) ? actualValue.length : 0)
        }
      })
    })

    const categoryBreakdown: TagCategoryStats[] = Object.entries(categoryStats).map(([catKey, stats]) => {
      const category = vocabConfig.structure.categories.find(c => c.key === catKey)
      const avgSuggested = stats.suggested.length > 0
        ? stats.suggested.reduce((a, b) => a + b, 0) / stats.suggested.length
        : 0
      const avgSelected = stats.selected.length > 0
        ? stats.selected.reduce((a, b) => a + b, 0) / stats.selected.length
        : 0
      const accuracy = avgSuggested > 0 ? (avgSelected / avgSuggested) * 100 : 0

      return {
        category: category?.label || catKey,
        avgSuggestedByAI: Math.round(avgSuggested * 10) / 10,
        avgSelectedByDesigner: Math.round(avgSelected * 10) / 10,
        accuracy: Math.round(accuracy * 10) / 10
      }
    })

    // 3. Missed Tags Analysis (tags_added)
    const missedTagsCount: Record<string, number> = {}
    corrections?.forEach(correction => {
      correction.tags_added?.forEach((tag: string) => {
        missedTagsCount[tag] = (missedTagsCount[tag] || 0) + 1
      })
    })

    const missedTags: TagAnalysis[] = Object.entries(missedTagsCount)
      .map(([tag, count]) => ({
        tag,
        category: tagToCategory[tag] || 'unknown',
        count,
        percentage: Math.round((count / totalImages) * 100 * 10) / 10
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // 4. Wrong Suggestions Analysis (tags_removed)
    const wrongTagsCount: Record<string, number> = {}
    corrections?.forEach(correction => {
      correction.tags_removed?.forEach((tag: string) => {
        wrongTagsCount[tag] = (wrongTagsCount[tag] || 0) + 1
      })
    })

    const wrongTags: TagAnalysis[] = Object.entries(wrongTagsCount)
      .map(([tag, count]) => ({
        tag,
        category: tagToCategory[tag] || 'unknown',
        count,
        percentage: Math.round((count / totalImages) * 100 * 10) / 10
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // 5. Confidence vs Accuracy Correlation
    const confidenceBuckets: ConfidenceBucket[] = [
      { range: 'Low (0-70%)', imageCount: 0, avgCorrections: 0, correctionRate: 0 },
      { range: 'Medium (70-85%)', imageCount: 0, avgCorrections: 0, correctionRate: 0 },
      { range: 'High (85-100%)', imageCount: 0, avgCorrections: 0, correctionRate: 0 }
    ]

    const bucketCorrections = [
      [] as number[],
      [] as number[],
      [] as number[]
    ]

    images?.forEach(img => {
      const confidence = (img.ai_confidence_score || 0) * 100
      const correction = corrections?.find(c => c.image_id === img.id)
      const correctionCount = (correction?.tags_added?.length || 0) + (correction?.tags_removed?.length || 0)

      let bucketIndex = 0
      if (confidence >= 85) bucketIndex = 2
      else if (confidence >= 70) bucketIndex = 1

      confidenceBuckets[bucketIndex].imageCount++
      bucketCorrections[bucketIndex].push(correctionCount)
    })

    confidenceBuckets.forEach((bucket, idx) => {
      if (bucket.imageCount > 0) {
        bucket.avgCorrections = Math.round(
          (bucketCorrections[idx].reduce((a, b) => a + b, 0) / bucket.imageCount) * 10
        ) / 10
        bucket.correctionRate = Math.round(
          (bucketCorrections[idx].filter(c => c > 0).length / bucket.imageCount) * 100 * 10
        ) / 10
      }
    })

    // 6. Image-Level Analysis (Dynamic)
    const imageAnalysis: ImageAnalysis[] = images?.map(img => {
      const correction = corrections?.find(c => c.image_id === img.id)

      // Dynamically build actual_tags and count total tags
      const actual_tags: Record<string, string[]> = {}
      let totalTags = 0

      vocabConfig.structure.categories.forEach(category => {
        if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
          const value = getImageValue(img, category.storage_path)
          const tagArray = Array.isArray(value) ? value : []
          actual_tags[category.key] = tagArray
          totalTags += tagArray.length
        }
      })

      const correctionCount = (correction?.tags_added?.length || 0) + (correction?.tags_removed?.length || 0)
      const correctionPercentage = totalTags > 0 ? Math.round((correctionCount / totalTags) * 100) : 0

      return {
        id: img.id,
        thumbnail_path: img.thumbnail_path,
        original_filename: img.original_filename,
        ai_confidence_score: img.ai_confidence_score,
        ai_suggested_tags: img.ai_suggested_tags,
        actual_tags,
        corrections: correction ? {
          tags_added: correction.tags_added || [],
          tags_removed: correction.tags_removed || []
        } : null,
        correctionPercentage,
        tagged_at: img.tagged_at
      }
    }).sort((a, b) => b.correctionPercentage - a.correctionPercentage) || []

    // 7. Generate Actionable Insights
    const insights: string[] = []

    // Insight: Frequently missed tags
    const frequentlyMissed = missedTags.filter(t => t.percentage > 30)
    if (frequentlyMissed.length > 0) {
      insights.push(
        `🎯 AI frequently misses "${frequentlyMissed[0].tag}" (${frequentlyMissed[0].count} times, ${frequentlyMissed[0].percentage}% of images). Consider adding this tag to the priority list in the AI prompt.`
      )
    }

    // Insight: Frequently wrong tags
    const frequentlyWrong = wrongTags.filter(t => t.percentage > 40)
    if (frequentlyWrong.length > 0) {
      insights.push(
        `⚠️ AI over-suggests "${frequentlyWrong[0].tag}" (removed ${frequentlyWrong[0].count} times, ${frequentlyWrong[0].percentage}% of images). Add to cautionary list.`
      )
    }

    // Insight: Confidence calibration
    const highConfBucket = confidenceBuckets[2]
    const lowConfBucket = confidenceBuckets[0]
    if (highConfBucket.imageCount > 0 && lowConfBucket.imageCount > 0) {
      if (Math.abs(highConfBucket.correctionRate - lowConfBucket.correctionRate) < 10) {
        insights.push(
          `📊 Confidence scores may not be well calibrated. High confidence images have ${highConfBucket.correctionRate}% correction rate vs ${lowConfBucket.correctionRate}% for low confidence.`
        )
      }
    }

    // Insight: Accuracy trend
    if (accuracyTrend === 'improving') {
      insights.push(
        `📈 AI accuracy is improving over time! Recent images show ${Math.abs(trendPercentage).toFixed(1)}% better accuracy than earlier images.`
      )
    } else if (accuracyTrend === 'declining') {
      insights.push(
        `📉 AI accuracy is declining. Recent images show ${Math.abs(trendPercentage).toFixed(1)}% worse accuracy. Consider reviewing recent tag patterns.`
      )
    }

    // Insight: Category performance
    const bestCategory = categoryBreakdown.reduce((best, cat) =>
      cat.accuracy > best.accuracy ? cat : best
    , categoryBreakdown[0])
    const worstCategory = categoryBreakdown.reduce((worst, cat) =>
      cat.accuracy < worst.accuracy ? cat : worst
    , categoryBreakdown[0])

    insights.push(
      `✅ AI performs best on ${bestCategory.category} tags (${bestCategory.accuracy.toFixed(1)}% accuracy).`
    )
    insights.push(
      `⚙️ AI needs improvement on ${worstCategory.category} tags (${worstCategory.accuracy.toFixed(1)}% accuracy). Consider providing more examples.`
    )

    // Insight: Data needs
    if (totalImages < 50) {
      insights.push(
        `📚 You have ${totalImages} images analyzed. Upload at least 50 similar images to see more meaningful patterns and trends.`
      )
    }

    return {
      overallMetrics: {
        totalImagesAnalyzed: totalImages,
        averageConfidence: Math.round(avgConfidence * 100 * 10) / 10,
        totalCorrections,
        overallAccuracy: Math.round(overallAccuracy * 10) / 10,
        accuracyTrend,
        trendPercentage: Math.round(trendPercentage * 10) / 10
      },
      categoryBreakdown,
      missedTags,
      wrongTags,
      confidenceBuckets,
      imageAnalysis,
      insights,
      vocabConfig
    }

  } catch (error) {
    console.error('Error fetching AI analytics:', error)

    // Return empty analytics on error
    return {
      overallMetrics: {
        totalImagesAnalyzed: 0,
        averageConfidence: 0,
        totalCorrections: 0,
        overallAccuracy: 0,
        accuracyTrend: 'stable',
        trendPercentage: 0
      },
      categoryBreakdown: [],
      missedTags: [],
      wrongTags: [],
      confidenceBuckets: [],
      imageAnalysis: [],
      insights: ['No data available. Tag some images with AI suggestions to see analytics.'],
      vocabConfig: { structure: { categories: [] } }
    }
  }
}

export default async function AIAnalyticsPage() {
  const analytics = await getAIAnalytics()

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/tagger/dashboard"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors font-semibold mb-6"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">AI Learning Analytics</h1>
          <p className="text-gray-300 font-medium">
            Understand how Claude AI is performing with tag suggestions
          </p>
        </div>

        <AIAnalyticsClient analytics={analytics} />
      </div>
    </div>
  )
}
