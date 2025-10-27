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
