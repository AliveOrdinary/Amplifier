/**
 * Tag Usage Tracking Utilities
 *
 * Utilities for tracking tag usage counts in the tag_vocabulary table.
 * These functions interact with Supabase database functions to atomically
 * increment and decrement usage counters.
 */

import { getDatabaseCategory } from './vocabulary-utils'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Increments the usage count for a single tag.
 *
 * Calls the database function `increment_tag_usage` which atomically:
 * - Increments times_used by 1
 * - Updates last_used_at timestamp
 *
 * @param supabase - Supabase client instance
 * @param category - The database category name (from tag_vocabulary.category)
 * @param tagValue - The tag value (from tag_vocabulary.tag_value)
 * @param lastUsedAt - ISO timestamp for when the tag was used
 * @returns Promise that resolves when increment completes
 *
 * @example
 * ```typescript
 * await incrementTagUsage(supabase, 'industries', 'tech', new Date().toISOString())
 * ```
 */
export async function incrementTagUsage(
  supabase: SupabaseClient,
  category: string,
  tagValue: string,
  lastUsedAt: string = new Date().toISOString()
): Promise<void> {
  const { error } = await supabase.rpc('increment_tag_usage', {
    p_category: category,
    p_tag_value: tagValue,
    p_last_used_at: lastUsedAt
  })

  if (error) {
    console.error(`⚠️  Error incrementing usage for ${category}:${tagValue}:`, error)
    throw error
  }
}

/**
 * Decrements the usage count for a single tag.
 *
 * Calls the database function `decrement_tag_usage` which atomically:
 * - Decrements times_used by 1 (never below 0)
 *
 * @param supabase - Supabase client instance
 * @param category - The database category name (from tag_vocabulary.category)
 * @param tagValue - The tag value (from tag_vocabulary.tag_value)
 * @returns Promise that resolves when decrement completes
 *
 * @example
 * ```typescript
 * await decrementTagUsage(supabase, 'industries', 'tech')
 * ```
 */
export async function decrementTagUsage(
  supabase: SupabaseClient,
  category: string,
  tagValue: string
): Promise<void> {
  const { error } = await supabase.rpc('decrement_tag_usage', {
    p_category: category,
    p_tag_value: tagValue
  })

  if (error) {
    console.error(`⚠️ Error decrementing usage for ${category}:${tagValue}:`, error)
    throw error
  }
}

/**
 * Updates tag usage counts when tags change on an image.
 *
 * Compares old vs new tags to determine which tags were added or removed,
 * then increments/decrements usage counts accordingly. This is used when
 * editing existing images.
 *
 * @param supabase - Supabase client instance
 * @param oldTags - Previous tag values (keyed by category key)
 * @param newTags - New tag values (keyed by category key)
 * @param vocabConfig - Active vocabulary configuration
 * @returns Promise that resolves when all updates complete
 *
 * @example
 * ```typescript
 * const oldTags = {
 *   industries: ['tech'],
 *   brand_expression: ['modern', 'minimal']
 * }
 *
 * const newTags = {
 *   industries: ['tech', 'fashion'],  // Added 'fashion'
 *   brand_expression: ['modern']       // Removed 'minimal'
 * }
 *
 * await updateTagUsageForChanges(supabase, oldTags, newTags, vocabConfig)
 * // Increments: industries:fashion
 * // Decrements: brand_expression:minimal
 * ```
 */
export async function updateTagUsageForChanges(
  supabase: SupabaseClient,
  oldTags: Record<string, string[] | string>,
  newTags: Record<string, string[] | string>,
  vocabConfig: any
): Promise<void> {
  try {
    const now = new Date().toISOString()
    const categories = vocabConfig?.structure?.categories || []

    for (const category of categories) {
      const categoryKey = category.key
      const dbCategory = getDatabaseCategory(category.storage_path, categoryKey)

      // Only process array-type categories (skip text fields)
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        const oldSet = new Set(Array.isArray(oldTags[categoryKey]) ? oldTags[categoryKey] : [])
        const newSet = new Set(Array.isArray(newTags[categoryKey]) ? newTags[categoryKey] : [])

        // Find added tags (in new but not in old)
        const added = Array.from(newSet).filter(tag => !oldSet.has(tag))

        // Find removed tags (in old but not in new)
        const removed = Array.from(oldSet).filter(tag => !newSet.has(tag))

        // Increment counts for added tags
        for (const tag of added) {
          await incrementTagUsage(supabase, dbCategory, tag, now)
        }

        // Decrement counts for removed tags
        for (const tag of removed) {
          await decrementTagUsage(supabase, dbCategory, tag)
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Error updating tag usage counts:', error)
    throw error
  }
}

/**
 * Increments usage counts for all tags in a new image.
 *
 * This is called when saving a newly tagged image for the first time.
 * All tags in the image are considered "added" and their counts are incremented.
 *
 * @param supabase - Supabase client instance
 * @param tags - Tags for the new image (keyed by category key)
 * @param vocabConfig - Active vocabulary configuration
 * @returns Promise that resolves when all increments complete
 *
 * @example
 * ```typescript
 * const tags = {
 *   industries: ['tech', 'fashion'],
 *   brand_expression: ['modern', 'minimal']
 * }
 *
 * await updateTagUsageForNewImage(supabase, tags, vocabConfig)
 * // Increments all 4 tags: tech, fashion, modern, minimal
 * ```
 */
export async function updateTagUsageForNewImage(
  supabase: SupabaseClient,
  tags: Record<string, string[] | string>,
  vocabConfig: any
): Promise<void> {
  try {
    const now = new Date().toISOString()
    const categories = vocabConfig?.structure?.categories || []

    for (const category of categories) {
      const categoryKey = category.key
      const dbCategory = getDatabaseCategory(category.storage_path, categoryKey)

      // Only process array-type categories
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        const tagValues = Array.isArray(tags[categoryKey]) ? tags[categoryKey] : []

        for (const tag of tagValues) {
          await incrementTagUsage(supabase, dbCategory, tag, now)
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Error updating tag usage for new image:', error)
    throw error
  }
}

/**
 * Decrements usage counts for all tags when deleting an image.
 *
 * This is called when an image is removed from the system.
 * All tags in the image have their counts decremented.
 *
 * @param supabase - Supabase client instance
 * @param tags - Tags from the deleted image (keyed by category key)
 * @param vocabConfig - Active vocabulary configuration
 * @returns Promise that resolves when all decrements complete
 *
 * @example
 * ```typescript
 * const tags = {
 *   industries: ['tech', 'fashion'],
 *   brand_expression: ['modern']
 * }
 *
 * await updateTagUsageForDeletedImage(supabase, tags, vocabConfig)
 * // Decrements all 3 tags: tech, fashion, modern
 * ```
 */
export async function updateTagUsageForDeletedImage(
  supabase: SupabaseClient,
  tags: Record<string, string[] | string>,
  vocabConfig: any
): Promise<void> {
  try {
    const categories = vocabConfig?.structure?.categories || []

    for (const category of categories) {
      const categoryKey = category.key
      const dbCategory = getDatabaseCategory(category.storage_path, categoryKey)

      // Only process array-type categories
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        const tagValues = Array.isArray(tags[categoryKey]) ? tags[categoryKey] : []

        for (const tag of tagValues) {
          await decrementTagUsage(supabase, dbCategory, tag)
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Error updating tag usage for deleted image:', error)
    throw error
  }
}

/**
 * Bulk increments usage counts for multiple tags across categories.
 *
 * Useful for batch operations where multiple images are being tagged with the same tags.
 *
 * @param supabase - Supabase client instance
 * @param tagsByCategory - Map of category to array of tag values
 * @param vocabConfig - Active vocabulary configuration
 * @param count - Number of times to increment each tag (default: 1)
 * @returns Promise that resolves when all increments complete
 *
 * @example
 * ```typescript
 * const tagsByCategory = {
 *   industries: ['tech', 'fashion'],
 *   brand_expression: ['modern']
 * }
 *
 * // Increment each tag 5 times (e.g., 5 images were bulk-tagged)
 * await bulkIncrementTagUsage(supabase, tagsByCategory, vocabConfig, 5)
 * ```
 */
export async function bulkIncrementTagUsage(
  supabase: SupabaseClient,
  tagsByCategory: Record<string, string[]>,
  vocabConfig: any,
  count: number = 1
): Promise<void> {
  try {
    const now = new Date().toISOString()
    const categories = vocabConfig?.structure?.categories || []

    for (const category of categories) {
      const categoryKey = category.key
      const dbCategory = getDatabaseCategory(category.storage_path, categoryKey)
      const tagValues = tagsByCategory[categoryKey] || []

      for (const tag of tagValues) {
        // Increment multiple times if needed
        for (let i = 0; i < count; i++) {
          await incrementTagUsage(supabase, dbCategory, tag, now)
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Error in bulk increment tag usage:', error)
    throw error
  }
}
