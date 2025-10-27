# Adding New Portfolio Projects

**Last Updated:** October 27, 2025

A comprehensive guide for adding new projects to the Amplifier portfolio website.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Step-by-Step Guide](#step-by-step-guide)
4. [Field Reference](#field-reference)
5. [Media Management](#media-management)
6. [Project Template](#project-template)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Portfolio projects are stored as markdown files in the `content/projects/` directory. Each project is defined using **YAML frontmatter** (metadata) at the top of the file.

### How It Works:

1. Create a new `.md` file in `content/projects/`
2. Add YAML frontmatter with project details
3. Upload media files to `public/images/uploads/[project-slug]/`
4. Commit changes to git
5. Deploy (project automatically appears on site)

### File Naming Convention:

Use lowercase with hyphens: `my-project-name.md`

Example: `crums.md`, `tech-startup.md`, `restaurant-rebrand.md`

---

## Quick Start

**5-Minute New Project:**

1. **Create file:** `content/projects/my-new-project.md`
2. **Copy template** from [Project Template](#project-template) section below
3. **Fill in details** (title, slug, summary, year, services)
4. **Upload images** to `public/images/uploads/my-new-project/`
5. **Add image paths** to frontmatter
6. **Set order** and `featured` status
7. **Commit and deploy**

---

## Step-by-Step Guide

### Step 1: Create Media Folder

Before creating the markdown file, organize your media:

```bash
# Create project media folder
mkdir -p public/images/uploads/my-new-project

# Add your images/videos to this folder
cp ~/Downloads/hero-image.jpg public/images/uploads/my-new-project/
cp ~/Downloads/gallery-1.jpg public/images/uploads/my-new-project/
```

**Supported Formats:**
- **Images:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
- **Videos:** `.mp4`, `.webm`, `.mov`

**Recommended Sizes:**
- Hero images: 1920x1080px or larger
- Gallery images: 1200px width minimum
- File size: Keep under 5MB per file (optimize images)

---

### Step 2: Create Markdown File

Create a new file in `content/projects/`:

```bash
touch content/projects/my-new-project.md
```

**Important:** The filename becomes part of the URL:
- `crums.md` → `/projects/crums`
- `tech-startup.md` → `/projects/tech-startup`

---

### Step 3: Add Frontmatter

Open the file and add YAML frontmatter between `---` markers:

```yaml
---
title: My New Project
slug: my-new-project
featuredImage: /images/uploads/my-new-project/hero.jpg
shortSummary: A brief one-sentence description of the project (max 160 characters).
mainSummary: |
  ## The Challenge

  Detailed description of the project challenge...

  ## The Solution

  How you solved the problem...
year: 2025
services:
  - Branding
  - Web Design
projectImages:
  - order: 1
    image: /images/uploads/my-new-project/image-1.jpg
    caption: Optional caption for this image
featured: true
order: 1
---
```

---

### Step 4: Configure Display Order

**Two order fields:**

1. **`order`** (required) - Controls position in projects list
   - Lower numbers appear first (1, 2, 3...)
   - Projects are sorted by this field on `/projects` page

2. **`featured`** (required) - Show on homepage?
   - `true` - Appears on homepage featured section
   - `false` - Only visible on `/projects` page

**Example Ordering:**

If you have 5 projects and want order:
1. Crums (featured)
2. Tech Startup (featured)
3. Restaurant Rebrand
4. Book Cover
5. Music Festival Poster (featured)

```yaml
# crums.md
order: 1
featured: true

# tech-startup.md
order: 2
featured: true

# restaurant-rebrand.md
order: 3
featured: false

# book-cover.md
order: 4
featured: false

# music-festival.md
order: 5
featured: true
```

---

### Step 5: Add Media Items

**Images:**

```yaml
projectImages:
  - order: 1
    image: /images/uploads/my-project/hero.jpg
    caption: Hero shot of the final product
  - order: 2
    image: /images/uploads/my-project/detail.jpg
    caption: Close-up detail
  - order: 3
    image: /images/uploads/my-project/mockup.png
```

**Videos:**

```yaml
projectVideos:
  - order: 1
    video: /images/uploads/my-project/animation.mp4
    hasAudio: false
    caption: Logo animation
  - order: 2
    video: /images/uploads/my-project/presentation.mp4
    hasAudio: true
    caption: Client presentation with voiceover
```

**Mixed Media (Images + Videos):**

Media items are sorted by the `order` field across both types:

```yaml
projectImages:
  - order: 1
    image: /images/uploads/my-project/hero.jpg
  - order: 3
    image: /images/uploads/my-project/detail.jpg

projectVideos:
  - order: 2
    video: /images/uploads/my-project/animation.mp4
    hasAudio: false
  - order: 4
    video: /images/uploads/my-project/showcase.mp4
    hasAudio: true
```

**Display Order:** Image (1) → Video (2) → Image (3) → Video (4)

---

### Step 6: Set Featured Media

**Choose between featured image OR featured video** (video takes precedence):

**Option A: Featured Image Only**

```yaml
featuredImage: /images/uploads/my-project/hero.jpg
featuredVideo: ""
```

**Option B: Featured Video Only**

```yaml
featuredImage: ""
featuredVideo: /images/uploads/my-project/hero-video.mp4
featuredVideoHasAudio: true
```

**Option C: Both (Video Takes Precedence)**

If both are provided, the video will be used:

```yaml
featuredImage: /images/uploads/my-project/fallback.jpg
featuredVideo: /images/uploads/my-project/hero-video.mp4
featuredVideoHasAudio: false
```

---

### Step 7: Commit and Deploy

```bash
# Stage changes
git add content/projects/my-new-project.md
git add public/images/uploads/my-new-project/

# Commit
git commit -m "Add new project: My New Project"

# Push to deploy
git push origin main
```

The project will automatically appear on your site after deployment completes.

---

## Field Reference

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | Project name | `"Crums"` |
| `slug` | string | URL-friendly identifier (must match filename) | `"crums"` |
| `shortSummary` | string | Brief description (max 160 chars) | `"A startup bringing South Indian snacks..."` |
| `mainSummary` | string | Detailed description (supports markdown) | `"## The Challenge\n\nDescription..."` |
| `year` | number | Project completion year | `2025` |
| `services` | array | List of services provided | `["Branding", "Web Design"]` |
| `featured` | boolean | Show on homepage? | `true` or `false` |
| `order` | number | Display position (1 = first) | `1` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `featuredImage` | string | Hero image path | `"/images/uploads/crums/hero.jpg"` |
| `featuredVideo` | string | Hero video path | `"/images/uploads/crums/video.mp4"` |
| `featuredVideoHasAudio` | boolean | Does featured video have audio? | `true` or `false` |
| `projectImages` | array | Gallery images | See [Media Management](#media-management) |
| `projectVideos` | array | Gallery videos | See [Media Management](#media-management) |

### Available Services

Pre-defined service categories (you can use any combination):

- **Branding**
- **Web Design**
- **Print**
- **Packaging**
- **UI/UX**
- **Illustration**
- **Naming**
- **Art Direction**
- **Motion Graphics**
- **Photography**

**Example:**

```yaml
services:
  - Naming
  - Branding
  - Packaging
  - Art Direction
  - Photography
```

---

## Media Management

### Image Metadata

```yaml
projectImages:
  - order: 1                                    # Required: Display position
    image: /images/uploads/project/img.jpg      # Required: File path
    caption: Optional description               # Optional: Image caption
```

### Video Metadata

```yaml
projectVideos:
  - order: 1                                    # Required: Display position
    video: /images/uploads/project/vid.mp4      # Required: File path
    hasAudio: false                             # Optional: Show audio controls?
    caption: Optional description               # Optional: Video caption
```

### Media Paths

**Always use absolute paths from `public/`:**

✅ **Correct:**
```yaml
image: /images/uploads/crums/photo.jpg
```

❌ **Incorrect:**
```yaml
image: public/images/uploads/crums/photo.jpg  # Don't include "public"
image: images/uploads/crums/photo.jpg          # Missing leading slash
image: ../public/images/uploads/crums/photo.jpg # No relative paths
```

### File Organization

**Recommended structure:**

```
public/images/uploads/
├── crums/
│   ├── hero.jpg
│   ├── gallery-1.jpg
│   ├── gallery-2.jpg
│   └── animation.mp4
├── tech-startup/
│   ├── hero.jpg
│   ├── mockup-1.png
│   └── mockup-2.png
└── restaurant-rebrand/
    ├── hero-video.mp4
    ├── logo-reveal.mp4
    └── menu-design.jpg
```

Each project gets its own folder named after the project slug.

---

## Project Template

**Copy this template for new projects:**

```yaml
---
title: Project Name Here
slug: project-name-here
featuredImage: /images/uploads/project-name-here/hero.jpg
featuredVideo: ""
featuredVideoHasAudio: false
shortSummary: A concise one-sentence description of what this project is about (keep under 160 characters for SEO).
mainSummary: |
  ## The Challenge

  Describe the client's problem, business context, and goals. What were they trying to achieve? What obstacles did they face?

  ## The Solution

  Explain your creative approach, design decisions, and how you solved the problem. Highlight unique aspects of your work.

  ## The Results (Optional)

  Share outcomes, metrics, or client feedback if available.
year: 2025
services:
  - Branding
  - Web Design
  - Art Direction
projectImages:
  - order: 1
    image: /images/uploads/project-name-here/image-1.jpg
    caption: Optional caption describing this image
  - order: 2
    image: /images/uploads/project-name-here/image-2.jpg
  - order: 3
    image: /images/uploads/project-name-here/image-3.jpg
projectVideos:
  - order: 4
    video: /images/uploads/project-name-here/video-1.mp4
    hasAudio: false
    caption: Optional caption for video
featured: true
order: 1
---
```

**Minimal template (required fields only):**

```yaml
---
title: Project Name
slug: project-name
featuredImage: /images/uploads/project-name/hero.jpg
shortSummary: Brief project description in one sentence.
mainSummary: |
  ## The Challenge

  Description of the challenge.

  ## The Solution

  Description of the solution.
year: 2025
services:
  - Branding
projectImages:
  - order: 1
    image: /images/uploads/project-name/image.jpg
featured: false
order: 10
---
```

---

## Best Practices

### Content Writing

**Short Summary:**
- Keep under 160 characters (SEO meta description)
- One compelling sentence
- Front-load the most important info
- ✅ Good: "Crums brings South Indian snacks to a new generation with cost-effective packaging that doesn't sacrifice brand presence."
- ❌ Bad: "This is a project I did for a client who wanted packaging."

**Main Summary:**
- Use markdown headers (`##`) for structure
- Break into sections: Challenge, Solution, Results
- Keep paragraphs short (2-3 sentences)
- Use markdown formatting: **bold**, *italic*, lists
- Avoid generic design jargon
- Show your unique approach

### Image Optimization

**Before uploading:**

1. **Resize images:**
   - Hero: 1920x1080px or 2560x1440px
   - Gallery: 1200px-1600px width
   - Don't upload 5000px RAW files

2. **Compress:**
   - Use tools like [TinyPNG](https://tinypng.com) or [ImageOptim](https://imageoptim.com)
   - Target: Under 500KB for photos, under 200KB for graphics
   - JPEG quality: 80-85%

3. **Format:**
   - Photos: `.jpg`
   - Graphics with transparency: `.png`
   - Modern browsers: `.webp` (best compression)

### Video Optimization

**Video specs:**

- **Format:** `.mp4` (H.264 codec)
- **Resolution:** 1920x1080px max
- **Frame rate:** 30fps
- **Bitrate:** 5-8 Mbps for 1080p
- **Length:** Keep under 30 seconds for best performance
- **File size:** Target under 10MB

**Tools:**
- [HandBrake](https://handbrake.fr/) (free compression)
- [CloudConvert](https://cloudconvert.com/) (online converter)
- Adobe Media Encoder (professional)

### SEO & Discoverability

**For better search rankings:**

1. **Descriptive slugs:**
   - ✅ `restaurant-rebrand-vintage-aesthetic`
   - ❌ `project-1`

2. **Keyword-rich short summaries:**
   - Include client industry, project type
   - ✅ "Restaurant rebrand combining vintage typography with modern minimalism for Toronto bistro"
   - ❌ "A branding project"

3. **Alt text via captions:**
   - Add descriptive captions to images
   - Helps screen readers and SEO

4. **Service tags:**
   - Use accurate service categories
   - Helps filtering and categorization

### Order Management

**Strategic ordering:**

1. **Put your best work first** (`order: 1, 2, 3`)
2. **Feature 3-5 projects** on homepage (`featured: true`)
3. **Update order when adding new projects** (don't leave gaps)
4. **Archive old work** (set `featured: false`, high order number)

**Example progression:**

```
order: 1, featured: true   → Latest, best work
order: 2, featured: true   → Recent, strong piece
order: 3, featured: true   → Diverse project (different service)
order: 4, featured: false  → Solid work, not hero piece
order: 5, featured: false  → Older project
...
order: 15, featured: false → Archive (still accessible via /projects)
```

---

## Troubleshooting

### Project Not Appearing on Site

**Check:**

1. ✅ File is in `content/projects/` (not a subfolder)
2. ✅ File has `.md` extension
3. ✅ Frontmatter is between `---` markers
4. ✅ YAML is valid (no tabs, correct indentation with spaces)
5. ✅ Changes committed and pushed to git
6. ✅ Deployment completed successfully

**Test locally:**

```bash
npm run dev
# Visit http://localhost:3000/projects
```

### Images Not Loading

**Check:**

1. ✅ Files are in `public/images/uploads/[project-slug]/`
2. ✅ Paths start with `/images/` (not `/public/images/`)
3. ✅ File extensions match (case-sensitive: `.jpg` vs `.JPG`)
4. ✅ No spaces in filenames (use hyphens: `my-image.jpg`)
5. ✅ Files committed to git

**Test image path:**

Visit: `http://localhost:3000/images/uploads/project-name/image.jpg`

If it loads, the path is correct.

### YAML Syntax Errors

**Common mistakes:**

❌ **Tabs instead of spaces:**
```yaml
services:
→→- Branding  # Tab character (invalid)
```

✅ **Use spaces:**
```yaml
services:
  - Branding  # Two spaces (valid)
```

❌ **Missing quotes for special characters:**
```yaml
shortSummary: Client's description  # Apostrophe breaks YAML
```

✅ **Add quotes:**
```yaml
shortSummary: "Client's description"
```

❌ **Incorrect multiline syntax:**
```yaml
mainSummary: ## The Challenge
This won't work...
```

✅ **Use pipe `|` or `>`:**
```yaml
mainSummary: |
  ## The Challenge

  This works!
```

**Validate YAML:**

Use [YAML Lint](http://www.yamllint.com/) to check syntax.

### Slug Doesn't Match Filename

**Error:** "Project not found" on `/projects/my-project`

**Cause:** Filename is `my-project.md` but slug is `my-new-project`

**Fix:**

```yaml
# Filename: my-project.md
---
slug: my-project  # Must match filename (without .md)
---
```

### Videos Not Playing

**Check:**

1. ✅ Format is `.mp4` (not `.mov`, `.avi`)
2. ✅ Codec is H.264 (re-encode if necessary)
3. ✅ File size under 50MB (large files may timeout)
4. ✅ Browser supports format (test in Chrome/Firefox)

**Re-encode with HandBrake:**
- Preset: "Web" → "Fast 1080p30"
- Video codec: H.264
- Audio codec: AAC

### Featured Video Audio Not Working

**Check:**

```yaml
featuredVideoHasAudio: true  # Must be set to true
```

If video has audio but controls don't appear, the field is missing or set to `false`.

### Project Order Is Wrong

**Check:**

1. All projects have unique `order` values (no duplicates)
2. No gaps in numbering (1, 2, 3... not 1, 5, 10)
3. Changes committed and deployed

**Fix duplicate orders:**

If two projects have `order: 1`, Next.js will use filename as tiebreaker (alphabetical).

**Best practice:** Renumber all projects sequentially:

```bash
# content/projects/
crums.md           → order: 1
tech-startup.md    → order: 2
restaurant.md      → order: 3
```

---

## Quick Reference Checklist

**Before committing a new project:**

- [ ] Markdown file created in `content/projects/`
- [ ] Filename matches `slug` field
- [ ] All required fields present (title, slug, shortSummary, mainSummary, year, services, featured, order)
- [ ] Media files uploaded to `public/images/uploads/[slug]/`
- [ ] Image/video paths correct (start with `/images/`)
- [ ] `order` field set (unique, sequential)
- [ ] `featured` field set (`true` or `false`)
- [ ] Short summary under 160 characters
- [ ] Main summary uses markdown formatting
- [ ] Images optimized (under 500KB each)
- [ ] Videos optimized (under 10MB each)
- [ ] Tested locally (`npm run dev`)
- [ ] YAML syntax validated
- [ ] Changes committed to git
- [ ] Pushed to remote repository

---

## Need Help?

**Resources:**

- **Main documentation:** `CLAUDE.md`
- **Project types:** `lib/types.ts` (lines 22-37)
- **Example project:** `content/projects/crums.md`
- **Markdown guide:** [Markdown Cheatsheet](https://www.markdownguide.org/cheat-sheet/)
- **YAML validator:** [YAML Lint](http://www.yamllint.com/)

**Common tasks:**

- Reorder projects → Edit `order` field in each project's frontmatter
- Hide from homepage → Set `featured: false`
- Change hero image → Update `featuredImage` path
- Add new service type → Just add to `services` array (any string works)
- Archive old project → Set high `order` number (e.g., 99) and `featured: false`

---

**Last Updated:** October 27, 2025
**Document Version:** 1.0
