# Visual Briefing Tool - Setup Guide

This guide will help you configure and use the new interactive visual briefing tool for your design studio.

## What It Does

The Visual Briefing Tool is an AI-powered questionnaire that:
1. Collects brand strategy responses from potential clients
2. Uses Claude Haiku AI to extract visual keywords from their responses
3. Searches Are.na to curate a personalized visual gallery
4. Allows clients to favorite images that resonate with their vision
5. Emails the complete briefing (responses + curated images) to your studio

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory (copy from `.env.local.example`):

```bash
cp .env.local.example .env.local
```

Then fill in the following values:

#### Anthropic Claude API
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**How to get it:**
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy and paste it into `.env.local`

#### SMTP Email Configuration

For Gmail (recommended for testing):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
STUDIO_EMAIL=eldhosekuriyan@gmail.com
```

**How to set up Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication (required)
3. Go to "App Passwords" (https://myaccount.google.com/apppasswords)
4. Create a new app password for "Mail"
5. Copy the 16-character password
6. Paste it as `SMTP_PASS` in `.env.local`

**For other email providers:**
- **Outlook/Office365:** `smtp.office365.com`, Port 587
- **SendGrid:** `smtp.sendgrid.net`, Port 587 (use API key as password)
- **Mailgun:** `smtp.mailgun.org`, Port 587

### 2. Test the Installation

```bash
# Install dependencies (already done)
npm install

# Start development server
npm run dev
```

Visit http://localhost:3000/briefing to see the tool in action.

### 3. Test the Complete Flow

1. **Fill out the questionnaire** - Go through all 6 steps
2. **AI Keyword Extraction** - Click to extract keywords with Claude
3. **Edit Keywords** - Add/remove keywords as needed
4. **View Gallery** - Browse the curated Are.na images
5. **Favorite Images** - Click hearts on images that resonate
6. **Review & Submit** - Check the summary and submit
7. **Check Email** - Verify the briefing email arrives at `STUDIO_EMAIL`

## Features

### Multi-Step Questionnaire
- **Step 1:** Client Info (name, email, project)
- **Step 2:** Brand Strategy & Positioning (7 questions)
- **Step 3:** Brand Personality & Tone (5 questions)
- **Step 4:** Visual Identity & Style (5 questions)
- **Step 5:** Target Audience (6 questions)
- **Step 6:** Vision & Growth (8 questions)

### AI Keyword Extraction
- Uses Claude Haiku (fast & cost-effective)
- Analyzes all responses to extract 8-12 visual keywords
- Includes aesthetic descriptors, mood keywords, and conceptual themes

### Visual Gallery from Are.na
- Searches Are.na public API for each keyword
- Curates 30-40 unique images
- Deduplicates results across keywords
- Respectful rate limiting (600ms between requests)

### Client Interactions
- **Favoriting:** Click heart icons to save preferred images
- **Regenerate:** Edit keywords and re-search gallery
- **Auto-save:** Progress saved to localStorage
- **Recovery:** Can resume if browser closes

### Email Submission
- Beautifully formatted HTML email
- Includes all questionnaire responses
- Shows extracted keywords as tags
- Displays favorited images (if any)
- Shows complete curated gallery
- Reply-to set to client email

## File Structure

```
app/
  briefing/
    page.tsx                    # Main briefing page
  api/
    extract-keywords/route.ts   # Claude Haiku API integration
    search-arena/route.ts       # Are.na search proxy
    send-briefing/route.ts      # Email sending

components/briefing/
  BriefingClient.tsx           # Main orchestrator component
  StepIndicator.tsx            # Progress indicator UI
  QuestionStep.tsx             # Reusable question input
  KeywordExtraction.tsx        # AI extraction screen
  KeywordEditor.tsx            # Keyword editing interface
  ImageGallery.tsx             # Masonry grid gallery
  ImageCard.tsx                # Individual image card
  BriefingSummary.tsx          # Final review screen
  SuccessScreen.tsx            # Submission confirmation

lib/
  types.ts                     # TypeScript interfaces
```

## Customization

### Modify Questions
Edit the question text in `components/briefing/BriefingClient.tsx` in the `renderStrategyQuestions()`, `renderPersonalityQuestions()`, etc. functions.

### Change AI Model
In `app/api/extract-keywords/route.ts`, change the model:
```typescript
model: 'claude-sonnet-4-20250514'  // For more sophisticated analysis
```

### Adjust Gallery Size
In `app/api/search-arena/route.ts`, modify:
```typescript
const RESULTS_PER_KEYWORD = 6;  // Results per keyword
const MAX_TOTAL_RESULTS = 40;   // Total images in gallery
```

### Style Customization
All components use Tailwind CSS classes. Customize colors, spacing, and typography in the component files to match your brand.

## Troubleshooting

### Keywords not extracting
- Check that `ANTHROPIC_API_KEY` is set correctly in `.env.local`
- Verify API key is active at https://console.anthropic.com/
- Check browser console and server logs for errors

### No images appearing
- Are.na API is public and doesn't require authentication
- Check browser network tab for API failures
- Try different keywords (some may have no results)

### Email not sending
- Verify all SMTP variables are set in `.env.local`
- For Gmail, ensure you're using an App Password (not your regular password)
- Check server logs for detailed error messages
- Test SMTP credentials with a simple test script

### Server won't start
- Run `npm install` to ensure all dependencies are installed
- Check that port 3000 is available (or use the alternative port shown)
- Review console for TypeScript or build errors

## Production Deployment

Before deploying:

1. **Set environment variables** on your hosting platform (Netlify, Vercel, etc.)
2. **Test email delivery** in production environment
3. **Monitor API usage** for Anthropic Claude (set up billing alerts)
4. **Consider rate limiting** for the briefing form (prevent spam)
5. **Add Google reCAPTCHA** to prevent bot submissions (optional)

## Support

For issues or questions:
- Check the browser console and server logs first
- Review the `.env.local.example` file for correct format
- Ensure all required environment variables are set
- Test each API endpoint individually

## Next Steps

- Access the tool at http://localhost:3000/briefing
- Test with real responses to see how keyword extraction works
- Customize the email template in `app/api/send-briefing/route.ts`
- Add your branding and adjust colors/fonts to match your studio
