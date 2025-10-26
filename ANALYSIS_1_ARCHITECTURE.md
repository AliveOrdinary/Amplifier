# Stage 1: Architecture Overview

**Analysis Date:** October 26, 2025
**Project:** Amplifier (Eldho's Portfolio + Design Reference Tagger)
**Framework:** Next.js 15.3.1 (App Router)
**Deployment:** Originally Netlify, now Vercel-compatible (server features enabled)

---

## Executive Summary

The Amplifier project is a **dual-purpose application**:
1. **Portfolio Website** - Showcasing graphic design work with Netlify CMS for content management
2. **Reference Image Tagger** - Internal tool for tagging/organizing design references with AI-powered suggestions
3. **Visual Briefing System** - Client-facing questionnaire tool with Are.na integration for mood boards

**Key Architectural Decision:**
The project **removed static export** (`output: 'export'`) to enable server-side features (middleware, API routes, auth) for the tagger system, while maintaining the portfolio as a Next.js SSR app.

---

## Routes Map

### Portfolio Routes (Public, SSR/SSG)
| Route | File | Purpose | Auth Required |
|-------|------|---------|---------------|
| `/` | `app/page.tsx` | Homepage with cycling text, featured projects | No |
| `/about` | `app/about/page.tsx` | Designer bio, profile image | No |
| `/contact` | `app/contact/page.tsx` | Contact info, social media links | No |
| `/projects` | `app/projects/page.tsx` | Project listing page | No |
| `/projects/[slug]` | `app/projects/[slug]/page.tsx` | Dynamic project detail pages | No |

### Briefing System Routes (Public, Server-Side)
| Route | File | Purpose | Auth Required |
|-------|------|---------|---------------|
| `/briefing` | `app/briefing/page.tsx` | Multi-step client questionnaire with keyword extraction and Are.na integration | No |

### Tagger System Routes (Protected, Server-Side)
| Route | File | Purpose | Auth Required |
|-------|------|---------|---------------|
| `/tagger/login` | `app/tagger/login/page.tsx` | Supabase auth login page | No (public access) |
| `/tagger/dashboard` | `app/tagger/dashboard/page.tsx` | Main dashboard with stats, admin controls | Yes (Supabase) |
| `/tagger` | `app/tagger/page.tsx` | Single image upload & tagging interface | Yes |
| `/tagger/gallery` | `app/tagger/gallery/page.tsx` | Browse, search, edit tagged images | Yes |
| `/tagger/vocabulary` | `app/tagger/vocabulary/page.tsx` | Manage tag vocabulary, view analytics | Yes |
| `/tagger/vocabulary-config` | `app/tagger/vocabulary-config/page.tsx` | Configure dynamic vocabulary structure | Yes |
| `/tagger/ai-analytics` | `app/tagger/ai-analytics/page.tsx` | AI accuracy analytics (placeholder) | Yes |

**Auth Protection:**
Middleware (`middleware.ts`) protects all `/tagger/*` routes except `/tagger/login`. Uses Supabase session cookies.

---

## Component Structure

### Shared Components (9 components)
**Location:** `/components/`

| Component | Purpose | Used By |
|-----------|---------|---------|
| `Layout.tsx` | Root layout wrapper (Header + Footer) | All pages |
| `Header.tsx` | Fixed header with hamburger menu, infinite scrolling nav overlay | Layout |
| `Footer.tsx` | Site footer | Layout |
| `HomePageClient.tsx` | Homepage client interactions, cycling text | Homepage |
| `AboutPageClient.tsx` | About page client interactions | About page |
| `CyclingText.tsx` | Animated text cycling component | HomePageClient |
| `ProjectCard.tsx` | Project preview card for listings | Projects page |
| `ProjectMedia.tsx` | Renders images/videos with captions, audio controls | Project detail |
| `ExpandableSummary.tsx` | Collapsible summary component | Project detail |

### Feature: Briefing Components (9 components)
**Location:** `/components/briefing/`

| Component | LOC | Purpose |
|-----------|-----|---------|
| `BriefingClient.tsx` | 630 | Main orchestrator for multi-step briefing flow |
| `QuestionStep.tsx` | - | Individual question step in questionnaire |
| `StepIndicator.tsx` | - | Progress bar for questionnaire |
| `KeywordExtraction.tsx` | - | AI-powered keyword extraction from responses |
| `KeywordEditor.tsx` | - | Manual keyword editing interface |
| `ImageGallery.tsx` | - | Are.na image gallery display |
| `ImageCard.tsx` | - | Individual image card in gallery |
| `ReferenceImageCard.tsx` | - | Reference image card for Supabase search |
| `BriefingSummary.tsx` | - | Final summary before submission |
| `SuccessScreen.tsx` | - | Post-submission success message |

### Feature: Tagger Components (7 components)
**Location:** `/components/tagger/`

| Component | LOC | Purpose | Complexity |
|-----------|-----|---------|------------|
| `ImageTaggerClient.tsx` | **1892** | Single image upload, AI suggestions, tag management | **VERY HIGH** ⚠️ |
| `VocabularyClient.tsx` | **1639** | Vocabulary management, analytics, tag merging | **HIGH** ⚠️ |
| `GalleryClient.tsx` | **1497** | Browse, search, edit, bulk edit images | **HIGH** ⚠️ |
| `DashboardClient.tsx` | - | Dashboard stats, admin controls, recent activity | Medium |
| `VocabularyConfigClient.tsx` | - | Configure dynamic category structure | Medium |
| `AIAnalyticsClient.tsx` | - | AI correction analytics (placeholder, not implemented) | Low |
| `LoginClient.tsx` | - | Supabase email/password login form | Low |
| `SignOutButton.tsx` | - | Sign out button component | Low |

**⚠️ CRITICAL FINDING:**
Three monolithic components over 1400 lines each - prime candidates for refactoring (see Stage 3).

---

## API Routes

### AI & ML Routes
| Route | Purpose | External Service | Auth |
|-------|---------|------------------|------|
| `/api/suggest-tags` | Claude AI tag suggestions for images | Anthropic Claude Sonnet 4.5 | Supabase (service role) |
| `/api/extract-keywords` | Extract keywords from briefing responses | Anthropic Claude | Public |
| `/api/retrain-prompt` | Retrain AI prompt based on corrections | Anthropic Claude | Supabase (service role) |

### Data & Search Routes
| Route | Purpose | Data Source | Auth |
|-------|---------|-------------|------|
| `/api/search-references` | Search tagged reference images by keywords | Supabase | Public (for briefing) |
| `/api/search-arena` | Search Are.na channel by keywords | Are.na API | Public |
| `/api/vocabulary-config` | Get/update vocabulary configuration | Supabase | Supabase (service role) |
| `/api/vocabulary-config/replace` | Replace entire vocabulary structure | Supabase | Supabase (service role) |

### Communication Routes
| Route | Purpose | External Service | Auth |
|-------|---------|------------------|------|
| `/api/send-briefing` | Email briefing submission to studio | Nodemailer (SMTP) | Public (spam risk if no rate limiting) |

---

## Netlify References Found

### Active Netlify Integrations
1. **`netlify.toml`** - Build configuration
   - Build command: `npm run build`
   - Publish directory: `out` (⚠️ **OUTDATED** - project no longer uses static export)
   - Redirects: SPA fallback to `index.html`
   - Plugin: `@netlify/plugin-nextjs`

2. **`public/admin/config.yml`** - Netlify CMS Configuration
   - Backend: `git-gateway` (requires Netlify Identity)
   - Collections: Projects, Pages (About/Contact/Home), Global Settings
   - Media folder: `public/images/uploads/{{slug}}`
   - Fields: 40+ fields for project metadata

3. **`app/layout.tsx`** - Netlify Identity Widget
   - Script tags for Netlify Identity initialization
   - Enables admin login to `/admin` CMS

### Portfolio Content Management
- Managed via Netlify CMS at `/admin` (requires Netlify Identity)
- Content stored in `content/` directory as markdown files
- Projects: `content/projects/*.md`
- Pages: `content/pages/about.md`, `contact.md`, `home.md`
- Global: `content/global/info.md`

### ⚠️ CONFLICT DETECTED
**Issue:** `netlify.toml` specifies `publish = "out"` (static export), but `next.config.ts` removed `output: 'export'` to enable server features for tagger.

**Impact:**
- If deployed to Netlify: Build will work, but server features (middleware, API routes) may not function correctly on Netlify's CDN
- If deployed to Vercel: Full functionality (recommended)

**Recommendation:**
- Update `netlify.toml` to use Netlify's serverless functions adapter OR
- Deploy to Vercel and migrate Netlify CMS to alternative (Sanity, Contentful, or GitHub-based editing)

---

## Configuration Files

### Core Configuration
| File | Purpose | Key Settings |
|------|---------|--------------|
| `next.config.ts` | Next.js configuration | `images.unoptimized: true`, removed `output: 'export'`, ESLint skip in production |
| `tailwind.config.js` | Tailwind CSS configuration | Custom colors (`custom-bg: #f7f7f7`), custom fonts (PP Neue Montreal, Right Serif), typography plugin |
| `tsconfig.json` | TypeScript configuration | Standard Next.js setup with path aliases |
| `package.json` | Dependencies & scripts | See Dependencies section below |
| `eslint.config.mjs` | ESLint rules | Next.js defaults |
| `postcss.config.mjs` | PostCSS configuration | Tailwind processing |

### Environment Variables (`.env.local`)
**Required Variables:**
```bash
# AI & ML
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
STUDIO_EMAIL=eldhosekuriyan@gmail.com

# Supabase (Tagger System)
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Middleware Configuration
**File:** `middleware.ts`

**Purpose:** Protect `/tagger/*` routes with Supabase auth

**Logic:**
1. Allow all non-tagger routes (portfolio, briefing)
2. Allow `/tagger/login` (public)
3. Check Supabase session for all other `/tagger/*` routes
4. Redirect to login if no session, preserving return URL

**Security:** ✅ Properly configured, session-based auth

---

## Dependencies Overview

### Core Dependencies (12 packages)
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.3.1 | React framework (App Router) |
| `react` | 19.0.0 | UI library |
| `react-dom` | 19.0.0 | React DOM renderer |
| `typescript` | 5.x | Type safety |
| `tailwindcss` | 4.x | CSS framework |
| `@tailwindcss/typography` | 0.5.16 | Markdown styling |
| `framer-motion` | 12.9.7 | Animations (cycling text, header menu) |
| `react-masonry-css` | 1.0.16 | Gallery grid layout |
| `gray-matter` | 4.0.3 | Markdown frontmatter parsing |
| `remark` | 15.0.1 | Markdown to HTML conversion |
| `remark-html` | 16.0.1 | Remark HTML plugin |
| `zod` | 4.1.12 | Runtime type validation |

### External Services (3 packages)
| Package | Version | Purpose | API Key Required |
|---------|---------|---------|------------------|
| `@anthropic-ai/sdk` | 0.67.0 | Claude AI for tag suggestions & keyword extraction | Yes |
| `@supabase/supabase-js` | 2.76.0 | PostgreSQL database, auth, storage | Yes |
| `@supabase/ssr` | 0.7.0 | Supabase server-side rendering | - |
| `nodemailer` | 7.0.9 | Email sending (briefing submissions) | SMTP credentials |

### Development Dependencies (7 packages)
All standard Next.js + TypeScript + Tailwind setup.

### Supabase Schema (Database)
**Tables:**
1. **`tag_vocabulary`** - Controlled tag vocabulary with usage tracking
2. **`reference_images`** - Tagged images with AI suggestions and corrections
3. **`tag_corrections`** - AI accuracy tracking for model improvement
4. **`vocabulary_config`** - Dynamic category structure configuration

**Storage Buckets:**
- `reference-images/originals/` - Original uploaded images
- `reference-images/thumbnails/` - Auto-generated thumbnails (max 800px)

**Database Functions:**
- `increment_tag_usage()` - Atomic usage count increment
- `decrement_tag_usage()` - Atomic usage count decrement

---

## Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────┐
│                        AMPLIFIER PROJECT                         │
│            Next.js 15 App Router + TypeScript + Supabase        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
        ┌───────────▼──────────┐   ┌───────────▼──────────┐
        │  PORTFOLIO WEBSITE   │   │  REFERENCE TAGGER    │
        │  (Public, CMS-based) │   │  (Auth-protected)    │
        └──────────────────────┘   └──────────────────────┘
                    │                           │
        ┌───────────┴───────────┐   ┌───────────┴───────────┐
        │ ROUTES:               │   │ ROUTES:               │
        │ / (home)              │   │ /tagger/dashboard     │
        │ /about                │   │ /tagger (tag images)  │
        │ /contact              │   │ /tagger/gallery       │
        │ /projects             │   │ /tagger/vocabulary    │
        │ /projects/[slug]      │   │ /tagger/login         │
        │ /briefing             │   │ /tagger/ai-analytics  │
        └───────────┬───────────┘   └───────────┬───────────┘
                    │                           │
        ┌───────────▼───────────┐   ┌───────────▼───────────┐
        │ CONTENT SOURCE:       │   │ DATA SOURCE:          │
        │ Markdown files in     │   │ Supabase PostgreSQL   │
        │ content/ directory    │   │ + Storage buckets     │
        │ (managed via          │   │                       │
        │  Netlify CMS)         │   │ AUTH: Supabase Auth   │
        └───────────┬───────────┘   └───────────┬───────────┘
                    │                           │
        ┌───────────▼───────────────────────────▼───────────┐
        │            API ROUTES (/app/api/)                 │
        ├───────────────────────────────────────────────────┤
        │ /suggest-tags       → Claude AI (Anthropic)       │
        │ /extract-keywords   → Claude AI (Anthropic)       │
        │ /retrain-prompt     → Claude AI (Anthropic)       │
        │ /search-references  → Supabase (reference_images) │
        │ /search-arena       → Are.na API                  │
        │ /send-briefing      → Nodemailer (SMTP)           │
        │ /vocabulary-config  → Supabase (vocabulary_config)│
        └───────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────▼─────────────────────────┐
        │              EXTERNAL SERVICES                     │
        ├────────────────────────────────────────────────────┤
        │ Anthropic Claude Sonnet 4.5  (AI suggestions)     │
        │ Supabase                     (DB, Auth, Storage)  │
        │ Nodemailer                   (Email via SMTP)     │
        │ Are.na                       (Mood board images)  │
        │ Netlify CMS + Identity       (Portfolio content)  │
        └────────────────────────────────────────────────────┘
```

---

## How Everything Connects

### Portfolio Workflow
1. Designer logs into Netlify CMS at `/admin` (Netlify Identity)
2. Creates/edits projects in `content/projects/*.md`
3. CMS commits changes to Git repo
4. Next.js reads markdown files via `lib/markdown.ts`
5. Server-side generates static pages with `getStaticParams()`
6. Deployed to Netlify or Vercel

### Briefing Workflow
1. Client visits `/briefing` (public)
2. Fills out multi-step questionnaire (`BriefingClient.tsx`)
3. AI extracts keywords from responses (`/api/extract-keywords`)
4. Keywords used to search Are.na channel (`/api/search-arena`)
5. Client selects favorite mood board images
6. **NEW:** Keywords also search Supabase reference images (`/api/search-references`)
7. Form submission emailed to studio (`/api/send-briefing` via Nodemailer)

### Tagger Workflow
1. Designer logs in at `/tagger/login` (Supabase Auth)
2. Uploads images to `/tagger` (single) or `/tagger/bulk-upload` (batch)
3. Images stored in Supabase Storage (`reference-images/originals/`)
4. AI analyzes image and suggests tags (`/api/suggest-tags` → Claude)
5. Designer reviews/edits tags, saves to `reference_images` table
6. Tag usage tracked in `tag_vocabulary` (times_used, last_used_at)
7. Corrections stored in `tag_corrections` for AI improvement
8. Images browsable in `/tagger/gallery` with search/filter
9. Vocabulary managed in `/tagger/vocabulary`

### Tag Suggestion AI Loop
1. Image uploaded → resized to 1200px
2. Sent to Claude API with dynamic vocabulary structure
3. Claude returns suggestions with confidence score
4. Designer accepts/modifies suggestions
5. Corrections tracked (tags_added, tags_removed)
6. Future: `/api/retrain-prompt` uses corrections to improve prompts

---

## Known Issues & Technical Debt

### Configuration Conflicts
1. **Netlify vs Vercel:** `netlify.toml` expects static export, but `next.config.ts` removed it
   - **Impact:** Deployment confusion, server features may not work on Netlify
   - **Priority:** HIGH

2. **ESLint Disabled in Production:** `ignoreDuringBuilds: true` in `next.config.ts`
   - **Reason:** "Pre-existing lint errors unrelated to recent changes"
   - **Impact:** Lint errors not caught before deployment
   - **Priority:** MEDIUM

### Code Quality
3. **Monolithic Components:**
   - `ImageTaggerClient.tsx`: 1892 lines
   - `VocabularyClient.tsx`: 1639 lines
   - `GalleryClient.tsx`: 1497 lines
   - **Impact:** Hard to maintain, test, and refactor
   - **Priority:** HIGH (see Stage 3)

4. **Debug Console.logs in Production:**
   - `middleware.ts` has DEBUG logs (lines 8, 12, 19, 78, 79, 85, 90)
   - **Impact:** Pollutes production console
   - **Priority:** LOW

### Incomplete Features
5. **AI Analytics Page:** `/tagger/ai-analytics` is placeholder
   - `AIAnalyticsClient.tsx` exists but not implemented
   - **Priority:** LOW (nice-to-have)

6. **Bulk Upload:** `/tagger/bulk-upload` page planned but not built
   - Documented in CLAUDE.md but not implemented
   - **Priority:** LOW (productivity enhancement)

### Security Considerations
7. **Public Briefing Endpoint:** `/api/send-briefing` has no rate limiting
   - **Risk:** Email spam if abused
   - **Priority:** MEDIUM (once site goes public)

8. **Service Role Key in API Routes:** Some routes use `SUPABASE_SERVICE_ROLE_KEY`
   - Used for: `/api/suggest-tags`, `/api/search-references`, `/api/vocabulary-config`
   - **Security:** ✅ Properly scoped to backend only (not exposed to client)
   - **Priority:** LOW (already secure)

---

## Summary & Recommendations

### Strengths ✅
- **Well-documented:** Extensive CLAUDE.md, multiple analysis docs
- **Modern stack:** Next.js 15, React 19, TypeScript, Tailwind 4
- **Feature-complete:** Both portfolio and tagger systems functional
- **Auth properly implemented:** Middleware + Supabase session cookies
- **AI integration:** Claude API for tag suggestions and keyword extraction
- **Database design:** Proper RLS policies, usage tracking, corrections tracking

### Critical Issues ⚠️
1. **Deployment confusion:** Netlify config outdated, need to choose Netlify or Vercel
2. **Monolithic components:** 3 files over 1400 lines each need refactoring
3. **Lint errors ignored:** Production builds skip linting

### Next Steps (For Subsequent Stages)
- **Stage 2:** Find unused imports, dead code, commented-out blocks in monolithic files
- **Stage 3:** Break down `ImageTaggerClient`, `GalleryClient`, `VocabularyClient` into smaller modules
- **Stage 4:** Fix magic numbers, improve accessibility, remove debug logs
- **Stage 5:** Add React.memo, code splitting, image optimization
- **Stage 6:** Security audit (RLS policies, input validation, XSS protection)
- **Stage 7:** Prioritized refactoring roadmap with time estimates

### Overall Grade: B+ (Good architecture, needs cleanup)
**Reasoning:**
- Solid foundation with modern tools
- Functional features with good UX
- Technical debt in code organization (monolithic files)
- Deployment strategy needs clarification
- No critical security issues found
