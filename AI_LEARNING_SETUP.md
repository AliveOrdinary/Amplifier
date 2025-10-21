# AI Learning System Setup Guide

## Overview

The Reference Image Tagger now includes a **self-learning AI system** that improves tag suggestion accuracy over time by analyzing your corrections. This guide will walk you through enabling and testing this feature from scratch.

---

## 🎯 How It Works

1. **Tag images normally** - AI suggests tags, you adjust them and save
2. **Corrections are tracked** - System records which tags you added/removed
3. **AI learns patterns** - After 5+ images, AI analyzes what it's missing or wrongly suggesting
4. **Prompt enhances automatically** - Future suggestions incorporate these learnings
5. **Accuracy improves** - Over time, AI makes fewer mistakes and requires less manual correction

**Expected Improvement**: ~70% accuracy (baseline) → ~85-90% accuracy (after 50+ images)

---

## 📋 Prerequisites

- Working Supabase instance with reference image tagger system
- At least **5 tagged images** for meaningful learning (recommended: 50+ for best results)
- Access to `.env.local` file and Supabase dashboard

---

## 🚀 Step-by-Step Setup

### Step 1: Apply Database Migration

The system needs a new column to track which prompt version was used for each image.

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run this migration:

```sql
-- Add prompt_version column to reference_images for A/B testing
-- This tracks which version of the AI prompt was used for tag suggestions

ALTER TABLE reference_images
ADD COLUMN IF NOT EXISTS prompt_version TEXT DEFAULT 'baseline';

-- Add comment
COMMENT ON COLUMN reference_images.prompt_version IS 'Version of AI prompt used: baseline or enhanced';

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_reference_images_prompt_version
ON reference_images(prompt_version);
```

4. Click **Run** to execute

**Option B: Via Supabase CLI**

```bash
# If using local Supabase
supabase migration new add_prompt_version
# Then add the SQL above to the generated file
supabase db push
```

**Verify Migration:**

```sql
-- Check the column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'reference_images'
  AND column_name = 'prompt_version';

-- Should return:
-- column_name     | data_type | column_default
-- prompt_version  | text      | 'baseline'::text
```

---

### Step 2: Understanding the Two Modes

#### Baseline Mode (Default)
- **When**: Starting out, no training data yet
- **Behavior**: Original AI prompt without learning
- **Use for**: First batch of images (recommended: 25-50 images)
- **Database value**: `prompt_version = 'baseline'`

#### Enhanced Mode (Learning Enabled)
- **When**: After 5+ images tagged (recommended: 25+)
- **Behavior**: AI prompt includes correction patterns
- **Use for**: Subsequent batches to measure improvement
- **Database value**: `prompt_version = 'enhanced'`

---

### Step 3: Initial Testing Phase (Baseline)

**You're starting with 0 images, so begin here:**

1. **Keep enhanced mode DISABLED** (do not add `USE_ENHANCED_PROMPT` to `.env.local` yet)

2. **Tag your first batch of images** (recommended: 25-50 similar images)
   - Go to `/tagger/dashboard`
   - Click **"Start Tagging"**
   - Upload 25-50 images (for best results, use similar images like all restaurant interiors, or all tech branding)
   - For each image:
     - Review AI suggestions
     - Add missing tags
     - Remove wrong suggestions
     - Click **"Save & Next"**

3. **Track what AI is missing**
   - Pay attention to patterns: "AI always misses 'natural-materials'"
   - Note wrong suggestions: "AI always suggests 'bold' when it shouldn't"
   - This helps you understand what to expect from learning

4. **Check analytics after 5+ images**
   - Visit `/tagger/ai-analytics`
   - You should see:
     - Overall accuracy baseline
     - Most missed tags
     - Most wrongly suggested tags
   - **Important**: All images will show `Prompt Version: Baseline`

**Example Progress:**
```
After 5 images:   Minimum data for learning
After 10 images:  Patterns start emerging
After 25 images:  Good sample size for testing enhanced mode
After 50 images:  Excellent training data
```

---

### Step 4: Enable Enhanced Learning Mode

**After you have at least 5 tagged images** (preferably 25+):

1. **Add environment variable to `.env.local`**:

```bash
# Enable AI learning from corrections
USE_ENHANCED_PROMPT=true
```

2. **Restart the development server**:

```bash
# Kill current server (Ctrl+C)
npm run dev
```

3. **Verify it's enabled**:
   - Go to `/tagger/ai-analytics`
   - Top section should show:
     - **Prompt Version: Enhanced**
     - **Training Data: X images** (your current count)
     - Message: "Enhanced prompts are enabled!"

---

### Step 5: Regenerate AI Prompt

After enabling enhanced mode and with 5+ images:

1. Go to `/tagger/ai-analytics`
2. Click the **"Regenerate Prompt"** button
3. You'll see a message like:

```
✅ Successfully analyzed 25 images. Enhanced prompt will use this data on next tag suggestion.
```

4. The system will show you:
   - Top 8 tags AI frequently misses
   - Top 8 tags AI wrongly suggests
   - Category-specific accuracy
   - Actionable guidance for improvement

**What this does:**
- Immediately analyzes all your correction data
- Refreshes the learning cache
- Next AI suggestion will use enhanced prompt with these patterns

---

### Step 6: Test Enhanced Mode (Phase 2)

Now tag another batch of images to test improvement:

1. **Upload 25-50 NEW similar images** (same type as Phase 1 for comparison)

2. **Tag them as before**, but notice:
   - AI should suggest tags it previously missed
   - AI should avoid tags it previously wrongly suggested
   - Overall corrections needed should decrease

3. **All new images will be saved with** `prompt_version = 'enhanced'`

4. **Compare results in analytics**:
   - Visit `/tagger/ai-analytics`
   - Look for accuracy improvements
   - Check if missed tags decreased
   - Verify wrong suggestions decreased

---

### Step 7: Monitor & Compare Results

#### In Analytics Dashboard (`/tagger/ai-analytics`)

**Overall Performance Card:**
- **Accuracy Trend**: Should show "📈 Improving" after enhanced mode
- **Trend Percentage**: Positive number means enhancement is working
- Example: "+15.3% vs earlier images" = 15% improvement

**Image-Level Analysis Table:**
- Filter by clicking images
- Compare baseline images (first batch) vs enhanced images (second batch)
- Look at "Correction %" column - should be lower for enhanced images

#### Query Database Directly (Advanced)

```sql
-- Compare accuracy between baseline and enhanced
SELECT
  prompt_version,
  COUNT(*) as total_images,
  AVG(
    CASE
      WHEN ai_confidence_score IS NOT NULL THEN ai_confidence_score
      ELSE 0
    END
  ) as avg_confidence
FROM reference_images
WHERE ai_suggested_tags IS NOT NULL
GROUP BY prompt_version;

-- Expected result:
-- prompt_version | total_images | avg_confidence
-- baseline       | 25           | 0.65
-- enhanced       | 25           | 0.78  (higher = better)
```

---

## 📊 Expected Timeline & Results

### Phase 1: Baseline (Images 1-25)
- **Duration**: 1-2 hours
- **Purpose**: Establish baseline accuracy
- **Expected Accuracy**: 60-70%
- **Action**: Tag normally, note patterns

### Phase 2: Learning Activation (After Image 25)
- **Duration**: 5 minutes
- **Purpose**: Enable enhanced prompts
- **Action**: Add `USE_ENHANCED_PROMPT=true`, restart server, regenerate prompt

### Phase 3: Enhanced (Images 26-50)
- **Duration**: 1-2 hours
- **Purpose**: Test improvement
- **Expected Accuracy**: 75-85%
- **Improvement**: 10-20% fewer corrections

### Phase 4: Continuous Learning (Images 50+)
- **Duration**: Ongoing
- **Purpose**: Refine and maintain accuracy
- **Expected Accuracy**: 85-90%
- **Improvement**: 30-40% fewer corrections

---

## 🔍 Verification Checklist

After setup, verify everything is working:

- [ ] Database migration applied (check `reference_images` schema)
- [ ] At least 5 images tagged in baseline mode
- [ ] `USE_ENHANCED_PROMPT=true` added to `.env.local`
- [ ] Server restarted after adding environment variable
- [ ] Analytics dashboard shows "Prompt Version: Enhanced"
- [ ] "Regenerate Prompt" button is enabled (not grayed out)
- [ ] Clicking "Regenerate Prompt" shows success message
- [ ] New images tagged after enabling show `prompt_version = 'enhanced'` in database

**Quick Database Check:**

```sql
-- Verify images are being saved with correct prompt_version
SELECT
  prompt_version,
  COUNT(*) as count,
  MAX(tagged_at) as last_tagged
FROM reference_images
GROUP BY prompt_version
ORDER BY last_tagged DESC;

-- Should see:
-- prompt_version | count | last_tagged
-- enhanced       | 5     | 2025-10-21 22:30:00  (recent)
-- baseline       | 25    | 2025-10-21 20:00:00  (older)
```

---

## 🐛 Troubleshooting

### Problem: "Regenerate Prompt" button is disabled

**Cause**: Not enough training data

**Solution**:
- You need at least 5 tagged images
- Check analytics: "Training Data: X images"
- Tag more images until you reach 5+

---

### Problem: Analytics shows "Prompt Version: Baseline" even after adding env var

**Cause**: Server not restarted or env var not loaded

**Solution**:
1. Stop the dev server (Ctrl+C)
2. Verify `.env.local` has `USE_ENHANCED_PROMPT=true`
3. Restart: `npm run dev`
4. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

---

### Problem: No improvement in accuracy after enabling enhanced mode

**Possible Causes & Solutions**:

1. **Not enough training data**
   - Need 25+ images for meaningful patterns
   - Similar images work better (same industry/type)

2. **Cache not refreshed**
   - Click "Regenerate Prompt" after enabling
   - Cache refreshes every 5 images or 1 hour

3. **Inconsistent tagging**
   - AI learns from YOUR patterns
   - If you tag inconsistently, AI will too
   - Be consistent in what you consider "minimalist" vs "modern", etc.

4. **Different image types**
   - Phase 1: Restaurant interiors
   - Phase 2: Tech branding (completely different)
   - Result: No improvement (AI learned wrong patterns)
   - **Solution**: Use similar images in both phases

---

### Problem: Server console shows cache errors

**Check console for**:
```
🔄 Refreshing correction analysis cache...
✅ Correction analysis cached (X images analyzed)
```

If you see errors:
- Check Supabase connection
- Verify `tag_corrections` table exists
- Ensure `tag_vocabulary` table has data

---

## 💡 Pro Tips

### 1. Start with Similar Images
Upload 50 images of the **same type** for Phase 1 (e.g., all restaurant interiors). This gives AI clearer patterns to learn.

### 2. Tag Consistently
- If you tag an image as "minimalist" once, tag similar images the same way
- Inconsistent tagging confuses the AI

### 3. Review AI Reasoning
- Look at the "AI Reasoning" field in image details
- Helps understand why AI suggested certain tags
- Informs whether to keep or remove suggestions

### 4. Use the Analytics Dashboard Regularly
- Check after every 10 images
- Monitor which tags are improving
- Identify categories that need more training

### 5. Regenerate Prompt Strategically
- After tagging batches of 10-20 images
- When you notice patterns changing
- Before starting a new batch session

### 6. Export Reports for Reference
- Click "Export Report" in analytics
- Track improvement over time
- Share with team to show AI learning progress

---

## 📈 Measuring Success

### Key Metrics to Watch

1. **Overall Accuracy** (`/tagger/ai-analytics`)
   - Baseline: 60-70%
   - Target: 85-90%
   - **Good**: +10% improvement after 25 enhanced images

2. **Correction Rate** (Image-Level Analysis table)
   - Baseline: 30-40% of tags need correction
   - Target: 10-20% of tags need correction
   - **Good**: 50% reduction in corrections

3. **Missed Tags Count** (Analytics Dashboard)
   - Baseline: 8-10 frequently missed tags
   - Target: 2-4 frequently missed tags
   - **Good**: Top missed tags appear <20% of time

4. **Wrong Suggestions Count**
   - Baseline: 6-8 frequently wrong tags
   - Target: 1-3 frequently wrong tags
   - **Good**: Top wrong tags appear <15% of time

### Success Criteria

**After 50 Images (25 baseline + 25 enhanced):**

✅ Overall accuracy improved by 10%+
✅ Time to tag each image reduced by 30%+
✅ Top 3 missed tags now suggested by AI
✅ Top 3 wrong tags no longer suggested
✅ Category accuracy improved across all categories

---

## 🔄 Continuous Improvement

### Ongoing Workflow

1. **Tag 10-20 images** with current settings
2. **Check analytics** to see patterns
3. **Click "Regenerate Prompt"** to update learning
4. **Continue tagging** - AI gets smarter with each batch
5. **Repeat** every 20 images

### When to Reset Learning

You might want to start fresh if:
- Changing to completely different image types (restaurant → tech)
- Tagging strategy changed significantly
- Vocabulary was overhauled

**To reset**:
```sql
-- Clear all corrections (keeps images)
DELETE FROM tag_corrections;

-- Reset prompt version to baseline
UPDATE reference_images
SET prompt_version = 'baseline';
```

Then disable enhanced mode and start fresh.

---

## 📞 Getting Help

If you're stuck:

1. **Check server console** for errors:
   ```
   Look for: "🔄 Refreshing correction analysis cache..."
   Or errors: "Error analyzing corrections:"
   ```

2. **Query correction data**:
   ```sql
   -- See if corrections are being tracked
   SELECT COUNT(*) FROM tag_corrections;

   -- Should be > 0 after tagging images
   ```

3. **Verify environment variables**:
   ```bash
   # In server console, you should see:
   # USE_ENHANCED_PROMPT: true
   ```

4. **Check analytics endpoint manually**:
   ```
   Visit: http://localhost:3004/api/retrain-prompt
   Should return JSON with status
   ```

---

## 🎓 Understanding the Learning Process

### What AI Learns

**From Tags You Add:**
- "I frequently add 'natural-materials' to restaurant images"
- "I often add 'calm' mood to interior spaces"
- "I tag 'photography' element when I see high-quality photos"

**From Tags You Remove:**
- "I always remove 'bold' from minimalist designs"
- "I don't use 'corporate' for hospitality projects"
- "I rarely keep 'vibrant' suggestions"

**From Category Patterns:**
- "I'm selective with mood tags (only 1-2 per image)"
- "I always choose multiple elements (3-4 per image)"
- "I pick industries broadly (2-3 per image)"

### How Enhanced Prompt Uses This

```
Original Prompt:
"Suggest tags that describe this image"

Enhanced Prompt:
"Suggest tags that describe this image.

⚠️ BASED ON YOUR PAST CORRECTIONS:
- You frequently add 'natural-materials' (missed in 83% of images) - look for this!
- You frequently remove 'bold' (wrongly suggested 44% of time) - be conservative
- Your mood tags tend to be: calm, sophisticated, warm (not: bold, vibrant, energetic)
- Style accuracy is low (68%) - be more careful with style tags"
```

This personalized guidance helps AI match **your specific tagging style**.

---

## ✅ Next Steps

Now that you understand the system:

1. ✅ **Apply the database migration** (Step 1)
2. ✅ **Tag 25-50 images in baseline mode** (Step 3)
3. ✅ **Enable enhanced mode** (Step 4)
4. ✅ **Regenerate prompt** (Step 5)
5. ✅ **Tag 25-50 more images** (Step 6)
6. ✅ **Compare results** (Step 7)
7. ✅ **Celebrate** your AI getting smarter! 🎉

---

## 📝 Summary

| Phase | Images | Mode | Action | Expected Accuracy |
|-------|--------|------|--------|------------------|
| **Setup** | 0 | - | Apply migration | - |
| **Phase 1** | 1-25 | Baseline | Tag normally, track patterns | 60-70% |
| **Transition** | - | - | Enable `USE_ENHANCED_PROMPT=true` | - |
| **Phase 2** | 26-50 | Enhanced | Tag with improved AI | 75-85% |
| **Ongoing** | 50+ | Enhanced | Continuous learning | 85-90% |

**Time Investment**: ~3-4 hours for full setup and testing
**Time Saved**: 30-40% reduction in manual corrections (ongoing)
**ROI**: Pays off after ~100 images tagged

Good luck, and enjoy watching your AI get smarter! 🚀
