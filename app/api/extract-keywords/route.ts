import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractKeywordsRequest, ExtractKeywordsResponse, QuestionnaireResponses } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { responses }: ExtractKeywordsRequest = await request.json();

    if (!responses) {
      return NextResponse.json(
        { error: 'Missing questionnaire responses' } as ExtractKeywordsResponse,
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        {
          keywords: extractFallbackKeywords(responses),
          error: 'AI service unavailable, using fallback keywords'
        } as ExtractKeywordsResponse,
        { status: 200 }
      );
    }

    // Build comprehensive prompt for Claude Haiku
    const prompt = buildExtractionPrompt(responses);

    // Call Claude Haiku API
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Extract keywords from response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const keywords = parseKeywords(responseText);

    return NextResponse.json({
      keywords,
    } as ExtractKeywordsResponse);

  } catch (error) {
    console.error('Error extracting keywords:', error);

    // Try to use fallback if we have responses
    const body = await request.json().catch(() => ({}));
    if (body.responses) {
      return NextResponse.json({
        keywords: extractFallbackKeywords(body.responses),
        error: 'AI extraction failed, using fallback keywords'
      } as ExtractKeywordsResponse);
    }

    return NextResponse.json(
      {
        keywords: [],
        error: 'Failed to extract keywords'
      } as ExtractKeywordsResponse,
      { status: 500 }
    );
  }
}

function buildExtractionPrompt(responses: QuestionnaireResponses): string {
  return `You are analyzing a brand strategy questionnaire for a creative design studio. Extract 8-12 keywords that capture the essence of this brand's visual identity, personality, and strategic direction.

Focus on extracting keywords that would help curate a visual mood board. Include:
- Visual aesthetic descriptors (minimal, bold, layered, organic, geometric, etc.)
- Emotional/mood keywords (contemplative, energetic, sophisticated, accessible, etc.)
- Design era/movement references (brutalist, modernist, art deco, etc.)
- Conceptual themes (decolonization, sustainability, innovation, heritage, etc.)

QUESTIONNAIRE RESPONSES:

## Brand Strategy & Positioning
Visual Approach: ${responses.visualApproach}
Creative Documents: ${responses.creativeDocuments}
Problem Solved: ${responses.problemSolved}
Deeper Reason: ${responses.deeperReason}
Customer Words: ${responses.customerWords}
Differentiators: ${responses.differentiators}
${responses.strategicThoughts ? `Additional Thoughts: ${responses.strategicThoughts}` : ''}

## Brand Personality & Tone
Dinner Party Behavior: ${responses.dinnerPartyBehavior}
Should Never Feel Like: ${responses.neverFeelLike}
Energy/Mood: ${responses.energyMood}
Soundtrack Genre: ${responses.soundtrackGenre}
Artists/Diversification: ${responses.artistsDiversification}

## Visual Identity & Style
Color Associations: ${responses.colorAssociations}
Visual Style Preference: ${responses.visualStyle}
Admired Brands: ${responses.admiredBrands}
Aesthetic Inspiration: ${responses.aestheticInspiration}
Decolonization Visual Approach: ${responses.decolonizationVisual}

## Target Audience
Audience: ${responses.audienceDescription}
Ideal Client: ${responses.idealClient}
Desired Feeling: ${responses.desiredFeeling}
Customer Frustrations: ${responses.customerFrustrations}
Brand Role: ${responses.brandRole}

## Vision & Growth
5-Year Vision: ${responses.fiveYearVision}
Expansion Plans: ${responses.expansionPlans}
Dream Partnerships: ${responses.dreamPartnerships}
Big Dream: ${responses.bigDream}
Success Beyond Sales: ${responses.successBeyondSales}
Long-term Focus: ${responses.longTermFocus}
Existing Collection: ${responses.existingCollection}
Competitors: ${responses.competitors}

---

Respond with ONLY a comma-separated list of 8-12 keywords. No explanations, no numbering, just the keywords separated by commas.

Example format: minimal, contemporary, cultural, accessible, bold typography, organic forms, decolonial, community-focused, innovative, heritage`;
}

function parseKeywords(responseText: string): string[] {
  // Remove any extra whitespace and split by comma
  const keywords = responseText
    .trim()
    .split(',')
    .map(keyword => keyword.trim())
    .filter(keyword => keyword.length > 0 && keyword.length < 50); // Sanity check

  // Limit to 12 keywords max
  return keywords.slice(0, 12);
}

function extractFallbackKeywords(responses: QuestionnaireResponses): string[] {
  // Simple fallback: extract common aesthetic words from responses
  const allText = Object.values(responses).join(' ').toLowerCase();

  const commonKeywords = [
    'minimal', 'minimalist', 'clean', 'bold', 'contemporary', 'modern',
    'organic', 'geometric', 'layered', 'simple', 'complex', 'accessible',
    'sophisticated', 'playful', 'serious', 'warm', 'cool', 'vibrant',
    'muted', 'colorful', 'monochrome', 'typography', 'illustration',
    'photography', 'abstract', 'figurative', 'cultural', 'heritage',
    'innovation', 'tradition', 'community', 'decolonial', 'inclusive'
  ];

  const found = commonKeywords.filter(keyword => allText.includes(keyword));

  // Also try to extract the visual approach directly
  if (responses.visualApproach) {
    found.unshift(responses.visualApproach.toLowerCase().substring(0, 30));
  }

  // Default keywords if nothing found
  if (found.length === 0) {
    return ['contemporary', 'creative', 'cultural', 'visual', 'artistic', 'innovative', 'design', 'aesthetic'];
  }

  return found.slice(0, 10);
}
