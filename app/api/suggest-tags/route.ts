import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { z } from 'zod'
import { base64ImageSchema, tagArraySchema } from '@/lib/validation'
import { getEnhancedPromptSetting } from '@/lib/ai-settings'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ========== VALIDATION SCHEMAS ==========

// Dynamic vocabulary schema - accepts any category structure
const tagVocabularySchema = z.record(
  z.string(), // category key (any string)
  tagArraySchema // array of tag strings
)

const suggestTagsRequestSchema = z.object({
  image: base64ImageSchema,
  vocabulary: tagVocabularySchema,
})

// ========== INTERFACES ==========

interface TagVocabulary {
  [categoryKey: string]: string[]
}

interface SuggestTagsResponse {
  [categoryKey: string]: string[] | string | undefined
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  promptVersion?: 'baseline' | 'enhanced'
  error?: string
}

interface CorrectionPattern {
  tag: string
  category: string
  count: number
  percentage: number
}

interface CorrectionAnalysis {
  totalImages: number
  frequentlyMissed: CorrectionPattern[]
  frequentlyWrong: CorrectionPattern[]
  accuracyRate: number
  categoryAccuracy: Record<string, number>
  lastUpdated: number
}

// ========== IN-MEMORY CACHE ==========

let correctionCache: CorrectionAnalysis | null = null
let cacheTimestamp: number = 0
let lastImageCount: number = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour
const CACHE_IMAGE_THRESHOLD = 5 // Invalidate cache after 5 new images

// Helper function to create empty response with dynamic categories
function createEmptyResponse(
  vocabulary: TagVocabulary | null,
  confidence: 'high' | 'medium' | 'low',
  reasoning: string,
  error?: string
): SuggestTagsResponse {
  const response: SuggestTagsResponse = {
    confidence,
    reasoning,
    error
  }
  
  // Add empty arrays for each category
  if (vocabulary) {
    Object.keys(vocabulary).forEach(key => {
      response[key] = []
    })
  }
  
  return response
}

// Note: getEnhancedPromptSetting is now imported from @/lib/ai-settings
// This shared utility ensures consistency across all API routes

// ========== MAIN POST HANDLER ==========

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()

    // Validate request with Zod
    const validationResult = suggestTagsRequestSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error?.issues?.map((err) => `${err.path.join('.')}: ${err.message}`) || ['Unknown validation error']
      console.error('Tag suggestion validation failed:', errors)
      console.error('Validation error details:', validationResult.error)

      // Return empty response with dynamic categories
      const emptyResponse: SuggestTagsResponse = {
        confidence: 'low' as const,
        reasoning: 'Invalid request data',
        error: `Validation failed: ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? '...' : ''}`
      }
      
      // Add empty arrays for each category in the request
      if (body.vocabulary && typeof body.vocabulary === 'object') {
        Object.keys(body.vocabulary).forEach(key => {
          emptyResponse[key] = []
        })
      }

      return NextResponse.json(emptyResponse, { status: 400 })
    }

    // Use validated data
    const { image, vocabulary } = validationResult.data

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set')
      return NextResponse.json(
        createEmptyResponse(vocabulary, 'low', 'AI service unavailable', 'AI service unavailable'),
        { status: 200 }
      )
    }

    // Extract base64 data and media type from data URI
    const matches = image.match(/^data:([^;]+);base64,(.+)$/)
    if (!matches) {
      return NextResponse.json(
        { error: 'Invalid image format' } as SuggestTagsResponse,
        { status: 400 }
      )
    }

    const mediaType = matches[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    const base64Data = matches[2]

    // Build prompt (enhanced or baseline based on database setting)
    const useEnhanced = await getEnhancedPromptSetting()
    const promptVersion = useEnhanced ? 'enhanced' : 'baseline'
    const prompt = await buildTagSuggestionPrompt(vocabulary, promptVersion)

    // Call Claude Sonnet API with image
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      }],
    })

    // Extract response text
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON response from Claude
    const suggestions = parseTagSuggestions(responseText)

    // Add prompt version to response
    suggestions.promptVersion = promptVersion

    return NextResponse.json(suggestions as SuggestTagsResponse)

  } catch (error) {
    console.error('Error suggesting tags:', error)
    
    // Try to get vocabulary from body for error response
    let vocab: TagVocabulary | null = null
    try {
      const body = await request.json()
      vocab = body.vocabulary || null
    } catch {}
    
    return NextResponse.json(
      createEmptyResponse(
        vocab,
        'low',
        'Failed to analyze image',
        error instanceof Error ? error.message : 'Failed to suggest tags'
      ),
      { status: 500 }
    )
  }
}

// ========== CORRECTION ANALYSIS ==========

async function getCorrectionAnalysis(): Promise<CorrectionAnalysis | null> {
  try {
    const supabase = createServerClient()

    // Check if cache is valid
    const now = Date.now()
    const cacheAge = now - cacheTimestamp

    // Get current image count
    const { count: currentImageCount } = await supabase
      .from('reference_images')
      .select('*', { count: 'exact', head: true })
      .not('ai_suggested_tags', 'is', null)

    const imageCountDelta = (currentImageCount || 0) - lastImageCount

    // Return cached data if valid
    if (
      correctionCache &&
      cacheAge < CACHE_DURATION &&
      imageCountDelta < CACHE_IMAGE_THRESHOLD
    ) {
      console.log('📊 Using cached correction analysis')
      return correctionCache
    }

    console.log('🔄 Refreshing correction analysis cache...')

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
      console.log('⏸ Not enough data for correction analysis (need at least 5 images)')
      return null
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

    // Calculate overall accuracy
    let totalSuggestions = 0
    let totalAccepted = 0
    corrections?.forEach(correction => {
      const added = correction.tags_added?.length || 0
      const removed = correction.tags_removed?.length || 0
      totalSuggestions += added + removed
      totalAccepted += (added + removed - removed)
    })

    const accuracyRate = totalSuggestions > 0
      ? Math.round((totalAccepted / totalSuggestions) * 100)
      : 0

    // Calculate category-specific accuracy
    const categoryAccuracy: Record<string, number> = {}
    const categoryStats: Record<string, { total: number, correct: number }> = {
      industry: { total: 0, correct: 0 },
      project_type: { total: 0, correct: 0 },
      style: { total: 0, correct: 0 },
      mood: { total: 0, correct: 0 },
      elements: { total: 0, correct: 0 }
    }

    // This is simplified - would need more detailed tracking in production
    frequentlyMissed.forEach(pattern => {
      const cat = pattern.category
      if (categoryStats[cat]) {
        categoryStats[cat].total += pattern.count
      }
    })

    frequentlyWrong.forEach(pattern => {
      const cat = pattern.category
      if (categoryStats[cat]) {
        categoryStats[cat].total += pattern.count
      }
    })

    Object.entries(categoryStats).forEach(([cat, stats]) => {
      categoryAccuracy[cat] = stats.total > 0
        ? Math.round((stats.correct / stats.total) * 100)
        : 100
    })

    // Build analysis object
    const analysis: CorrectionAnalysis = {
      totalImages,
      frequentlyMissed,
      frequentlyWrong,
      accuracyRate,
      categoryAccuracy,
      lastUpdated: now
    }

    // Update cache
    correctionCache = analysis
    cacheTimestamp = now
    lastImageCount = currentImageCount || 0

    console.log(`✅ Correction analysis cached (${totalImages} images analyzed)`)

    return analysis

  } catch (error) {
    console.error('Error analyzing corrections:', error)
    return null
  }
}

// ========== ENHANCED PROMPT GENERATION ==========

async function buildTagSuggestionPrompt(
  vocabulary: TagVocabulary,
  version: 'baseline' | 'enhanced'
): Promise<string> {
  // Base prompt (same for both versions)
  let prompt = `You are analyzing a design reference image for a graphic design studio's reference bank. Your task is to suggest relevant tags from the provided vocabulary that best describe this image.

**AVAILABLE TAG VOCABULARY:**

`

  // Dynamically build category sections based on vocabulary
  Object.entries(vocabulary).forEach(([categoryKey, tags]) => {
    // Convert key to readable label (e.g., project_types -> Project Types)
    const label = categoryKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    
    prompt += `**${label}** (${tags.length} tags):\n`
    prompt += tags.map(tag => `- ${tag}`).join('\n')
    prompt += '\n\n'
  })

  prompt += '---\n'

  // Add enhanced learning section if enabled
  if (version === 'enhanced') {
    const corrections = await getCorrectionAnalysis()

    if (corrections && corrections.totalImages >= 5) {
      prompt += `
**🧠 LEARNING FROM PAST CORRECTIONS:**

Based on ${corrections.totalImages} previously tagged images by professional designers, here are critical patterns to improve your accuracy (current: ${corrections.accuracyRate}%):

**⚠️ TAGS YOU FREQUENTLY MISS** - Pay EXTRA attention to these:
${corrections.frequentlyMissed.slice(0, 8).map(tag =>
  `- "${tag.tag}" (${tag.category}) - designers added this ${tag.count} times (${tag.percentage}% of images)`
).join('\n')}

${generateMissedTagGuidance(corrections.frequentlyMissed)}

**❌ TAGS YOU WRONGLY SUGGEST** - Be MORE CONSERVATIVE with these:
${corrections.frequentlyWrong.slice(0, 8).map(tag =>
  `- "${tag.tag}" (${tag.category}) - designers removed this ${tag.count} times (${tag.percentage}% of images)`
).join('\n')}

${generateWrongTagGuidance(corrections.frequentlyWrong)}

**🎯 SPECIFIC CATEGORY PERFORMANCE:**
${Object.entries(corrections.categoryAccuracy).map(([cat, acc]) => {
  const label = cat.replace('_', ' ').toUpperCase()
  const emoji = acc >= 80 ? '✅' : acc >= 60 ? '⚠️' : '❌'
  return `${emoji} ${label}: ${acc}% accuracy ${acc < 70 ? '- NEEDS IMPROVEMENT' : ''}`
}).join('\n')}

**💡 KEY IMPROVEMENTS NEEDED:**
${generateActionableGuidance(corrections)}

**Your goal:** Improve accuracy by learning from these designer corrections. Consider context carefully before suggesting or avoiding these specific tags.

---
`
    }
  }

  // Standard instructions (same for both versions)
  prompt += `
**INSTRUCTIONS:**
1. Analyze the image carefully, considering:
   - What industry or sector this design relates to
   - What type of project this might be for (branding, web, packaging, etc.)
   - The visual style and aesthetic approach
   - The mood and emotional tone it conveys
   - Specific design elements present (typography, photography, etc.)

2. Select ONLY tags that exist in the vocabulary above
3. Be selective - only suggest tags that are clearly relevant
4. You may suggest 0-3 tags per category (don't force tags if they don't fit)
5. Provide a confidence level based on how clear the image's characteristics are
6. Give a brief reasoning for your suggestions

**RESPONSE FORMAT:**
Return your response as a JSON object with this exact structure:

{
${Object.keys(vocabulary).map(key => `  "${key}": ["tag1", "tag2"],`).join('\n')}
  "confidence": "high",
  "reasoning": "Brief explanation of your tag selections and what you observed in the image."
}

**Confidence levels:**
- "high": Image characteristics are very clear and tags are obvious
- "medium": Image has some clear elements but some ambiguity
- "low": Image is unclear, abstract, or doesn't fit vocabulary well

Respond ONLY with valid JSON. Do not include any markdown formatting, code blocks, or explanatory text outside the JSON.`

  return prompt
}

// ========== GUIDANCE GENERATION HELPERS ==========

function generateMissedTagGuidance(missedTags: CorrectionPattern[]): string {
  const guidance: string[] = []

  // Analyze patterns in missed tags
  const industries = missedTags.filter(t => t.category === 'industry')
  const styles = missedTags.filter(t => t.category === 'style')
  const moods = missedTags.filter(t => t.category === 'mood')
  const elements = missedTags.filter(t => t.category === 'elements')

  if (industries.length > 0) {
    const topIndustry = industries[0]
    guidance.push(`→ When you see ${topIndustry.tag}-related imagery, don't hesitate to tag it - you've missed this ${topIndustry.count} times!`)
  }

  if (styles.length > 0) {
    const topStyle = styles[0]
    guidance.push(`→ Look more carefully for "${topStyle.tag}" style characteristics - this is often present but you miss it`)
  }

  if (moods.length > 0) {
    const topMood = moods[0]
    guidance.push(`→ The "${topMood.tag}" mood appears more frequently than you think - consider it more often`)
  }

  if (elements.length > 0) {
    const topElement = elements[0]
    guidance.push(`→ "${topElement.tag}" is a key design element you frequently overlook - check for it specifically`)
  }

  return guidance.length > 0 ? '\n' + guidance.join('\n') : ''
}

function generateWrongTagGuidance(wrongTags: CorrectionPattern[]): string {
  const guidance: string[] = []

  // Analyze patterns in wrong suggestions
  const topWrong = wrongTags[0]
  if (topWrong) {
    if (topWrong.percentage > 40) {
      guidance.push(`→ CRITICAL: You over-suggest "${topWrong.tag}" - only use when EXTREMELY confident`)
    }
  }

  const styles = wrongTags.filter(t => t.category === 'style')
  if (styles.length >= 2) {
    guidance.push(`→ You're misidentifying styles - be more conservative with style tags unless 100% certain`)
  }

  const moods = wrongTags.filter(t => t.category === 'mood')
  if (moods.length >= 2) {
    guidance.push(`→ Mood interpretation is inconsistent - only suggest moods that are very clearly conveyed`)
  }

  return guidance.length > 0 ? '\n' + guidance.join('\n') : ''
}

function generateActionableGuidance(corrections: CorrectionAnalysis): string {
  const guidance: string[] = []

  // Overall accuracy guidance
  if (corrections.accuracyRate < 70) {
    guidance.push('- Overall accuracy is low - be more careful and selective with ALL tags')
  } else if (corrections.accuracyRate < 80) {
    guidance.push('- Accuracy is moderate - focus on the specific problem tags listed above')
  } else {
    guidance.push('- Overall accuracy is good - maintain this standard while addressing specific gaps')
  }

  // Category-specific guidance
  const worstCategory = Object.entries(corrections.categoryAccuracy)
    .sort((a, b) => a[1] - b[1])[0]

  if (worstCategory && worstCategory[1] < 70) {
    guidance.push(`- ${worstCategory[0].replace('_', ' ')} tags need the most improvement - double-check these especially`)
  }

  // Pattern-based guidance
  const avgMissedPerImage = corrections.frequentlyMissed.reduce((sum, t) => sum + t.count, 0) / corrections.totalImages
  const avgWrongPerImage = corrections.frequentlyWrong.reduce((sum, t) => sum + t.count, 0) / corrections.totalImages

  if (avgMissedPerImage > avgWrongPerImage) {
    guidance.push('- You tend to under-tag (missing relevant tags) - be more inclusive when confident')
  } else if (avgWrongPerImage > avgMissedPerImage) {
    guidance.push('- You tend to over-tag (suggesting irrelevant tags) - be more conservative and selective')
  }

  return guidance.join('\n')
}

// ========== RESPONSE PARSING ==========

function parseTagSuggestions(responseText: string): SuggestTagsResponse {
  try {
    // Remove markdown code blocks if present
    let cleanedText = responseText.trim()
    cleanedText = cleanedText.replace(/^```json?\s*/i, '')
    cleanedText = cleanedText.replace(/\s*```$/, '')
    cleanedText = cleanedText.trim()

    // Parse JSON
    const parsed = JSON.parse(cleanedText)

    // Build response dynamically from parsed data
    const response: SuggestTagsResponse = {
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium',
      reasoning: typeof parsed.reasoning === 'string'
        ? parsed.reasoning
        : 'AI analysis completed',
    }

    // Add all category arrays from parsed response
    Object.keys(parsed).forEach(key => {
      if (key !== 'confidence' && key !== 'reasoning') {
        response[key] = Array.isArray(parsed[key]) ? parsed[key] : []
      }
    })

    return response
  } catch (error) {
    console.error('Failed to parse tag suggestions:', error)
    console.error('Response text:', responseText)
    return {
      confidence: 'low',
      reasoning: 'Failed to parse AI response',
      error: 'Failed to parse response'
    }
  }
}
