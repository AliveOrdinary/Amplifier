# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dual-purpose Next.js 15 application that combines:
1. **Portfolio Website** - Public graphic design portfolio with markdown-driven content management
2. **Reference Image Tagger** - Protected AI-powered image tagging system with Supabase backend
3. **Visual Briefing System** - Interactive client questionnaire with AI-powered keyword extraction and reference image search

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + Storage), Claude AI (Sonnet 4 & Haiku)

## Development Commands

```bash
# Start development server (runs on localhost:3000)
npm run dev

# Build for production (server-side features enabled)
npm run build

# Start production server (after build)
npm start

# Run linting
npm run lint
```

**Important:** The project NO LONGER uses static export (`output: 'export'`). This was removed to enable:
- Middleware for authentication (protecting `/tagger` routes)
- API routes for AI suggestions, briefing, and database operations
- Server-side rendering for protected pages

## Architecture

### Content Management System

The site uses a file-based CMS approach with markdown files stored in the `content/` directory:

- `content/global/info.md` - Site-wide settings (navigation, footer, site title)
- `content/pages/` - Page-specific content (home.md, about.md, contact.md)
- `content/projects/` - Project case studies (each project is a separate .md file)

Content is managed through Netlify CMS at `/admin` (requires Netlify Identity setup).

**Key Content Functions** (`lib/markdown.ts`):
- `getGlobalData()` - Fetch site-wide settings
- `getPageData(pageName)` - Fetch page content by name
- `getAllProjects()` - Get all projects sorted by order field
- `getProjectData(slug)` - Get single project by slug
- `getFeaturedProjects()` - Get projects where featured=true
- `getMarkdownContent(content)` - Convert markdown to HTML using remark

### Next.js App Structure

The project uses Next.js 15 App Router:

**Public Portfolio Routes:**
- `app/layout.tsx` - Root layout with Google Fonts and Netlify Identity scripts
- `app/page.tsx` - Homepage with animated intro
- `app/about/page.tsx` - About page
- `app/contact/page.tsx` - Contact page
- `app/projects/page.tsx` - Projects listing page
- `app/projects/[slug]/page.tsx` - Dynamic project detail pages
- `app/briefing/page.tsx` - Visual briefing questionnaire for clients

**Protected Tagger Routes** (require authentication via middleware):
- `app/tagger/login/page.tsx` - Login page (Supabase Auth)
- `app/tagger/dashboard/page.tsx` - Main tagger hub with stats
- `app/tagger/page.tsx` - Single image tagging interface
- `app/tagger/gallery/page.tsx` - Browse and edit tagged images
- `app/tagger/vocabulary/page.tsx` - Tag vocabulary management
- `app/tagger/vocabulary-config/page.tsx` - Vocabulary structure configuration
- `app/tagger/ai-analytics/page.tsx` - AI accuracy analytics (placeholder)

**API Routes** (server-side):
- `app/api/suggest-tags/route.ts` - Claude AI tag suggestions
- `app/api/vocabulary-config/route.ts` - Get active vocabulary config
- `app/api/vocabulary-config/replace/route.ts` - Replace entire vocabulary
- `app/api/extract-keywords/route.ts` - Extract keywords from briefing
- `app/api/search-arena/route.ts` - Search Arena.net for references
- `app/api/search-references/route.ts` - Search reference image bank
- `app/api/send-briefing/route.ts` - Email completed briefing
- `app/api/admin/delete-all-images/route.ts` - Delete all test data

### Component Architecture

**Layout Components:**
- `Layout.tsx` - Wrapper component that includes Header and Footer
- `Header.tsx` - Fixed header with hamburger menu, infinite scrolling navigation overlay
- `Footer.tsx` - Site footer

**Portfolio Components:**
- `HomePageClient.tsx` - Homepage with cycling text animation
- `AboutPageClient.tsx` - About page client interactions
- `CyclingText.tsx` - Animated text cycling component
- `ProjectCard.tsx` - Project preview card for listings
- `ProjectMedia.tsx` - Renders images or videos with optional captions and audio controls
- `ExpandableSummary.tsx` - Collapsible summary component for project details

**Briefing Components** (`components/briefing/`):
- `BriefingClient.tsx` - Main briefing flow coordinator
- `QuestionStep.tsx` - Individual question form with validation
- `StepIndicator.tsx` - Progress indicator
- `KeywordExtraction.tsx` - Display extracted keywords
- `KeywordEditor.tsx` - Edit extracted keywords
- `ImageGallery.tsx` - Grid of reference images
- `ImageCard.tsx` - Arena.net image card
- `ReferenceImageCard.tsx` - Reference image from bank
- `BriefingSummary.tsx` - Final summary before sending
- `SuccessScreen.tsx` - Completion confirmation

**Tagger Components** (`components/tagger/`):
- `LoginClient.tsx` - Login form with Supabase Auth
- `SignOutButton.tsx` - Sign out button
- `DashboardClient.tsx` - Dashboard with stats & admin controls
- `ImageTaggerClient.tsx` - Main tagging interface (~800 lines)
- `GalleryClient.tsx` - Browse & edit images (~900 lines)
- `VocabularyClient.tsx` - Tag vocabulary management (~700 lines)
- `VocabularyConfigClient.tsx` - Vocabulary structure configuration
- `AIAnalyticsClient.tsx` - AI accuracy analytics (placeholder)
- `ImagePreview.tsx` - Image preview component
- `TagCheckbox.tsx` - Tag checkbox with usage display

### TypeScript Types (`lib/types.ts`)

- `ProjectData` - Complete project metadata (title, slug, featuredImage, featuredVideo, services, year, etc.)
- `ProjectMediaItem` - Unified media type (image or video) with order, caption, hasAudio
- `ProjectImageItem` / `ProjectVideoItem` - Specific media types

### Styling

**Tailwind Configuration:**
- Custom color: `custom-bg` (#f7f7f7)
- Custom fonts: PP Neue Montreal (sans), Right Serif (serif)
- Typography plugin enabled for markdown content
- Configuration in `tailwind.config.js` and `postcss.config.mjs`

**Global Styles:** `app/globals.css`

### Authentication & Middleware

**File:** `middleware.ts`

The project uses Supabase authentication with Next.js middleware to protect tagger routes:

- **Protected:** All `/tagger/*` routes require authentication (except `/tagger/login`)
- **Public:** Portfolio routes (`/`, `/projects`, `/about`, `/contact`, `/briefing`)
- **Redirect:** Unauthenticated users → `/tagger/login?redirectTo=[original-path]`
- **Session Management:** Supabase SSR with cookie-based sessions

**Authentication Flow:**
1. User visits protected route (e.g., `/tagger/dashboard`)
2. Middleware checks for Supabase session in cookies
3. If no session → redirect to `/tagger/login`
4. Login page uses `LoginClient.tsx` with Supabase Auth
5. After login → redirect back to original requested page

### Next.js Configuration

**File:** `next.config.ts`

**Current Configuration:**
- **No static export** - Server-side features enabled (middleware, API routes)
- `images.unoptimized: true` - For third-party image sources
- `eslint.ignoreDuringBuilds: true` - Skip linting during builds
- Remote image patterns: Allow all HTTPS hosts

**Why Static Export Was Removed:**
The tagger system requires server-side features that are incompatible with static export:
- Middleware for authentication
- API routes for AI suggestions and database operations
- Dynamic server-rendered pages with real-time data

### Project Data Structure

Projects are stored as markdown files with frontmatter containing:
- `title`, `slug` - Project identification
- `featuredImage`, `featuredVideo` - Hero media (video takes precedence)
- `featuredVideoHasAudio` - Boolean for video audio control
- `shortSummary`, `mainSummary` - Project descriptions
- `year`, `services[]` - Project metadata
- `projectImages[]`, `projectVideos[]` - Gallery media with order, caption, hasAudio
- `featured` - Boolean for homepage display
- `order` - Sort order for project listing

**Media Handling:**
- Project detail pages combine images and videos into a single sorted array by order field
- `ProjectMedia` component handles both images and videos uniformly
- Videos can specify `hasAudio` to show audio controls

## Working with Content

When adding or modifying projects:
1. Create/edit markdown files in `content/projects/`
2. Ensure all required frontmatter fields are present
3. Set `order` field to control display sequence
4. Set `featured: true` to show on homepage
5. Media items (images/videos) should have `order` fields for gallery sequence

## Deployment

**Portfolio Website:**
- Can be deployed to Netlify or Vercel
- Build command: `npm run build`
- Netlify CMS available at `/admin` (requires Netlify Identity setup)
- CMS configuration: `public/admin/config.yml`

**Tagger System Requirements:**
- Requires server-side runtime (Vercel, Netlify Functions, or Node.js server)
- Environment variables must be configured (see Environment Variables section below)
- Supabase project with tables, functions, and storage buckets
- Cannot use static export hosting

**Environment Variables Required:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Services
ANTHROPIC_API_KEY=

# Email (for briefing system)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
SMTP_PORT=
STUDIO_EMAIL=

# Optional: AI prompt configuration
USE_ENHANCED_PROMPT=true  # or false for baseline prompts
```

---

## Reference Image Tagger System

A comprehensive image tagging system for managing design reference libraries with AI-powered suggestions and tag analytics.

### System Overview

**Purpose:** Tag and organize design reference images with a controlled vocabulary for easy searching and categorization.

**Tech Stack:**
- Next.js 15 App Router (Server + Client Components)
- Supabase (PostgreSQL database + Storage)
- Claude AI (Sonnet 4.5) for tag suggestions
- TypeScript + Tailwind CSS

### Database Schema

**Tables:**
1. **`tag_vocabulary`** - Controlled tag vocabulary
   - `id` (uuid, PK)
   - `category` (text) - **Truly dynamic categories** (no database constraints). Valid categories are defined in the active `vocabulary_config.structure`. Accepts any category name without requiring migrations.
   - `tag_value` (text) - The tag itself (lowercase, normalized)
   - `description` (text, nullable) - Optional description
   - `sort_order` (integer) - Display order within category
   - `is_active` (boolean) - Enable/disable tags
   - `times_used` (integer) - Usage count (auto-incremented)
   - `last_used_at` (timestamptz, nullable) - Last usage timestamp
   - `created_at` (timestamptz) - Creation timestamp
   - `added_by` (uuid, FK → auth.users, nullable) - Future: user tracking

2. **`reference_images`** - Tagged images
   - `id` (uuid, PK)
   - `storage_path` (text) - Supabase Storage URL for original
   - `thumbnail_path` (text) - Supabase Storage URL for thumbnail
   - `original_filename` (text) - Original filename
   - `industries` (text[], nullable) - Dynamic: depends on vocabulary config
   - `project_types` (text[], nullable) - Dynamic: depends on vocabulary config
   - `tags` (jsonb) - Dynamic structure: `{ style: [], mood: [], elements: [] }`
   - `notes` (text, nullable) - Optional designer notes
   - `status` (text) - pending | tagged | approved | skipped
   - `tagged_at` (timestamptz) - When tagged
   - `updated_at` (timestamptz) - Last update
   - `ai_suggested_tags` (jsonb, nullable) - Original AI suggestions
   - `ai_confidence_score` (float, nullable) - AI confidence (0.3, 0.6, 0.9)
   - `ai_reasoning` (text, nullable) - AI explanation
   - `ai_model_version` (text, nullable) - Model used (e.g., "claude-sonnet-4-20250514")
   - `prompt_version` (text) - baseline | enhanced (for A/B testing)

3. **`tag_corrections`** - Track AI accuracy for learning
   - `id` (uuid, PK)
   - `image_id` (uuid, FK → reference_images)
   - `ai_suggested` (jsonb) - What AI suggested
   - `designer_selected` (jsonb) - What designer chose
   - `tags_added` (text[]) - Tags added by designer beyond AI
   - `tags_removed` (text[]) - Tags removed from AI suggestions
   - `corrected_at` (timestamptz) - When correction was made

4. **`vocabulary_config`** - Dynamic vocabulary structure definition
   - `id` (uuid, PK)
   - `is_active` (boolean, UNIQUE constraint) - Only one active config at a time
   - `config_name` (VARCHAR 255) - Human-readable name
   - `description` (text, nullable) - Description of this config
   - `structure` (jsonb) - Category definitions with metadata
   - `created_at` (timestamptz) - Creation timestamp
   - `updated_at` (timestamptz) - Last update timestamp

   **Structure Format:**
   ```json
   {
     "categories": [
       {
         "key": "industries",
         "label": "Industries",
         "storage_type": "array",
         "storage_path": "industries",
         "search_weight": 5,
         "description": "Select applicable industries",
         "placeholder": "e.g., restaurant, tech, fashion"
       }
     ]
   }
   ```

5. **`user_settings`** - Application configuration settings
   - `id` (uuid, PK)
   - `setting_key` (text) - e.g., "use_enhanced_prompt"
   - `setting_value` (text) - Setting value
   - `updated_at` (timestamptz) - Last update timestamp

**Database Functions:**
- `increment_tag_usage(category, tag_value, last_used_at)` - Atomically increments usage count
- `decrement_tag_usage(category, tag_value)` - Atomically decrements usage count (never below 0)

**Recent Migrations:**
- `update_vocabulary_categories_to_match_config` - Migrated existing tags from old category names (`industry`, `project_type`, `style`, `mood`, `elements`) to new vocabulary_config categories (`creative_fields`, `brand_expression`, `digital_focus`, `aesthetic_influences`, `mood`, `narrative_theme`, `color_energy`). Split the 30-tag `style` category into three new categories.
- `remove_category_constraint_for_dynamic_vocabularies` - **Removed CHECK constraint on tag_vocabulary.category** to enable truly dynamic vocabulary structures. System now accepts any category names defined in vocabulary_config without requiring database migrations.

**Storage Buckets:**
- `reference-images/originals/` - Original uploaded images
- `reference-images/thumbnails/` - Auto-generated thumbnails (max 800px)

### Page Structure

#### `/tagger/dashboard` (Main Entry Point)
**File:** `app/tagger/dashboard/page.tsx` + `components/tagger/DashboardClient.tsx`

**Features:**
- **Overview Stats:**
  - Total images by status (pending, tagged, approved, skipped)
  - Tag vocabulary counts by category
  - AI accuracy metrics (calculated from corrections)
  - Storage usage estimate
  - Last tagged timestamp

- **Quick Action Cards:**
  - 🏷️ Start Tagging → `/tagger`
  - 🖼️ View Gallery → `/tagger/gallery`
  - 📚 Manage Vocabulary → `/tagger/vocabulary`
  - 🤖 AI Analytics → `/tagger/ai-analytics`

- **Recent Activity Feed:**
  - Last 10 tagged images with thumbnails
  - Click to view in gallery

- **Admin Controls (Test Phase):**
  - **Delete All Images:** Clears all test data (storage + database), resets vocabulary usage counts
  - **Find Duplicates:** Scans for duplicate filenames, allows deletion
  - **Export Test Data:** Downloads JSON backup (vocabulary + sample images + stats)
  - **Reset Vocabulary to Mock:** Restores original 60-tag vocabulary

#### `/tagger` (Single Image Tagging)
**File:** `app/tagger/page.tsx` + `components/tagger/ImageTaggerClient.tsx`

**Features:**
- **Upload Phase:**
  - Drag & drop or file selector
  - Supports JPG, PNG, WEBP
  - Grid preview of uploaded images
  - "Start Tagging" button

- **Tagging Phase:**
  - 70/30 split layout (image preview | tag form)
  - AI suggestions auto-applied with visual indicators (✨)
  - **Tag categories: Dynamically loaded from active vocabulary_config** (current: Creative Fields, Brand Expression, Digital Focus, Aesthetic Influences, Mood, Narrative Theme, Color Energy)
  - Optional notes field
  - Custom tag addition with fuzzy matching (warns of similar tags)
  - Real-time tag usage tracking

- **Navigation:**
  - Previous/Next buttons
  - Skip button (marks as skipped)
  - Save & Next button (saves + auto-advances to next untagged)
  - Filter bar: All | Pending | Skipped | Tagged
  - Progress indicator

- **AI Integration:**
  - Claude API (`/api/suggest-tags`)
  - Images resized to max 1200px before sending to API
  - AI suggestions merged with any existing manual selections
  - Corrections tracked for AI improvement

- **Tag Usage Tracking:**
  - Increments `times_used` when saving images
  - Updates `last_used_at` timestamp
  - When editing images: compares old vs new tags, increments added, decrements removed

#### `/tagger/gallery` (Browse & Edit)
**File:** `app/tagger/gallery/page.tsx` + `components/tagger/GalleryClient.tsx`

**Features:**
- **Search & Filter:**
  - Text search across filenames, tags, notes
  - Filter by industry (dropdown)
  - Filter by project type (dropdown)
  - Sort by: Newest | Oldest | Recently Updated

- **Grid View:**
  - Responsive grid of thumbnails
  - Click to view full details in modal

- **Image Detail Modal:**
  - Full-size image
  - All tags displayed by category
  - Notes display
  - AI suggestions shown (if available)
  - AI reasoning displayed
  - Edit button (opens edit modal)

- **Edit Image Modal:**
  - Full tag editing (same UI as tagging)
  - Updates `updated_at` timestamp
  - Tracks tag usage changes (increment/decrement)

- **Bulk Edit:**
  - Select multiple images (checkboxes)
  - "Edit Selected (N)" button
  - Add or Remove mode
  - Select tags to apply/remove from all selected images
  - Updates tag usage counts for all changes

- **Selection State:**
  - Checkbox on each thumbnail
  - "Select All" / "Deselect All" buttons
  - Selected count indicator

#### `/tagger/vocabulary` (Tag Management)
**File:** `app/tagger/vocabulary/page.tsx` + `components/tagger/VocabularyClient.tsx`

**Features:**
- **View Modes:**
  - All Tags (grouped by category)
  - Analytics (most used, least used, recently added, never used)

- **Tag Display:**
  - Dynamic categories from vocabulary config
  - Shows: tag value, times used, last used date, sort order
  - Active/inactive status

- **Tag Actions:**
  - Edit tag (change value, description, sort order, active status)
  - Merge tags (combine duplicates, updates all references)
  - Add new tag (with fuzzy matching to prevent duplicates)
  - Drag & drop reordering (foundation exists, incomplete)

- **Analytics View:**
  - Most Used (top 10)
  - Least Used (bottom 10, excludes never used)
  - Recently Added (last 30 days)
  - Never Used (candidates for removal)

#### `/tagger/vocabulary-config` (Structure Configuration)
**File:** `app/tagger/vocabulary-config/page.tsx` + `components/tagger/VocabularyConfigClient.tsx`

**Features:**
- **View Current Configuration:** Display active vocabulary with all categories and metadata (key, label, storage_type, search_weight, tags, etc.)
- **Copy to Clipboard:** Export current config as JSON
- **Download Template:** Get a starter vocabulary config file
- **Full Replacement Workflow:**
  - **Two Input Methods:** Paste JSON directly or upload a .json file
  - **Real-time Validation:** Validates structure, required fields, and data types
  - **Preview:** Review configuration before applying
  - **Destructive Replacement:** Deletes all images, tags, and corrections; inserts new vocabulary with fresh structure
  - **Safety Confirmations:** Warning messages and confirmation dialogs

**Purpose:** Complete vocabulary structure management. Replace entire tagging schema (categories, tags, storage paths, weights) without code changes. System automatically adapts to new category structure.

### AI Tag Suggestion System

**API Endpoint:** `/api/suggest-tags`
**File:** `app/api/suggest-tags/route.ts` (~620 lines)
**Model:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)

**Process:**
1. Client resizes image to max 1200px (keeps under 5MB API limit)
2. Converts to base64 data URI
3. Sends image + dynamic vocabulary to API (supports any category structure)
4. Claude analyzes image and suggests tags from vocabulary
5. Returns JSON with dynamic categories: `{ [categoryKey]: string[], confidence, reasoning, promptVersion }`
   - Example: `{ industries: [], project_types: [], styles: [], moods: [], elements: [], confidence: "high", reasoning: "...", promptVersion: "enhanced" }`
   - Categories are fully dynamic based on vocabulary configuration
6. Client auto-applies suggestions (merges with any existing manual selections)
7. Designer can adjust before saving

**Prompt Versions (A/B Testing):**

1. **Baseline Prompt:**
   - Standard tag suggestion without learning
   - Simple, straightforward prompting
   - No historical correction data

2. **Enhanced Prompt:**
   - Learns from past corrections stored in `tag_corrections` table
   - Analyzes correction patterns (in-memory cache, 1-hour expiry)
   - Identifies frequently missed tags (top 10 with emphasis)
   - Identifies frequently wrong tags (top 10 with caution)
   - Includes category-specific accuracy rates
   - Provides actionable guidance based on patterns
   - Automatically invalidates cache after 5 new images

**Switching Prompts:**
- Controlled by `USE_ENHANCED_PROMPT` environment variable
- Can be overridden by `user_settings.use_enhanced_prompt` in database
- `prompt_version` field saved to `reference_images` for tracking

**Confidence Levels:**
- `high` (0.9) - Very confident in suggestions
- `medium` (0.6) - Reasonably confident
- `low` (0.3) - Uncertain, needs review

**Correction Tracking:**
- When saving, compares AI suggestions vs final designer selections
- Calculates `tags_added` (designer added beyond AI)
- Calculates `tags_removed` (designer removed from AI suggestions)
- Stores in `tag_corrections` table for model improvement
- Enhanced prompt uses this data to improve future suggestions

### Tag Usage Tracking

**Implementation:** Automatic tracking via database functions

**When Tags Are Used:**
1. **Saving New Image** (`ImageTaggerClient.tsx:550`):
   - Calls `updateTagUsageCounts(tags)`
   - For each tag used: `increment_tag_usage(category, tag_value, NOW())`
   - Sets `times_used++` and `last_used_at = NOW()`

2. **Editing Existing Image** (`GalleryClient.tsx:802-817`):
   - Calls `updateTagUsageForChanges(oldTags, newTags)`
   - Compares old vs new, finds added and removed tags
   - Added tags: `increment_tag_usage()`
   - Removed tags: `decrement_tag_usage()`

3. **Bulk Editing** (`GalleryClient.tsx:1089-1104`):
   - For each image: tracks tag changes
   - Updates usage counts for all modifications

**Database Functions:**
```sql
-- Increment usage (atomic)
CREATE FUNCTION increment_tag_usage(p_category TEXT, p_tag_value TEXT, p_last_used_at TIMESTAMPTZ)
UPDATE tag_vocabulary
SET times_used = times_used + 1, last_used_at = p_last_used_at
WHERE category = p_category AND tag_value = p_tag_value;

-- Decrement usage (atomic, never below 0)
CREATE FUNCTION decrement_tag_usage(p_category TEXT, p_tag_value TEXT)
UPDATE tag_vocabulary
SET times_used = GREATEST(times_used - 1, 0)
WHERE category = p_category AND tag_value = p_tag_value;
```

**Backfilling:** When needed, run migration `backfill_tag_usage_counts_v2` to count all existing image tags and update vocabulary.

---

## Visual Briefing System

**Purpose:** Interactive client questionnaire that collects project requirements, extracts design keywords using AI, and searches for reference images from both Arena.net and the internal reference image bank.

### Page Structure

#### `/briefing` (Client Questionnaire)
**File:** `app/briefing/page.tsx` + `components/briefing/BriefingClient.tsx`

**Workflow:**
1. **Client Information**
   - Name, email, project name

2. **5-Step Questionnaire** (~25 fields total)
   - **Step 1:** Project Approach (8 fields)
     - Visual approach, creative documents needed, problem solving, standout qualities, etc.
   - **Step 2:** Brand Personality (5 fields)
     - Dinner party behavior, what to avoid, energy/mood, keywords, etc.
   - **Step 3:** Visual Preferences (5 fields)
     - Color associations, visual style, admired brands, patterns, textures, etc.
   - **Step 4:** Audience (6 fields)
     - Audience description, ideal client, desired feeling, connection goals, etc.
   - **Step 5:** Future Vision (6 fields)
     - Five-year vision, expansion plans, dream partnerships, legacy, etc.

3. **AI Keyword Extraction**
   - Claude Haiku extracts 8-12 design keywords from responses
   - Keywords focus on: visual aesthetic, mood, design era/movement, conceptual themes
   - User can edit keywords before searching

4. **Reference Image Search**
   - Searches internal tagged reference images by keywords
   - Dynamic scoring based on vocabulary config search weights
   - Matches keywords to vocabulary categories
   - User can favorite images to include in briefing
   - Displays as Pinterest-like masonry grid

5. **Summary & Send**
   - Review all responses, keywords, and favorited images
   - Email sent to studio with complete briefing data
   - Success screen with confirmation

### API Routes

#### POST `/api/extract-keywords`
**File:** `app/api/extract-keywords/route.ts`
- **Model:** Claude Haiku (`claude-3-5-haiku-20241022`)
- **Input:** Complete questionnaire responses
- **Output:** 8-12 design keywords
- **Fallback:** Heuristic extraction if AI unavailable


#### POST `/api/search-references`
**File:** `app/api/search-references/route.ts`
- **Input:** Keywords from questionnaire
- **Process:**
  1. Fetches active vocabulary config
  2. Gets all tagged/approved reference images
  3. Dynamically maps keywords to vocabulary categories
  4. Scores each image: `(matches × search_weight)`
  5. Returns sorted results with match scores
- **Output:** Ranked reference images with matched keywords and categories

#### POST `/api/send-briefing`
**File:** `app/api/send-briefing/route.ts`
- **Input:** Complete briefing data (responses, keywords, favorited images/blocks)
- **Validation:** Zod schemas with strict length/format validation
- **Email:** Nodemailer sends HTML email to studio with:
  - Client information
  - All questionnaire responses
  - Extracted keywords
  - Links to favorited Arena blocks
  - Links to favorited reference images
  - Timestamp

### TypeScript Types

**Briefing Types** (`lib/types.ts`):
```typescript
QuestionnaireResponses {
  clientName, clientEmail, projectName
  // Step 1-5 fields (25+ fields total)
}

BriefingData {
  responses: QuestionnaireResponses
  extractedKeywords: string[]
  editedKeywords?: string[]
  referenceImages: ReferenceImage[]
  favoritedImageIds: string[]
  timestamp: string
}
```

**Note:** Arena.net integration was removed. The system now exclusively uses the internal reference image bank.

**Validation** (`lib/validation.ts`):
- `briefingEmailSchema` - Email validation
- `questionnaireFieldSchema` - Individual question validation
- `questionnaireSchema` - Complete questionnaire validation
- All fields have max length constraints and format validation

### Integration with Reference Image Bank

The briefing system leverages the tagger's vocabulary configuration for intelligent searching:
- Keywords are dynamically matched to vocabulary categories
- Each category has a `search_weight` (e.g., industries: 5, styles: 3)
- Images are scored based on matching tags multiplied by weights
- This means the briefing system automatically adapts to vocabulary changes

**Example Scoring:**
```
Keyword: "modern"
Image has: industries=["tech"], styles=["modern", "minimal"]

Score = (0 × 5) + (2 × 3) = 6
Matched on: styles
```

### Known Issues & Future Improvements

**Current Limitations:**
1. **Authentication:** Tagger has basic Supabase Auth but no role-based access control (admin controls accessible to all authenticated users)
2. No image duplication detection during upload
3. No keyboard shortcuts in standard tagger (planned for bulk upload)
4. No template system for common tag combinations (planned for bulk upload)

**Recently Completed:**
- ✅ **AI Analytics Dashboard** (`/tagger/ai-analytics`) - Fully implemented with comprehensive metrics, charts, correction analysis, and A/B testing controls
- ✅ **Vocabulary Config Replacement UI** - Full implementation at `/tagger/vocabulary-config` with JSON paste/upload, validation, template download, and destructive replacement workflow
- ✅ **Dynamic Category System** - Database constraint removed (migration: `remove_category_constraint_for_dynamic_vocabularies`). System now truly dynamic - accepts any category names defined in vocabulary_config without requiring migrations

**Non-Critical Issues:**
- VocabularyClient.tsx:204 - Unused `targetId` parameter in `handleMergeComplete()` (merge feature works but parameter not used)

---

## Bulk Upload Feature (PLANNED - Not Yet Implemented)

### Status: Foundation Created, Implementation Incomplete

**Files Created:**
- `/app/tagger/bulk-upload/page.tsx` - Page entry point ✅
- `/components/tagger/BulkUploadClient.tsx` - Empty placeholder (needs implementation)

**Goal:** Efficiently tag 50-100 similar images in under 30 minutes.

### Planned Features

#### Phase 1: Upload (Enhanced Drop Zone)
- **Large Drop Zone:** Full-width, accepts up to 100 images
- **Apply Base Tags to All:**
  - Before tagging, select common tags (e.g., "restaurant" + "interior" + "modern")
  - Opens modal with full tag selection UI
  - Applies to ALL uploaded images as starting point
  - AI suggestions will then add additional tags on top
- **Grid Preview:** 6-column grid showing all uploaded thumbnails
- **Upload Limit Guidance:** "50-100 images recommended for optimal batch processing"

#### Phase 2: Summary & AI Processing
- **Upload Summary Screen:**
  - Grid view of all uploaded images
  - AI processing status per image:
    - ✓ Completed (green)
    - ⏳ Processing (blue)
    - ⏸ Queued (gray)
    - ✕ Error (red)

- **Smart Batch AI Processing:**
  - Process 5 images at a time (parallel)
  - Progress indicator: "AI analyzing: 12/50 complete..."
  - Progress bar showing completion percentage
  - Continues in background while designer reviews first images

- **Action Buttons:**
  - "Start AI Processing" - Begins batch processing
  - "Start Tagging" - Enter tagging mode (can start before AI finishes)
  - "Review Images" - Just browse, no tagging

#### Phase 3: Rapid Tagging Interface
- **Layout:** Same 70/30 split as standard tagger
- **Keyboard-Driven Workflow:**
  - `Enter` → Save & Next (advance to next untagged image)
  - `Shift + Enter` → Save Current (stay on same image)
  - `S` → Skip
  - `←` `→` → Navigate Previous/Next
  - `Ctrl/Cmd + T` → Toggle Template Modal

- **Template System:**
  - **Save Template:** "Save current tags as template" button
  - **Name Template:** e.g., "Restaurant Interior Base", "Tech Branding Clean"
  - **Apply Template:** Dropdown showing saved templates with tag count
  - **Templates Persist:** Saved in component state (could be localStorage or DB later)
  - **Use Case:** Tag first image perfectly, save as template, apply to remaining 49 images, make minor adjustments

- **AI Pre-Applied:**
  - AI suggestions already applied from batch processing
  - Visual indicator showing which tags came from AI (✨ sparkle)
  - Designer just needs to adjust/confirm
  - Much faster than waiting for AI per image

- **Progress Tracking:**
  - Top bar: "Image 15 of 50 | 12 tagged"
  - Visual progress bar
  - Auto-skip already tagged images

#### Expected Performance
- **Without Bulk Upload:** 50 images × 2 min each = ~100 minutes
- **With Bulk Upload:**
  - Apply base tags: 1 minute
  - AI batch processing: ~10 minutes (background)
  - Tagging 50 images with templates: ~20 minutes
  - **Total: ~30 minutes** (70% faster)

### Implementation Approach (When Resuming)

**Option A: Separate Page** (Recommended)
- Create `/tagger/bulk-upload` as standalone feature
- Reuse components from `ImageTaggerClient.tsx`:
  - `TagForm` component
  - `ImagePreview` component
  - `generateThumbnail()` function
  - `resizeImageForAI()` function
  - `getSuggestionsFromAI()` function
  - `updateTagUsageCounts()` function
- Build new components:
  - `BulkUploadDropZone` (larger, accepts 100 files)
  - `BaseTagsModal` (apply tags to all)
  - `UploadSummaryGrid` (with AI status badges)
  - `TemplateManager` (save/load templates)
  - `BatchAIProcessor` (5 at a time with progress)
- Add to dashboard quick actions

**Option B: Enhance ImageTaggerClient** (More Complex)
- Add "Bulk Mode" toggle to existing tagger
- Conditionally render different UI based on mode
- Share all existing components and functions
- More integrated but harder to maintain

### Dashboard Integration

When bulk upload is complete, add to dashboard:

```tsx
<Link
  href="/tagger/bulk-upload"
  className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-sm hover:shadow-md transition-all p-6"
>
  <div className="text-3xl mb-3">⚡</div>
  <div className="font-semibold text-lg mb-1">Bulk Upload</div>
  <div className="text-sm text-indigo-100">Tag 50-100 similar images fast</div>
</Link>
```

### Testing Workflow (When Ready)

1. **Prepare Test Images:**
   - Download 50 similar images (e.g., all restaurant interiors from Pinterest)
   - Ensure variety but common themes

2. **Test Bulk Upload:**
   ```
   1. Go to /tagger/bulk-upload
   2. Upload all 50 images
   3. Apply base tags: "restaurant", "interior", "modern"
   4. Click "Start AI Processing" - watch progress
   5. Click "Start Tagging" when ready
   6. Tag first image, save as template "Restaurant Base"
   7. For remaining images: Load template, adjust, Save & Next (Enter key)
   8. Measure time to complete all 50
   ```

3. **Verify:**
   - Check `/tagger/gallery` - all 50 images appear
   - Check `/tagger/vocabulary` - usage counts updated correctly
   - Check `/tagger/dashboard` - stats reflect new images

---

## Current System Status

### ✅ Fully Working Features

**Portfolio Website:**
1. **Homepage** - Animated intro with cycling text
2. **Projects** - Listing and detail pages with markdown content
3. **About/Contact** - Static pages with markdown content
4. **Netlify CMS** - Content management at `/admin`

**Visual Briefing System:**
1. **Multi-step Questionnaire** - 5 steps, 25+ fields with validation
2. **AI Keyword Extraction** - Claude Haiku extracts design keywords
3. **Reference Bank Search** - Search internal tagged images with dynamic scoring
4. **Email Integration** - Send completed briefing to studio

**Reference Image Tagger:**
1. **Authentication** - Supabase Auth with middleware protection
2. **Dashboard** - Stats, admin controls, recent activity
3. **Login System** - Email/password with redirect support
4. **Single Image Tagger** - Upload, AI suggestions, manual tagging
5. **Gallery** - Browse, search, filter, edit images, bulk edit
6. **Vocabulary Management** - View, edit, add, merge tags with analytics
7. **Vocabulary Config System** - Full replacement UI at `/tagger/vocabulary-config` with JSON paste/upload, validation, and dynamic category support
8. **Tag Usage Tracking** - Automatic increment/decrement via database functions
9. **AI Integration** - Claude Sonnet 4 with baseline and enhanced prompts
10. **Correction Tracking** - Stores AI vs designer decisions for learning
11. **AI Analytics Dashboard** - Comprehensive analytics with metrics, charts, correction patterns, A/B testing controls, and data export
12. **Storage** - Supabase storage for originals and thumbnails (max 800px)
13. **Admin Tools** - Delete all, find duplicates, export data, reset vocabulary
14. **Dynamic Category System** - Truly dynamic vocabulary structure with no database constraints, supports any category names

### 📋 Planned (Not Yet Built)

1. **Bulk Upload Page** - `/tagger/bulk-upload` (placeholder exists)
   - Base tag application
   - Batch AI processing
   - Template system
   - Keyboard shortcuts
   - See detailed plan above

2. **Role-Based Access Control** - Currently all authenticated users have admin access

3. **Image Duplication Detection** - Detect duplicate uploads by filename or hash

### 🐛 Known Minor Issues (Non-Breaking)

- VocabularyClient.tsx:204 - Unused `targetId` parameter in `handleMergeComplete()` (merge feature works but parameter not used)
- Build warnings about linting (skipped via `ignoreDuringBuilds`)

---

## Developer Quick Start

### Running the Application

```bash
# Install dependencies
npm install

# Set up environment variables (copy .env.example if available)
# Add Supabase, Anthropic, and SMTP credentials

# Start development server
npm run dev

# Visit:
# - Portfolio: http://localhost:3000
# - Briefing: http://localhost:3000/briefing
# - Tagger: http://localhost:3000/tagger/login
```

### Key Files to Know

**Configuration:**
- `next.config.ts` - Next.js config (no static export)
- `middleware.ts` - Route protection
- `tailwind.config.js` - Styling config
- `lib/validation.ts` - Zod schemas (~350 lines)
- `lib/types.ts` - TypeScript types (~200 lines)

**Supabase:**
- `lib/supabase.ts` - Client factories
- `supabase/migrations/*.sql` - Database migrations

**Main Components:**
- `components/tagger/ImageTaggerClient.tsx` - Tagging interface (~800 lines)
- `components/tagger/GalleryClient.tsx` - Gallery & bulk edit (~900 lines)
- `components/tagger/VocabularyClient.tsx` - Vocabulary management (~700 lines)
- `components/briefing/BriefingClient.tsx` - Briefing flow

**API Routes:**
- `app/api/suggest-tags/route.ts` - AI tag suggestions (~620 lines)
- `app/api/vocabulary-config/replace/route.ts` - Vocabulary replacement (~200 lines)
- `app/api/search-references/route.ts` - Reference bank search (~150 lines)
- `app/api/send-briefing/route.ts` - Email briefing (~400 lines)
- `app/api/extract-keywords/route.ts` - Claude Haiku keyword extraction (~100 lines)

### Testing the Tagger

1. **Create Supabase Account** and set up project
2. **Run Migrations** in `supabase/migrations/`
3. **Create Storage Buckets:**
   - `reference-images` with subfolders: `originals/`, `thumbnails/`
4. **Set Environment Variables**
5. **Create User** via Supabase Auth dashboard
6. **Test Workflow:**
   ```
   1. Login at /tagger/login
   2. Visit /tagger/dashboard - check stats
   3. Upload images at /tagger
   4. Tag with AI suggestions
   5. View in /tagger/gallery
   6. Edit tags, test bulk edit
   7. Check /tagger/vocabulary for usage counts
   ```

### Next Development Steps

**Priority 1: Implement Bulk Upload**
- Follow detailed plan in "Bulk Upload Feature" section above
- Reuse existing components from ImageTaggerClient
- Create new BulkUploadClient component
- Test with 50-100 similar images

**Priority 2: Role-Based Access Control**
- Add `user_roles` table to Supabase
- Restrict admin endpoints to admin role
- Hide admin controls from non-admin users
- Add user management page

**Priority 3: Image Duplication Detection**
- Detect duplicate uploads by filename or content hash
- Show warning before uploading duplicates
- Option to skip or replace existing images

---

## Summary

This is a **production-ready Next.js 15 application** with three integrated systems:

1. **Portfolio Website** - Public markdown-driven portfolio
2. **Visual Briefing System** - Client questionnaire with AI keyword extraction and reference search
3. **Reference Image Tagger** - Protected AI-powered image tagging system with dynamic vocabulary

**Key Technical Achievements:**
- ✅ **Truly dynamic vocabulary system** - No database constraints on categories. Replace entire vocabulary structure (categories, tags, weights) via UI without code changes or migrations
- ✅ **AI learning from corrections** - Enhanced prompts analyze historical correction patterns and adapt suggestions in real-time
- ✅ **Complete vocabulary management UI** - Full-featured replacement workflow with JSON upload/paste, validation, and template generation
- ✅ **Comprehensive analytics dashboard** - Track AI accuracy, correction patterns, prompt performance with data export
- ✅ **Supabase authentication** with middleware-based route protection
- ✅ **Tag usage tracking** with atomic database functions for accurate metrics
- ✅ **Briefing system integration** - Dynamic keyword matching to vocabulary with weighted scoring
- ✅ **A/B testing infrastructure** for AI prompt optimization
- ✅ **Bulk editing capabilities** for efficient tag management
- ✅ **Type-safe development** with comprehensive Zod validation

**Architecture Highlights:**
- Server-side API routes for AI and database operations
- Client-side state management for complex UIs
- Type-safe development with TypeScript
- Separation of concerns (portfolio, briefing, tagger)
- Scalable database design with PostgreSQL
- Professional error handling and validation
