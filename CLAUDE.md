# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a portfolio website for a graphic designer built with Next.js 15 (App Router), TypeScript, and Tailwind CSS. The site uses Netlify CMS for content management and is configured for static export deployment to Netlify.

## Development Commands

```bash
# Start development server (runs on localhost:3000)
npm run dev

# Build for production (static export)
npm run build

# Start production server (after build)
npm start

# Run linting
npm run lint
```

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

- `app/layout.tsx` - Root layout with Google Fonts (Geist Sans/Mono) and Netlify Identity scripts
- `app/page.tsx` - Homepage (server component that fetches content, delegates to HomePageClient)
- `app/about/page.tsx` - About page
- `app/contact/page.tsx` - Contact page
- `app/projects/page.tsx` - Projects listing page
- `app/projects/[slug]/page.tsx` - Dynamic project detail pages (uses generateStaticParams)

### Component Architecture

**Layout Components:**
- `Layout.tsx` - Wrapper component that includes Header and Footer
- `Header.tsx` - Fixed header with hamburger menu, infinite scrolling navigation overlay
- `Footer.tsx` - Site footer

**Client Components** (use 'use client' directive):
- `HomePageClient.tsx` - Homepage with cycling text animation
- `AboutPageClient.tsx` - About page client interactions
- `CyclingText.tsx` - Animated text cycling component
- `Header.tsx` - Header with interactive menu state

**Project Components:**
- `ProjectCard.tsx` - Project preview card for listings
- `ProjectMedia.tsx` - Renders images or videos with optional captions and audio controls
- `ExpandableSummary.tsx` - Collapsible summary component for project details

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

### Static Export Configuration

The site is configured for static export (`next.config.ts`):
- `output: 'export'` - Static HTML export
- `images.unoptimized: true` - No Next.js image optimization (required for static export)
- Remote image patterns allowed for all HTTPS hosts

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

## Netlify Deployment

The site deploys to Netlify with:
- Build command: `npm run build`
- Publish directory: `out`
- Netlify CMS configuration: `public/admin/config.yml`
- Identity and Git Gateway required for CMS access

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
   - `category` (text) - industry | project_type | style | mood | elements
   - `tag_value` (text) - The tag itself (lowercase, normalized)
   - `description` (text, nullable) - Optional description
   - `sort_order` (integer) - Display order within category
   - `is_active` (boolean) - Enable/disable tags
   - `times_used` (integer) - Usage count (auto-incremented)
   - `last_used_at` (timestamptz, nullable) - Last usage timestamp
   - `created_at` (timestamptz) - Creation timestamp
   - `added_by` (uuid, nullable) - Future: user ID

2. **`reference_images`** - Tagged images
   - `id` (uuid, PK)
   - `storage_path` (text) - Supabase Storage URL for original
   - `thumbnail_path` (text) - Supabase Storage URL for thumbnail
   - `original_filename` (text) - Original filename
   - `industries` (text[]) - Industry tags
   - `project_types` (text[]) - Project type tags
   - `tags` (jsonb) - Object with `{ style: [], mood: [], elements: [] }`
   - `notes` (text, nullable) - Optional designer notes
   - `status` (text) - pending | tagged | approved | skipped
   - `tagged_at` (timestamptz) - When tagged
   - `updated_at` (timestamptz) - Last update
   - `ai_suggested_tags` (jsonb, nullable) - Original AI suggestions
   - `ai_confidence_score` (float, nullable) - AI confidence (0.3, 0.6, 0.9)
   - `ai_reasoning` (text, nullable) - AI explanation
   - `ai_model_version` (text, nullable) - Model used (e.g., "claude-sonnet-4-20250514")

3. **`tag_corrections`** - Track AI accuracy
   - `id` (uuid, PK)
   - `image_id` (uuid, FK → reference_images)
   - `ai_suggested` (jsonb) - What AI suggested
   - `designer_selected` (jsonb) - What designer chose
   - `tags_added` (text[]) - Tags added by designer
   - `tags_removed` (text[]) - Tags removed from AI suggestions
   - `corrected_at` (timestamptz) - When correction was made

**Database Functions:**
- `increment_tag_usage(category, tag_value, last_used_at)` - Atomically increments usage count
- `decrement_tag_usage(category, tag_value)` - Atomically decrements usage count (never below 0)

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
  - 🤖 AI Analytics → `/tagger/ai-analytics` (placeholder)

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
  - Tag categories: Industries, Project Types, Styles, Moods, Elements
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
  - Category groupings (Industry, Project Type, Style, Mood, Elements)
  - Shows: tag value, times used, last used date, sort order
  - Active/inactive status

- **Tag Actions:**
  - Edit tag (change value, description, sort order, active status)
  - Merge tags (combine duplicates, updates all references)
  - Add new tag (with fuzzy matching to prevent duplicates)
  - Drag & drop reordering (future feature)

- **Analytics View:**
  - Most Used (top 10)
  - Least Used (bottom 10, excludes never used)
  - Recently Added (last 30 days)
  - Never Used (candidates for removal)

### AI Tag Suggestion System

**API Endpoint:** `/api/suggest-tags`
**Model:** Claude Sonnet 4.5 (`claude-sonnet-4-20250514`)

**Process:**
1. Client resizes image to max 1200px (keeps under 5MB API limit)
2. Converts to base64 data URI
3. Sends image + vocabulary to API
4. Claude analyzes image and suggests tags from vocabulary
5. Returns JSON: `{ industries[], projectTypes[], styles[], moods[], elements[], confidence, reasoning }`
6. Client auto-applies suggestions (merges with any existing manual selections)
7. Designer can adjust before saving

**Confidence Levels:**
- `high` (0.9) - Very confident in suggestions
- `medium` (0.6) - Reasonably confident
- `low` (0.3) - Uncertain, needs review

**Correction Tracking:**
- When saving, compares AI suggestions vs final designer selections
- Calculates `tags_added` (designer added beyond AI)
- Calculates `tags_removed` (designer removed from AI suggestions)
- Stores in `tag_corrections` table for model improvement

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

### Known Issues & Future Improvements

**Current Limitations:**
1. No user authentication (admin controls are open)
2. No image duplication detection during upload
3. No keyboard shortcuts in standard tagger (see bulk upload plan below)
4. No template system for common tag combinations
5. Analytics page (`/tagger/ai-analytics`) not yet implemented

**VocabularyClient Warnings:**
- Line 127: Unused `targetId` parameter (drag & drop feature incomplete)
- Line 560: `any` type in event handler (should be typed)

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

## Current System Status (✅ Fully Working)

**✅ Working Features:**
1. **Dashboard** - All stats, admin controls, recent activity
2. **Standard Tagger** - Single image upload, AI suggestions, tag management
3. **Gallery** - Browse, search, filter, edit images, bulk edit
4. **Vocabulary Management** - View, edit, add tags, analytics
5. **Tag Usage Tracking** - Automatic increment/decrement on save/edit
6. **AI Integration** - Claude API for tag suggestions with corrections tracking
7. **Storage** - Supabase storage for originals and thumbnails

**⏸ Planned (Not Yet Built):**
1. **Bulk Upload Page** - `/tagger/bulk-upload` (placeholder exists)
2. **AI Analytics Page** - `/tagger/ai-analytics` (not created)
3. **User Authentication** - (future enhancement)

**🐛 Minor Issues (Non-Breaking):**
- ImageTaggerClient.tsx:80 - `aiError` state declared but unused (harmless)
- VocabularyClient.tsx - Pre-existing TypeScript warnings (not critical)

### Next Steps When Resuming Development

1. **Test Current System:**
   ```bash
   npm run dev
   # Visit http://localhost:3000/tagger/dashboard
   # Test "Delete All Images" to clear test data
   # Upload and tag a few test images
   # Verify tag usage tracking in vocabulary page
   ```

2. **Implement Bulk Upload** (when ready):
   - Follow "Implementation Approach - Option A" above
   - Reference ImageTaggerClient.tsx for reusable components
   - Test with 50 similar images

3. **Build AI Analytics Page:**
   - Create `/app/tagger/ai-analytics/page.tsx`
   - Show correction trends over time
   - Most commonly added/removed tags
   - AI accuracy by category
   - Suggest vocabulary improvements
