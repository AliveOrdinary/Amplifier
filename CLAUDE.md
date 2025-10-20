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
