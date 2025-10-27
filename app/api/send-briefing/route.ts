import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import type { SendBriefingRequest, SendBriefingResponse, BriefingData, ReferenceImage } from '@/lib/types';
import { z } from 'zod';

// Validation schema for briefing responses
const briefingResponsesSchema = z.object({
  clientName: z.string().min(1, 'Client name is required').max(200, 'Client name too long').trim(),
  clientEmail: z.string().email('Invalid email address').max(100, 'Email too long').trim().toLowerCase(),
  projectName: z.string().max(200, 'Project name too long').trim().optional(),
  visualApproach: z.string().max(5000, 'Response too long').trim(),
  creativeDocuments: z.string().max(5000, 'Response too long').trim(),
  problemSolved: z.string().max(5000, 'Response too long').trim(),
  deeperReason: z.string().max(5000, 'Response too long').trim(),
  customerWords: z.string().max(500, 'Response too long').trim(),
  differentiators: z.string().max(5000, 'Response too long').trim(),
  strategicThoughts: z.string().max(5000, 'Response too long').trim().optional(),
  dinnerPartyBehavior: z.string().max(5000, 'Response too long').trim(),
  neverFeelLike: z.string().max(5000, 'Response too long').trim(),
  energyMood: z.string().max(5000, 'Response too long').trim(),
  soundtrackGenre: z.string().max(500, 'Response too long').trim(),
  artistsDiversification: z.string().max(5000, 'Response too long').trim(),
  colorAssociations: z.string().max(5000, 'Response too long').trim(),
  visualStyle: z.string().max(5000, 'Response too long').trim(),
  admiredBrands: z.string().max(5000, 'Response too long').trim(),
  aestheticInspiration: z.string().max(5000, 'Response too long').trim(),
  decolonizationVisual: z.string().max(5000, 'Response too long').trim(),
  audienceDescription: z.string().max(5000, 'Response too long').trim(),
  idealClient: z.string().max(5000, 'Response too long').trim(),
  desiredFeeling: z.string().max(5000, 'Response too long').trim(),
  customerFrustrations: z.string().max(5000, 'Response too long').trim(),
  avoidCustomerTypes: z.string().max(5000, 'Response too long').trim().optional(),
  brandRole: z.string().max(5000, 'Response too long').trim(),
  fiveYearVision: z.string().max(5000, 'Response too long').trim(),
  expansionPlans: z.string().max(5000, 'Response too long').trim(),
  dreamPartnerships: z.string().max(5000, 'Response too long').trim(),
  bigDream: z.string().max(5000, 'Response too long').trim(),
  successBeyondSales: z.string().max(5000, 'Response too long').trim(),
  longTermFocus: z.string().max(5000, 'Response too long').trim(),
  existingCollection: z.string().max(5000, 'Response too long').trim(),
  competitors: z.string().max(5000, 'Response too long').trim(),
});

const briefingDataSchema = z.object({
  responses: briefingResponsesSchema,
  extractedKeywords: z.array(z.string().max(100)).max(50, 'Too many keywords'),
  editedKeywords: z.array(z.string().max(100)).max(50, 'Too many keywords').optional(),
  referenceImages: z.array(z.any()).max(200, 'Too many reference images'),
  favoritedImageIds: z.array(z.string()).max(100, 'Too many favorited images'),
  timestamp: z.string().or(z.number()),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { briefingData } = body as SendBriefingRequest;

    // Validate briefing data structure
    if (!briefingData) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid briefing data',
          error: 'Missing briefing data'
        } as SendBriefingResponse,
        { status: 400 }
      );
    }

    // Validate with Zod
    const validationResult = briefingDataSchema.safeParse(briefingData);

    if (!validationResult.success) {
      const errors = validationResult.error?.issues?.map((err) => `${err.path.join('.')}: ${err.message}`) || ['Unknown validation error'];
      console.error('Briefing validation failed:', errors);
      console.error('Validation error details:', validationResult.error);

      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed',
          error: `Invalid data: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`
        } as SendBriefingResponse,
        { status: 400 }
      );
    }

    // Use validated data
    const validatedData = validationResult.data;

    // Check environment variables
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.STUDIO_EMAIL) {
      console.error('Missing email configuration');
      return NextResponse.json(
        {
          success: false,
          message: 'Email service not configured',
          error: 'Server configuration error'
        } as SendBriefingResponse,
        { status: 500 }
      );
    }

    // Validate studio email from environment
    const studioEmailValidation = z.string().email().safeParse(process.env.STUDIO_EMAIL);
    if (!studioEmailValidation.success) {
      console.error('Invalid STUDIO_EMAIL configuration');
      return NextResponse.json(
        {
          success: false,
          message: 'Email service misconfigured',
          error: 'Server configuration error'
        } as SendBriefingResponse,
        { status: 500 }
      );
    }

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Generate email HTML (cast back to BriefingData for compatibility)
    const htmlContent = generateEmailHTML(validatedData as unknown as BriefingData);
    const textContent = generateEmailText(validatedData as unknown as BriefingData);

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: studioEmailValidation.data,
      replyTo: validatedData.responses.clientEmail,
      subject: `Visual Briefing: ${validatedData.responses.clientName} - ${validatedData.responses.projectName || 'New Project'}`,
      html: htmlContent,
      text: textContent,
    });

    return NextResponse.json({
      success: true,
      message: 'Briefing submitted successfully',
    } as SendBriefingResponse);

  } catch (error) {
    console.error('Error sending briefing email:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to send briefing',
        error: error instanceof Error ? error.message : 'Unknown error'
      } as SendBriefingResponse,
      { status: 500 }
    );
  }
}

function generateEmailHTML(data: BriefingData): string {
  const { responses, extractedKeywords, editedKeywords, referenceImages, favoritedImageIds } = data;
  const keywords = editedKeywords && editedKeywords.length > 0 ? editedKeywords : extractedKeywords;
  const favoritedImages = referenceImages.filter(img => favoritedImageIds.includes(img.id));
  const allReferenceImages = referenceImages || [];

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #000; border-bottom: 3px solid #000; padding-bottom: 10px; }
    h2 { color: #000; margin-top: 30px; border-left: 4px solid #000; padding-left: 15px; }
    h3 { color: #666; margin-top: 20px; }
    .meta { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .meta p { margin: 5px 0; }
    .keywords { display: flex; flex-wrap: wrap; gap: 8px; margin: 15px 0; }
    .keyword { background: #000; color: #fff; padding: 6px 12px; border-radius: 20px; font-size: 14px; }
    .question { margin: 20px 0; }
    .question strong { display: block; color: #000; margin-bottom: 5px; }
    .answer { color: #555; padding-left: 15px; border-left: 2px solid #ddd; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .gallery-item { border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
    .gallery-item img { width: 100%; height: 200px; object-fit: cover; }
    .gallery-item-info { padding: 10px; font-size: 12px; background: #f9f9f9; }
    .timestamp { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Visual Briefing Submission</h1>

  <div class="meta">
    <p><strong>Client Name:</strong> ${responses.clientName}</p>
    <p><strong>Email:</strong> ${responses.clientEmail}</p>
    ${responses.projectName ? `<p><strong>Project:</strong> ${responses.projectName}</p>` : ''}
    <p class="timestamp"><strong>Submitted:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
  </div>

  <h2>AI-Extracted Keywords</h2>
  <div class="keywords">
    ${keywords.map(keyword => `<span class="keyword">${keyword}</span>`).join('')}
  </div>

  <h2>Brand Strategy & Positioning</h2>
  <div class="question">
    <strong>Visual Approach:</strong>
    <div class="answer">${responses.visualApproach}</div>
  </div>
  <div class="question">
    <strong>Creative Documents/Direction:</strong>
    <div class="answer">${responses.creativeDocuments}</div>
  </div>
  <div class="question">
    <strong>Problem Brand Solves:</strong>
    <div class="answer">${responses.problemSolved}</div>
  </div>
  <div class="question">
    <strong>Deeper Reason Beyond Profit:</strong>
    <div class="answer">${responses.deeperReason}</div>
  </div>
  <div class="question">
    <strong>Customer 3-Word Description:</strong>
    <div class="answer">${responses.customerWords}</div>
  </div>
  <div class="question">
    <strong>True Differentiators:</strong>
    <div class="answer">${responses.differentiators}</div>
  </div>
  ${responses.strategicThoughts ? `
  <div class="question">
    <strong>Additional Strategic Thoughts:</strong>
    <div class="answer">${responses.strategicThoughts}</div>
  </div>` : ''}

  <h2>Brand Personality & Tone</h2>
  <div class="question">
    <strong>Dinner Party Behavior:</strong>
    <div class="answer">${responses.dinnerPartyBehavior}</div>
  </div>
  <div class="question">
    <strong>Should NEVER Feel Like:</strong>
    <div class="answer">${responses.neverFeelLike}</div>
  </div>
  <div class="question">
    <strong>Energy/Mood to Communicate:</strong>
    <div class="answer">${responses.energyMood}</div>
  </div>
  <div class="question">
    <strong>Brand Soundtrack Genre:</strong>
    <div class="answer">${responses.soundtrackGenre}</div>
  </div>
  <div class="question">
    <strong>Artists/Collection Diversification:</strong>
    <div class="answer">${responses.artistsDiversification}</div>
  </div>

  <h2>Visual Identity & Style</h2>
  <div class="question">
    <strong>Color Associations:</strong>
    <div class="answer">${responses.colorAssociations}</div>
  </div>
  <div class="question">
    <strong>Visual Style Preference:</strong>
    <div class="answer">${responses.visualStyle}</div>
  </div>
  <div class="question">
    <strong>Admired Brands:</strong>
    <div class="answer">${responses.admiredBrands}</div>
  </div>
  <div class="question">
    <strong>Aesthetic Inspiration:</strong>
    <div class="answer">${responses.aestheticInspiration}</div>
  </div>
  <div class="question">
    <strong>Decolonization Visual Communication:</strong>
    <div class="answer">${responses.decolonizationVisual}</div>
  </div>

  <h2>Target Audience</h2>
  <div class="question">
    <strong>Audience Description:</strong>
    <div class="answer">${responses.audienceDescription}</div>
  </div>
  <div class="question">
    <strong>Ideal Client:</strong>
    <div class="answer">${responses.idealClient}</div>
  </div>
  <div class="question">
    <strong>Desired Feeling Upon Discovery:</strong>
    <div class="answer">${responses.desiredFeeling}</div>
  </div>
  <div class="question">
    <strong>Customer Frustrations:</strong>
    <div class="answer">${responses.customerFrustrations}</div>
  </div>
  ${responses.avoidCustomerTypes ? `
  <div class="question">
    <strong>Customer Types to Avoid:</strong>
    <div class="answer">${responses.avoidCustomerTypes}</div>
  </div>` : ''}
  <div class="question">
    <strong>Brand's Role in Customer Lives:</strong>
    <div class="answer">${responses.brandRole}</div>
  </div>

  <h2>Vision & Growth</h2>
  <div class="question">
    <strong>5-Year Brand Vision:</strong>
    <div class="answer">${responses.fiveYearVision}</div>
  </div>
  <div class="question">
    <strong>Expansion Plans:</strong>
    <div class="answer">${responses.expansionPlans}</div>
  </div>
  <div class="question">
    <strong>Dream Partnerships:</strong>
    <div class="answer">${responses.dreamPartnerships}</div>
  </div>
  <div class="question">
    <strong>Big Dream/Milestone:</strong>
    <div class="answer">${responses.bigDream}</div>
  </div>
  <div class="question">
    <strong>Success Beyond Sales:</strong>
    <div class="answer">${responses.successBeyondSales}</div>
  </div>
  <div class="question">
    <strong>Long-term Focus:</strong>
    <div class="answer">${responses.longTermFocus}</div>
  </div>
  <div class="question">
    <strong>Existing Collection Narrative:</strong>
    <div class="answer">${responses.existingCollection}</div>
  </div>
  <div class="question">
    <strong>Competitors:</strong>
    <div class="answer">${responses.competitors}</div>
  </div>

  <h2>Client-Selected Visual References</h2>
  ${favoritedImages.length > 0 ? `
  <p><em>The client favorited ${favoritedImages.length} image${favoritedImages.length > 1 ? 's' : ''} from our internal collection:</em></p>
  <div class="gallery">
    ${favoritedImages.map(img => formatReferenceImageItem(img)).join('')}
  </div>
  ` : '<p><em>Client did not select specific favorite images.</em></p>'}

  <h2>All Curated Visual References</h2>
  ${referenceImages.length > 0 ? `
  <p><em>Complete gallery of ${referenceImages.length} images from our internal collection, curated based on extracted keywords:</em></p>
  <div class="gallery">
    ${referenceImages.map(img => formatReferenceImageItem(img)).join('')}
  </div>
  <p style="margin-top: 2rem; color: #666; font-size: 14px;">
    All references are from our internal design library, curated and tagged by our team.
  </p>
  ` : '<p><em>No images in collection yet. Visual direction to be discussed during kickoff call.</em></p>'}

</body>
</html>
  `.trim();
}

function formatGalleryItem(block: ArenaBlock): string {
  const imageUrl = block.image?.display?.url || block.image?.thumb?.url || '';
  const title = block.title || 'Untitled';
  const username = block.user?.username || 'Unknown';
  const sourceUrl = block.source?.url || `https://are.na/block/${block.id}`;

  return `
    <div class="gallery-item">
      <img src="${imageUrl}" alt="${title}" />
      <div class="gallery-item-info">
        <div><strong>${title}</strong></div>
        <div>by ${username}</div>
        <div><a href="${sourceUrl}" target="_blank">View on Are.na</a></div>
      </div>
    </div>
  `;
}

function formatReferenceImageItem(image: ReferenceImage): string {
  const imageUrl = image.storage_path;
  const filename = image.original_filename || 'Untitled';
  const matchScore = image.match_score || 0;
  const matchedKeywords = image.matched_keywords || [];

  const matchBadge = matchScore >= 10 ? '⭐ Excellent Match' :
                     matchScore >= 5 ? '✓ Good Match' :
                     '~ Related';

  const tags = [
    ...(image.matched_on?.industries || []),
    ...(image.matched_on?.project_types || []),
    ...(image.matched_on?.styles || []),
    ...(image.matched_on?.moods || [])
  ].slice(0, 5);

  return `
    <div class="gallery-item">
      <img src="${imageUrl}" alt="${filename}" />
      <div class="gallery-item-info">
        <div><strong>${filename}</strong></div>
        <div style="color: #666; font-size: 11px;">${matchBadge} (Score: ${matchScore.toFixed(1)})</div>
        ${matchedKeywords.length > 0 ? `<div style="color: #888; font-size: 11px; margin-top: 4px;">Keywords: ${matchedKeywords.slice(0, 3).join(', ')}</div>` : ''}
        ${tags.length > 0 ? `<div style="margin-top: 4px;">${tags.map(tag => `<span style="background: #eee; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 2px;">${tag}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `;
}

function generateEmailText(data: BriefingData): string {
  const { responses, extractedKeywords, editedKeywords } = data;
  const keywords = editedKeywords && editedKeywords.length > 0 ? editedKeywords : extractedKeywords;

  return `
VISUAL BRIEFING SUBMISSION

Client: ${responses.clientName}
Email: ${responses.clientEmail}
${responses.projectName ? `Project: ${responses.projectName}` : ''}
Submitted: ${new Date(data.timestamp).toLocaleString()}

AI-EXTRACTED KEYWORDS:
${keywords.join(', ')}

[Full questionnaire responses and visual gallery available in HTML version of this email]

View in an HTML-compatible email client to see the complete briefing with curated visual references.
  `.trim();
}
