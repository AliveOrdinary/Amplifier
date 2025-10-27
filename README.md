# Amplifier Portfolio & Reference Image Tagger

A dual-purpose Next.js application combining a graphic design portfolio with an AI-powered reference image tagging system.

## Features

**Portfolio Website:**
- Responsive design for all devices
- File-based content management with markdown
- Fast page loading with Next.js App Router
- High-quality image optimization

**Reference Image Tagger:**
- AI-powered tag suggestions (Claude Sonnet 4)
- Dynamic vocabulary system
- Supabase authentication and storage
- Comprehensive analytics dashboard

**Visual Briefing System:**
- Interactive client questionnaire
- AI keyword extraction
- Reference image search integration

## Setup

### Prerequisites

- Node.js (v16 or newer)
- npm or yarn

### Installation

1. Clone this repository
```bash
git clone https://github.com/yourusername/portfolio.git
cd portfolio
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run dev
```

4. Open http://localhost:3000 in your browser

## Content Management

Portfolio content is managed through markdown files in the `content/` directory:

- `content/global/info.md` - Site-wide settings (navigation, footer, site title)
- `content/pages/` - Page-specific content (home.md, about.md, contact.md)
- `content/projects/` - Project case studies (each project is a separate .md file)

**To add new projects:** See the comprehensive guide at [`docs/ADDING_PROJECTS.md`](docs/ADDING_PROJECTS.md)

**Quick start:** Create a markdown file in `content/projects/`, add frontmatter with project details, upload media to `public/images/uploads/[project-slug]/`, commit and deploy.

## Project Structure

- `app/` - Next.js app router pages and layouts (portfolio + tagger + briefing)
- `components/` - React components (Layout, Tagger, Briefing components)
- `content/` - Markdown content for portfolio
- `lib/` - Utility functions (Supabase, validation, markdown processing)
- `public/` - Static assets
- `supabase/migrations/` - Database migrations

## Deployment

**Requirements:**
- Node.js runtime (Vercel, Netlify Functions, or Node.js server)
- Supabase project with configured database and storage
- Environment variables (see CLAUDE.md for full list)

**Build Settings:**
- Build command: `npm run build`
- Output directory: `.next`
- Node.js version: 18 or newer

**Note:** This application requires server-side features and cannot be deployed as a static site.

## License

This project is licensed under the MIT License.
