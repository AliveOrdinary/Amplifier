# Stage 2: Dead Code & Unused Dependencies Analysis

**Analysis Date:** October 26, 2025
**Project:** Amplifier (Eldho's Portfolio + Design Reference Tagger)
**Previous Stage:** [ANALYSIS_1_ARCHITECTURE.md](./ANALYSIS_1_ARCHITECTURE.md)

---

## Executive Summary

This analysis identifies **dead code, unused dependencies, commented-out code, and duplicate patterns** across the Amplifier codebase.

**Key Findings:**
- **1 completely dead file** (never imported)
- **1 unused state variable** in monolithic component
- **1 deprecated schema** (documented but unused)
- **48+ debug console.log statements** in production code
- **1 commented-out line** of code
- **Supabase client creation duplicated 12+ times** across files
- **All npm dependencies are actively used** ✅
- **1 TODO comment** regarding future auth implementation

**Potential Impact:**
- **~130 lines of code can be removed**
- **~48 console.log statements should be removed or replaced with proper logging**
- **Code complexity reduced by consolidating duplicate patterns**

---

## 1. Dead Files (Never Imported)

### Critical: Unused Library File

#### `/lib/supabase-middleware.ts` (60 lines) ❌ DELETE
**Status:** COMPLETELY UNUSED

**What It Does:**
- Exports `createMiddlewareClient()` helper function
- Wrapper for creating Supabase client in middleware context
- Handles cookie management for SSR authentication

**Why It's Dead:**
- **NEVER imported** anywhere in the codebase
- Original `middleware.ts` implements client creation inline instead
- Likely created during initial Supabase setup but abandoned

**Evidence:**
```bash
# Grep search for imports:
grep -r "supabase-middleware" . --include="*.ts" --include="*.tsx"
# Result: No files found
```

**How to Delete Safely:**
```bash
rm lib/supabase-middleware.ts
```

**Why It Was Created:**
Looking at `middleware.ts`, it directly implements Supabase client creation inline (lines 29-73) instead of using this helper. This file was likely scaffolded during initial setup but never integrated.

**Risk of Deletion:** NONE (zero imports)

**Recommendation:** ✅ **DELETE IMMEDIATELY**

---

## 2. Unused State Variables

### ImageTaggerClient.tsx:87

```typescript
const [aiError, setAiError] = useState<Record<string, string | null>>({})
```

**Status:** DECLARED BUT NEVER USED

**Evidence:**
- Declared on line 87
- `setAiError` never called
- `aiError` never read
- Total occurrences in file: 1 (the declaration itself)

**Context:**
The component has extensive AI suggestion logic, but error handling uses `saveError` instead of `aiError`. This state was likely planned but made redundant during refactoring.

**How It's Currently Handled:**
- AI errors are caught and displayed via `saveError` state (line 73)
- AI loading states use `isLoadingAI` (line 86)
- No need for separate AI error tracking

**Recommendation:** ✅ **REMOVE LINE 87**

**Estimated Cleanup:** 1 line

---

## 3. Deprecated Code (Documented)

### lib/validation.ts:161-171

```typescript
// ⚠️ DEPRECATED: Hardcoded category schema - not currently used
// The ImageTaggerClient uses dynamic vocabulary config instead
// Keeping for backward compatibility but should not be used for new code
export const imageTagsSchema = z.object({
  industries: tagArraySchema,
  project_types: tagArraySchema,
  styles: tagArraySchema,
  moods: tagArraySchema,
  elements: tagArraySchema,
  notes: notesSchema,
});
```

**Status:** DEPRECATED, BACKWARD COMPATIBILITY CLAIMED

**Analysis:**
- Created before dynamic vocabulary config system
- Hardcodes 5 tag categories (industries, project_types, styles, moods, elements)
- Replaced by dynamic `vocabularyConfigSchema` (lines 211-244)
- Comment claims "backward compatibility" but **no code uses it**

**Evidence of Non-Use:**
```bash
# Search for imageTagsSchema usage:
grep -r "imageTagsSchema" . --include="*.ts" --include="*.tsx" | grep -v "export const imageTagsSchema"
# Result: Only exported type used (ImageTagsInput), not the schema itself
```

**Type Export Issue:**
```typescript
export type ImageTagsInput = z.infer<typeof imageTagsSchema>; // line 351
```

This type is exported BUT never imported/used elsewhere. The current system uses dynamic `ImageTags` interface instead (components/tagger/ImageTaggerClient.tsx:40-42).

**Recommendation:** ⚠️ **SAFE TO DELETE** (no actual usage)

**Estimated Cleanup:** 11 lines + 1 type export

**Note:** If there's concern about "backward compatibility," check git history to see if this was ever used in production. Based on current codebase scan, it's safe to remove.

---

## 4. Commented-Out Code

### components/ProjectMedia.tsx:26

```typescript
// const [hasAudioState, setHasAudioState] = useState(false);
```

**Status:** COMMENTED OUT

**Context:**
This appears to be an early attempt at audio state management for video controls. The actual implementation uses inline logic instead (lines 67-77 handle audio controls based on props).

**Why It Was Commented:**
The component receives `hasAudio` as a prop from parent, so local state is unnecessary.

**Recommendation:** ✅ **REMOVE LINE 26**

**Estimated Cleanup:** 1 line

---

## 5. Debug Console.log Statements

**Total Found:** 48+ instances across 7 files

### Breakdown by File

#### middleware.ts (7 console.logs) 🔴 HIGH PRIORITY
**Lines:** 8, 12, 18, 78, 79, 85, 90

**Example:**
```typescript
console.log('[Middleware] Checking:', pathname); // DEBUG
console.log('[Middleware] Session:', session ? 'EXISTS' : 'NONE'); // DEBUG
console.log('[Middleware] Redirecting to:', redirectUrl.toString()); // DEBUG
```

**Impact:**
- Logs on **EVERY request** to `/tagger/*` routes
- Exposes auth session status to console
- Production noise in server logs

**Recommendation:** 🔥 **DELETE ALL 7** (explicitly marked as DEBUG)

---

#### components/tagger/ImageTaggerClient.tsx (30 console.logs) 🟡 MEDIUM PRIORITY
**Examples:**
```typescript
console.log('✅ Vocabulary config loaded:', config.structure.categories.length, 'categories') // 108
console.log(`🤖 Getting AI suggestions for ${file.name}...`) // 294
console.log('📸 Generating thumbnail...') // 614
console.log('[Upload] Checking authentication session...') // 574
```

**Categories:**
- **Informational (✅, 📊, ⬆️):** 15 instances - Progress indicators
- **Debug ([Upload], [Session]):** 10 instances - Debugging remnants
- **Emojis (🤖, 📸, ⏭️):** 12 instances - User-facing logs

**Recommendation:**
- **DELETE** all `[Upload]` and debug logs (10 instances)
- **KEEP OR CONVERT** emoji logs to proper UI feedback (20 instances)
  - Consider showing upload progress in UI instead of console
  - Use toast notifications for "Image saved successfully!"

**Estimated Cleanup:** 10-30 lines (depending on UI approach)

---

#### components/tagger/GalleryClient.tsx (3 console.logs)
**Lines:** 124, 174, 232

```typescript
console.log('✅ Tag usage counts updated') // 124
console.log('✅ Vocabulary config loaded:', config.structure.categories.length, 'categories') // 174
console.log('✅ Vocabulary loaded:', Object.keys(groupedVocabulary).length, 'categories') // 232
```

**Recommendation:** ✅ **DELETE ALL 3** (internal state confirmations)

---

#### components/tagger/VocabularyClient.tsx (1 console.log)
**Line:** 89

```typescript
console.log('✅ Vocabulary config loaded:', config.structure.categories.length, 'categories')
```

**Recommendation:** ✅ **DELETE**

---

#### app/api/suggest-tags/route.ts (4 console.logs)
**Lines:** 250, 254, 279, 379

```typescript
console.log('📊 Using cached correction analysis') // 250
console.log('🔄 Refreshing correction analysis cache...') // 254
console.log('⏸ Not enough data for correction analysis (need at least 5 images)') // 279
console.log(`✅ Correction analysis cached (${totalImages} images analyzed)`) // 379
```

**Type:** Backend logging for caching behavior

**Recommendation:** 🟢 **KEEP OR UPGRADE** to proper logging library
- These are server-side logs for debugging API behavior
- Consider using structured logging (e.g., `console.info`, `console.debug`)
- Or upgrade to proper logging library (pino, winston)

---

#### app/api/retrain-prompt/route.ts (2 console.logs)
**Lines:** 38, 156

```typescript
console.log('🔄 Manual retrain triggered...') // 38
console.log(`✅ Retrain analysis complete (${totalImages} images analyzed)`) // 156
```

**Recommendation:** 🟢 **KEEP** (manual admin operation logging)

---

#### app/api/vocabulary-config/replace/route.ts (7 console.logs)
**Lines:** 49, 52, 98, 109, 120, 131, 152

```typescript
console.log('Starting vocabulary replacement...');
console.log('Deleting all images and storage files...');
console.log('Deleting all tag corrections...');
// ... etc
```

**Recommendation:** 🟢 **KEEP** (critical admin operation, needs audit trail)

---

### Console.log Summary Table

| File | Count | Priority | Action |
|------|-------|----------|--------|
| `middleware.ts` | 7 | 🔴 HIGH | DELETE ALL |
| `ImageTaggerClient.tsx` | 30 | 🟡 MEDIUM | DELETE debug (10), convert to UI (20) |
| `GalleryClient.tsx` | 3 | 🟢 LOW | DELETE |
| `VocabularyClient.tsx` | 1 | 🟢 LOW | DELETE |
| `suggest-tags/route.ts` | 4 | 🟢 KEEP | Upgrade to structured logging |
| `retrain-prompt/route.ts` | 2 | 🟢 KEEP | Valid admin logs |
| `vocabulary-config/replace/route.ts` | 7 | 🟢 KEEP | Critical operation audit trail |

**Total to Delete:** ~21 console.logs
**Total to Keep/Upgrade:** ~27 console.logs (backend logs)

---

## 6. Unused Dependencies

### Analysis: package.json

**All 12 dependencies are actively used ✅**

| Package | Used In | Status |
|---------|---------|--------|
| `@anthropic-ai/sdk` | `/api/suggest-tags`, `/api/extract-keywords`, `/api/retrain-prompt` | ✅ Used |
| `@supabase/ssr` | `lib/supabase.ts`, `middleware.ts` | ✅ Used |
| `@supabase/supabase-js` | 12+ components/pages | ✅ Used |
| `@tailwindcss/typography` | `tailwind.config.js` | ✅ Used |
| `framer-motion` | 6 components (animations) | ✅ Used |
| `gray-matter` | `lib/markdown.ts` | ✅ Used |
| `next` | Framework | ✅ Used |
| `nodemailer` | `/api/send-briefing` | ✅ Used |
| `react` | Framework | ✅ Used |
| `react-dom` | Framework | ✅ Used |
| `react-masonry-css` | `components/briefing/ImageGallery.tsx` | ✅ Used |
| `remark` + `remark-html` | `lib/markdown.ts` | ✅ Used |
| `zod` | 8 files (validation) | ✅ Used |

**Recommendation:** No dependencies to remove.

---

## 7. Duplicate Code Patterns

### Critical: Supabase Client Creation (12+ instances)

**Problem:** Supabase client initialization duplicated across 12+ files with identical logic.

#### Pattern 1: Client Component Pattern (6 instances)
**Files:**
- `components/tagger/GalleryClient.tsx:8`
- `components/tagger/VocabularyClient.tsx:8`
- `components/tagger/VocabularyConfigClient.tsx:9`
- `components/tagger/DashboardClient.tsx:10`
- `components/tagger/AIAnalyticsClient.tsx:10`
- `lib/supabase.ts:9` (exported but not used consistently)

**Duplicate Code:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Issue:** Each component creates its own client instead of using centralized helper.

**Existing Helper (Not Used):**
`lib/supabase.ts` exports `supabase` client, but components recreate it anyway.

**Better Approach:**
```typescript
// In component:
import { supabase } from '@/lib/supabase'
// Use directly, no recreation needed
```

**Current Usage:**
- `ImageTaggerClient.tsx:53` ✅ **CORRECT** - Uses `createClientComponentClient()` from `lib/supabase.ts`
- `LoginClient.tsx:20` ✅ **CORRECT** - Uses `createClientComponentClient()`
- `SignOutButton.tsx:9` ✅ **CORRECT** - Uses `createClientComponentClient()`

**Recommendation:** 🔧 **REFACTOR** 6 components to use existing helper

**Estimated Cleanup:** Remove ~18 lines (3 lines per file × 6 files)

---

#### Pattern 2: Server Component Pattern (3 instances)
**Files:**
- `app/tagger/vocabulary/page.tsx:9`
- `app/tagger/gallery/page.tsx:9`
- `app/tagger/ai-analytics/page.tsx:9`

**Duplicate Code:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
```

**Issue:** Admin client creation duplicated in 3 server components.

**Existing Helper (Already Exists):**
`lib/supabase.ts:22-29` exports `createServerClient()` for this exact purpose!

```typescript
export function createServerClient() {
  // ... identical logic
}
```

**Recommendation:** 🔧 **REFACTOR** 3 pages to use `createServerClient()`

**Estimated Cleanup:** Remove ~21 lines (7 lines per file × 3 files)

---

### Duplicate Pattern Summary

| Pattern | Instances | Lines to Remove | Helper Available |
|---------|-----------|-----------------|------------------|
| Client component Supabase creation | 6 | ~18 lines | ✅ `lib/supabase.ts` |
| Server component admin client | 3 | ~21 lines | ✅ `createServerClient()` |
| **Total** | **9** | **~39 lines** | - |

**Total Impact:** Reduce duplication by 39 lines, improve maintainability.

---

## 8. TODO Comments & Future Work

### TODO Comment Found

#### components/tagger/ImageTaggerClient.tsx:1029
```typescript
added_by: null, // TODO: Add user ID when auth is implemented
```

**Context:** When adding custom tags to vocabulary, `added_by` field is always `null`.

**Status:** Not critical, auth already implemented (Supabase auth active)

**Issue:** This TODO is outdated. Auth IS implemented, but the feature to track which user added a tag was never built.

**Recommendation:**
- **Option 1:** Remove TODO, accept `null` as valid (tags are global, not user-specific)
- **Option 2:** Implement feature to track user ID from `supabase.auth.getUser()`

**Priority:** LOW (feature enhancement, not a bug)

---

## 9. Summary & Recommendations

### Quick Wins (High Impact, Low Effort)

#### 1. Delete Dead File (2 minutes)
```bash
rm lib/supabase-middleware.ts
```
**Impact:** -60 lines, cleaner codebase

---

#### 2. Remove Unused State Variable (30 seconds)
**File:** `components/tagger/ImageTaggerClient.tsx:87`
```diff
- const [aiError, setAiError] = useState<Record<string, string | null>>({})
```
**Impact:** -1 line, reduce state complexity

---

#### 3. Remove Commented-Out Code (30 seconds)
**File:** `components/ProjectMedia.tsx:26`
```diff
- // const [hasAudioState, setHasAudioState] = useState(false);
```
**Impact:** -1 line

---

#### 4. Delete Deprecated Schema (2 minutes)
**File:** `lib/validation.ts:161-172`
```diff
- // ⚠️ DEPRECATED: Hardcoded category schema - not currently used
- // The ImageTaggerClient uses dynamic vocabulary config instead
- // Keeping for backward compatibility but should not be used for new code
- export const imageTagsSchema = z.object({
-   industries: tagArraySchema,
-   project_types: tagArraySchema,
-   styles: tagArraySchema,
-   moods: tagArraySchema,
-   elements: tagArraySchema,
-   notes: notesSchema,
- });

- export type ImageTagsInput = z.infer<typeof imageTagsSchema>; // line 351
```
**Impact:** -12 lines, cleaner validation layer

---

#### 5. Remove Debug Console.logs (10 minutes)
**Priority targets:**
- `middleware.ts` - All 7 console.logs (runs on every request)
- `ImageTaggerClient.tsx` - 10 `[Upload]` debug logs
- `GalleryClient.tsx` - All 3 logs
- `VocabularyClient.tsx` - 1 log

**Impact:** -21 console.logs, cleaner production logs

---

### Medium Effort Refactoring (30-60 minutes)

#### 6. Consolidate Supabase Client Creation
**Affected Files:** 9 files (6 client components + 3 server components)

**Before (Duplicated):**
```typescript
// Repeated in 6 components:
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**After (Centralized):**
```typescript
import { supabase } from '@/lib/supabase'
// Use directly
```

**Impact:** -39 lines, single source of truth, easier to modify auth config

---

### Optional UI Improvements (2-3 hours)

#### 7. Convert Console.logs to UI Feedback
**File:** `components/tagger/ImageTaggerClient.tsx` (20 emoji console.logs)

**Examples:**
```typescript
console.log('🤖 Getting AI suggestions for ${file.name}...')
console.log('✅ Image saved successfully!')
```

**Recommendation:** Replace with toast notifications or progress indicators

**Libraries to Consider:**
- `react-hot-toast` (lightweight)
- `sonner` (modern, accessible)
- Custom toast component

**Impact:** Better UX, less console noise

---

## 10. Overall Impact Analysis

### Lines of Code Reduction

| Category | LOC to Remove | Effort | Priority |
|----------|---------------|--------|----------|
| Dead file | -60 lines | 2 min | HIGH |
| Unused state | -1 line | 30 sec | HIGH |
| Commented code | -1 line | 30 sec | HIGH |
| Deprecated schema | -12 lines | 2 min | MEDIUM |
| Console.logs (debug) | -21 lines | 10 min | HIGH |
| Duplicate patterns | -39 lines | 60 min | MEDIUM |
| **Total** | **-134 lines** | **~75 min** | - |

---

### Dependency Status

**All dependencies ACTIVE ✅**
- Zero unused npm packages
- All 12 production dependencies are imported and used
- No cleanup needed in package.json

---

### Code Quality Metrics

#### Before Cleanup
- **Total LOC:** ~12,000 (estimated)
- **Dead code:** 134 lines (1.1%)
- **Duplicate patterns:** 9 instances
- **Debug statements:** 48 console.logs

#### After Cleanup
- **Total LOC:** ~11,866 (-134 lines)
- **Dead code:** 0 lines
- **Duplicate patterns:** 0 (consolidated)
- **Debug statements:** ~27 (backend only, upgraded to structured logging)

**Improvement:** ~1.1% code reduction, significantly cleaner codebase

---

## 11. Recommended Cleanup Order

### Phase 1: Quick Deletions (15 minutes)
**No risk, immediate benefit**

1. ✅ Delete `lib/supabase-middleware.ts`
2. ✅ Remove unused `aiError` state (ImageTaggerClient.tsx:87)
3. ✅ Remove commented line (ProjectMedia.tsx:26)
4. ✅ Delete deprecated `imageTagsSchema` (lib/validation.ts:161-172)
5. ✅ Remove 21 debug console.logs (middleware, components)

**Total Time:** 15 minutes
**Total Impact:** -96 lines

---

### Phase 2: Refactor Duplicates (60 minutes)
**Medium risk, high maintainability benefit**

1. ✅ Refactor 6 client components to use `lib/supabase.ts` helper
2. ✅ Refactor 3 server components to use `createServerClient()`
3. ✅ Test authentication flow after changes
4. ✅ Test image upload/tagging after changes

**Total Time:** 60 minutes
**Total Impact:** -39 lines, single source of truth for Supabase config

---

### Phase 3: Optional Improvements (2-3 hours)
**Future enhancement, not critical**

1. Replace console.logs with toast notifications (ImageTaggerClient)
2. Upgrade backend console.logs to structured logging (pino/winston)
3. Implement user tracking for custom tags (TODO:1029)

**Total Time:** 2-3 hours
**Total Impact:** Better UX, production-ready logging

---

## 12. Testing Checklist After Cleanup

After implementing Phase 1 & 2, test:

### Authentication Flow
- [ ] Login at `/tagger/login` works
- [ ] Session persists after page refresh
- [ ] Protected routes redirect when not logged in
- [ ] Sign out works correctly

### Tagger Functionality
- [ ] Image upload works
- [ ] AI suggestions load
- [ ] Tag saving works
- [ ] Gallery search/filter works
- [ ] Vocabulary management works

### Portfolio Site
- [ ] Homepage loads
- [ ] Project pages render
- [ ] Contact page works
- [ ] Netlify CMS admin accessible

**Estimated Testing Time:** 30 minutes

---

## 13. Final Recommendations

### DO IMMEDIATELY ✅
1. **Delete** `lib/supabase-middleware.ts` (zero imports)
2. **Remove** 21 debug console.logs (middleware + components)
3. **Delete** deprecated `imageTagsSchema` (unused validation)
4. **Remove** unused `aiError` state variable

**Total Time:** 15 minutes
**Risk:** ZERO (no functional dependencies)

---

### DO NEXT 🔧
5. **Refactor** Supabase client creation to use helpers (9 files)
6. **Test** authentication and image upload after refactor

**Total Time:** 60 minutes + 30 min testing
**Risk:** LOW (well-tested helpers already exist)

---

### DO LATER (Optional) 💡
7. **Upgrade** backend logs to structured logging
8. **Replace** console.logs with UI toast notifications
9. **Implement** user tracking for custom tags (TODO:1029)

**Total Time:** 2-3 hours
**Risk:** LOW (UX enhancements)

---

## 14. Conclusion

**Overall Grade: B** (Good code hygiene, minor cleanup needed)

**Strengths:**
- ✅ All npm dependencies actively used (no bloat)
- ✅ Minimal commented-out code
- ✅ Clear deprecation comments
- ✅ Most components use centralized helpers correctly

**Weaknesses:**
- ⚠️ One completely dead file (60 lines)
- ⚠️ 48 console.logs in production code
- ⚠️ Duplicate Supabase client creation in 9 files
- ⚠️ Minor unused state variable

**Impact of Cleanup:**
- **134 lines removed** (~1.1% reduction)
- **9 duplicate patterns consolidated**
- **Cleaner production logs** (21 debug statements removed)
- **Single source of truth** for Supabase auth

**Estimated Total Effort:** ~1.5 hours for Phase 1 + Phase 2

**Next Stage:** [ANALYSIS_3_MONOLITHS.md](./ANALYSIS_3_MONOLITHS.md) - Breaking down large files
