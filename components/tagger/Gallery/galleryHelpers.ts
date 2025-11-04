/**
 * Shared helper functions for Gallery components
 */

// Helper function to extract database category name from storage_path
export function getDatabaseCategory(storagePath: string, categoryKey: string): string {
  if (storagePath.includes('.')) {
    // For nested paths like "tags.brand_expression", use the category key as the db category
    // This matches how tags are stored in the database
    return categoryKey
  } else {
    // For direct paths like "creative_fields", use the category key
    return categoryKey
  }
}

// Helper function to update tag usage counts when tags change (dynamic)
export async function updateTagUsageForChanges(
  oldTags: Record<string, string[]>,
  newTags: Record<string, string[]>,
  vocabularyConfig: any,
  supabase: any
) {
  try {
    const now = new Date().toISOString()

    // Fetch vocabulary config to get category mappings
    if (!vocabularyConfig) return

    const categories = vocabularyConfig.structure?.categories || []

    for (const category of categories) {
      const categoryKey = category.key
      const dbCategory = getDatabaseCategory(category.storage_path, categoryKey)

      // For array-type categories only
      if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
        const oldSet = new Set(oldTags[categoryKey] || [])
        const newSet = new Set(newTags[categoryKey] || [])

        // Find added tags (in new but not in old)
        const added = Array.from(newSet).filter(tag => !oldSet.has(tag))

        // Find removed tags (in old but not in new)
        const removed = Array.from(oldSet).filter(tag => !newSet.has(tag))

        // Increment counts for added tags
        for (const tag of added) {
          const { error } = await supabase.rpc('increment_tag_usage', {
            p_category: dbCategory,
            p_tag_value: tag,
            p_last_used_at: now
          })
          if (error) {
            console.error(`⚠️ Error incrementing usage for ${dbCategory}:${tag}:`, error)
          }
        }

        // Decrement counts for removed tags
        for (const tag of removed) {
          const { error } = await supabase.rpc('decrement_tag_usage', {
            p_category: dbCategory,
            p_tag_value: tag
          })
          if (error) {
            console.error(`⚠️ Error decrementing usage for ${dbCategory}:${tag}:`, error)
          }
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Error updating tag usage counts:', error)
  }
}
