import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

interface TagVocabulary {
  industries: string[]
  projectTypes: string[]
  styles: string[]
  moods: string[]
  elements: string[]
}

interface SuggestTagsRequest {
  image: string // base64 data URI
  vocabulary: TagVocabulary
}

interface SuggestTagsResponse {
  industries: string[]
  projectTypes: string[]
  styles: string[]
  moods: string[]
  elements: string[]
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { image, vocabulary }: SuggestTagsRequest = await request.json()

    if (!image || !vocabulary) {
      return NextResponse.json(
        { error: 'Missing image or vocabulary' } as SuggestTagsResponse,
        { status: 400 }
      )
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set')
      return NextResponse.json(
        {
          industries: [],
          projectTypes: [],
          styles: [],
          moods: [],
          elements: [],
          confidence: 'low' as const,
          reasoning: 'AI service unavailable',
          error: 'AI service unavailable'
        } as SuggestTagsResponse,
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

    // Build prompt with vocabulary
    const prompt = buildTagSuggestionPrompt(vocabulary)

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

    return NextResponse.json(suggestions as SuggestTagsResponse)

  } catch (error) {
    console.error('Error suggesting tags:', error)
    return NextResponse.json(
      {
        industries: [],
        projectTypes: [],
        styles: [],
        moods: [],
        elements: [],
        confidence: 'low' as const,
        reasoning: 'Failed to analyze image',
        error: error instanceof Error ? error.message : 'Failed to suggest tags'
      } as SuggestTagsResponse,
      { status: 500 }
    )
  }
}

function buildTagSuggestionPrompt(vocabulary: TagVocabulary): string {
  return `You are analyzing a design reference image for a graphic design studio's reference bank. Your task is to suggest relevant tags from the provided vocabulary that best describe this image.

**AVAILABLE TAG VOCABULARY:**

**Industries** (${vocabulary.industries.length} tags):
${vocabulary.industries.map(tag => `- ${tag}`).join('\n')}

**Project Types** (${vocabulary.projectTypes.length} tags):
${vocabulary.projectTypes.map(tag => `- ${tag}`).join('\n')}

**Styles** (${vocabulary.styles.length} tags):
${vocabulary.styles.map(tag => `- ${tag}`).join('\n')}

**Moods** (${vocabulary.moods.length} tags):
${vocabulary.moods.map(tag => `- ${tag}`).join('\n')}

**Elements** (${vocabulary.elements.length} tags):
${vocabulary.elements.map(tag => `- ${tag}`).join('\n')}

---

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
  "industries": ["tag1", "tag2"],
  "projectTypes": ["tag1"],
  "styles": ["tag1", "tag2", "tag3"],
  "moods": ["tag1", "tag2"],
  "elements": ["tag1", "tag2"],
  "confidence": "high",
  "reasoning": "This appears to be a minimalist restaurant branding project featuring clean typography and a sophisticated color palette. The geometric layouts and contemporary aesthetic suggest a high-end hospitality industry focus."
}

**Confidence levels:**
- "high": Image characteristics are very clear and tags are obvious
- "medium": Image has some clear elements but some ambiguity
- "low": Image is unclear, abstract, or doesn't fit vocabulary well

Respond ONLY with valid JSON. Do not include any markdown formatting, code blocks, or explanatory text outside the JSON.`
}

function parseTagSuggestions(responseText: string): SuggestTagsResponse {
  try {
    // Remove markdown code blocks if present
    let cleanedText = responseText.trim()
    cleanedText = cleanedText.replace(/^```json?\s*/i, '')
    cleanedText = cleanedText.replace(/\s*```$/, '')
    cleanedText = cleanedText.trim()

    // Parse JSON
    const parsed = JSON.parse(cleanedText)

    // Validate structure
    return {
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
      projectTypes: Array.isArray(parsed.projectTypes) ? parsed.projectTypes : [],
      styles: Array.isArray(parsed.styles) ? parsed.styles : [],
      moods: Array.isArray(parsed.moods) ? parsed.moods : [],
      elements: Array.isArray(parsed.elements) ? parsed.elements : [],
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium',
      reasoning: typeof parsed.reasoning === 'string'
        ? parsed.reasoning
        : 'AI analysis completed',
    }
  } catch (error) {
    console.error('Failed to parse tag suggestions:', error)
    console.error('Response text:', responseText)
    return {
      industries: [],
      projectTypes: [],
      styles: [],
      moods: [],
      elements: [],
      confidence: 'low',
      reasoning: 'Failed to parse AI response',
      error: 'Failed to parse response'
    }
  }
}
