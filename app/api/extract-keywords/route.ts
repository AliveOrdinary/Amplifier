import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractKeywordsResponse, QuestionnaireResponses } from '@/lib/types';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Validation schema for questionnaire responses (reuse the shape from send-briefing)
const extractKeywordsSchema = z.object({
  responses: z.object({
    clientName: z.string().max(200).optional(),
    clientEmail: z.string().max(100).optional(),
    projectName: z.string().max(200).optional(),
    visualApproach: z.string().max(5000).trim(),
    creativeDocuments: z.string().max(5000).trim(),
    problemSolved: z.string().max(5000).trim(),
    deeperReason: z.string().max(5000).trim(),
    customerWords: z.string().max(500).trim(),
    differentiators: z.string().max(5000).trim(),
    strategicThoughts: z.string().max(5000).trim().optional(),
    dinnerPartyBehavior: z.string().max(5000).trim(),
    neverFeelLike: z.string().max(5000).trim(),
    energyMood: z.string().max(5000).trim(),
    soundtrackGenre: z.string().max(500).trim(),
    artistsDiversification: z.string().max(5000).trim(),
    colorAssociations: z.string().max(5000).trim(),
    visualStyle: z.string().max(5000).trim(),
    admiredBrands: z.string().max(5000).trim(),
    aestheticInspiration: z.string().max(5000).trim(),
    decolonizationVisual: z.string().max(5000).trim(),
    audienceDescription: z.string().max(5000).trim(),
    idealClient: z.string().max(5000).trim(),
    desiredFeeling: z.string().max(5000).trim(),
    customerFrustrations: z.string().max(5000).trim(),
    avoidCustomerTypes: z.string().max(5000).trim().optional(),
    brandRole: z.string().max(5000).trim(),
    fiveYearVision: z.string().max(5000).trim(),
    expansionPlans: z.string().max(5000).trim(),
    dreamPartnerships: z.string().max(5000).trim(),
    bigDream: z.string().max(5000).trim(),
    successBeyondSales: z.string().max(5000).trim(),
    longTermFocus: z.string().max(5000).trim(),
    existingCollection: z.string().max(5000).trim(),
    competitors: z.string().max(5000).trim(),
  }),
});

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per 15 minutes
  const ip = getClientIp(request);
  const rateLimited = checkRateLimit(ip, 'extract-keywords', 10, 15 * 60 * 1000);
  if (rateLimited) {
    return NextResponse.json(
      { keywords: [], error: 'Too many requests. Please try again later.' } as ExtractKeywordsResponse,
      { status: 429, headers: { 'Retry-After': String(rateLimited.retryAfterSeconds) } }
    );
  }

  // Parse body once, store for use in catch block
  let parsedBody: { responses?: QuestionnaireResponses } | null = null;

  try {
    parsedBody = await request.json();

    // Validate with Zod
    const validationResult = extractKeywordsSchema.safeParse(parsedBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { keywords: [], error: 'Invalid questionnaire data' } as ExtractKeywordsResponse,
        { status: 400 }
      );
    }

    const { responses } = validationResult.data;

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        {
          keywords: extractFallbackKeywords(responses as QuestionnaireResponses),
          error: 'AI service unavailable, using fallback keywords'
        } as ExtractKeywordsResponse,
        { status: 200 }
      );
    }

    // Build user data (separate from system instructions to prevent prompt injection)
    const userData = buildUserData(responses as QuestionnaireResponses);

    // Call Claude Haiku API with system/user separation
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: userData
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

    // Try to use fallback if we already parsed responses
    if (parsedBody?.responses) {
      return NextResponse.json({
        keywords: extractFallbackKeywords(parsedBody.responses),
        error: 'AI extraction failed, using fallback keywords'
      } as ExtractKeywordsResponse);
    }

    return NextResponse.json(
      {
        keywords: [],
        error: 'An unexpected error occurred'
      } as ExtractKeywordsResponse,
      { status: 500 }
    );
  }
}

// System instructions separated from user data to prevent prompt injection
const SYSTEM_PROMPT = `You are analyzing a brand strategy questionnaire for a creative design studio. Extract 8-12 keywords that capture the essence of this brand's visual identity, personality, and strategic direction.

Focus on extracting keywords that would help curate a visual mood board. Include:
- Visual aesthetic descriptors (minimal, bold, layered, organic, geometric, etc.)
- Emotional/mood keywords (contemplative, energetic, sophisticated, accessible, etc.)
- Design era/movement references (brutalist, modernist, art deco, etc.)
- Conceptual themes (decolonization, sustainability, innovation, heritage, etc.)

Respond with ONLY a comma-separated list of 8-12 keywords. No explanations, no numbering, just the keywords separated by commas.

Example format: minimal, contemporary, cultural, accessible, bold typography, organic forms, decolonial, community-focused, innovative, heritage`;

function buildUserData(responses: QuestionnaireResponses): string {
  return `QUESTIONNAIRE RESPONSES:

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
Competitors: ${responses.competitors}`;
}

function parseKeywords(responseText: string): string[] {
  const keywords = responseText
    .trim()
    .split(',')
    .map(keyword => keyword.trim())
    .filter(keyword => keyword.length > 0 && keyword.length < 50);

  return keywords.slice(0, 12);
}

function extractFallbackKeywords(responses: QuestionnaireResponses): string[] {
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

  if (responses.visualApproach) {
    found.unshift(responses.visualApproach.toLowerCase().substring(0, 30));
  }

  if (found.length === 0) {
    return ['contemporary', 'creative', 'cultural', 'visual', 'artistic', 'innovative', 'design', 'aesthetic'];
  }

  return found.slice(0, 10);
}
