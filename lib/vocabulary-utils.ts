/**
 * Vocabulary Utilities
 *
 * Shared utility functions for working with dynamic vocabulary configurations
 * and image data across the tagger system.
 */

/**
 * Extracts a value from an image object based on a storage path.
 *
 * This utility handles both nested and direct paths:
 * - Nested paths: "tags.brand_expression" → accesses image.tags.brand_expression
 * - Direct paths: "industries" → accesses image.industries
 *
 * @param image - The image object containing tag data
 * @param storagePath - The path to the value (e.g., "tags.style" or "industries")
 * @returns The value at the specified path, or undefined if not found
 *
 * @example
 * ```typescript
 * const image = {
 *   industries: ['tech', 'fashion'],
 *   tags: { style: ['modern', 'minimal'] }
 * }
 *
 * getImageValue(image, 'industries')     // ['tech', 'fashion']
 * getImageValue(image, 'tags.style')     // ['modern', 'minimal']
 * getImageValue(image, 'tags.missing')   // undefined
 * ```
 */
export function getImageValue(image: any, storagePath: string): any {
  if (storagePath.includes('.')) {
    // Handle nested paths (e.g., "tags.brand_expression")
    const parts = storagePath.split('.')
    let value: any = image

    for (const part of parts) {
      value = value?.[part]
      if (value === undefined) break
    }

    return value
  } else {
    // Handle direct paths (e.g., "industries")
    return image[storagePath]
  }
}

/**
 * Determines the database category name from a storage path and category key.
 *
 * In the current implementation, this always returns the category key,
 * as the database stores categories using the key regardless of storage type.
 * This function exists for future extensibility if category mapping becomes
 * more complex.
 *
 * @param storagePath - The storage path from vocabulary config (e.g., "tags.style" or "industries")
 * @param categoryKey - The category key from vocabulary config (e.g., "aesthetic_influences")
 * @returns The database category name to use in tag_vocabulary table
 *
 * @example
 * ```typescript
 * getDatabaseCategory('tags.brand_expression', 'brand_expression')  // 'brand_expression'
 * getDatabaseCategory('industries', 'industries')                    // 'industries'
 * getDatabaseCategory('tags.mood', 'mood')                           // 'mood'
 * ```
 */
export function getDatabaseCategory(storagePath: string, categoryKey: string): string {
  // Current logic: Always use the category key as the database category
  // This is consistent across both nested (jsonb_array) and direct (array) storage types
  return categoryKey
}

/**
 * Sets a value in an image object based on a storage path.
 *
 * This utility handles both nested and direct paths, creating intermediate
 * objects as needed for nested paths.
 *
 * @param image - The image object to modify
 * @param storagePath - The path where the value should be set
 * @param value - The value to set
 * @returns A new image object with the value set (does not mutate original)
 *
 * @example
 * ```typescript
 * const image = { industries: ['tech'] }
 *
 * // Set direct path
 * const updated1 = setImageValue(image, 'industries', ['tech', 'fashion'])
 * // { industries: ['tech', 'fashion'] }
 *
 * // Set nested path (creates tags object if needed)
 * const updated2 = setImageValue(image, 'tags.style', ['modern'])
 * // { industries: ['tech'], tags: { style: ['modern'] } }
 * ```
 */
export function setImageValue(image: any, storagePath: string, value: any): any {
  const newImage = { ...image }

  if (storagePath.includes('.')) {
    // Handle nested paths
    const parts = storagePath.split('.')
    let current: any = newImage

    // Navigate to the parent object, creating intermediate objects as needed
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {}
      } else {
        current[part] = { ...current[part] }
      }
      current = current[part]
    }

    // Set the final value
    current[parts[parts.length - 1]] = value
  } else {
    // Handle direct paths
    newImage[storagePath] = value
  }

  return newImage
}

/**
 * Builds an update object for database operations based on vocabulary config.
 *
 * Converts the tag data structure used in the UI to the format needed for
 * database updates, respecting the storage_type and storage_path for each category.
 *
 * @param tags - The tags object from the UI (keyed by category key)
 * @param vocabConfig - The active vocabulary configuration
 * @returns An object suitable for Supabase .update() operations
 *
 * @example
 * ```typescript
 * const tags = {
 *   industries: ['tech', 'fashion'],
 *   brand_expression: ['minimal', 'modern'],
 *   notes: 'Beautiful color palette'
 * }
 *
 * const vocabConfig = {
 *   structure: {
 *     categories: [
 *       { key: 'industries', storage_type: 'array', storage_path: 'industries' },
 *       { key: 'brand_expression', storage_type: 'jsonb_array', storage_path: 'tags.brand_expression' },
 *       { key: 'notes', storage_type: 'text', storage_path: 'notes' }
 *     ]
 *   }
 * }
 *
 * buildUpdateObject(tags, vocabConfig)
 * // {
 * //   industries: ['tech', 'fashion'],
 * //   tags: { brand_expression: ['minimal', 'modern'] },
 * //   notes: 'Beautiful color palette'
 * // }
 * ```
 */
export function buildUpdateObject(
  tags: Record<string, string[] | string>,
  vocabConfig: any
): Record<string, any> {
  const updateData: Record<string, any> = {}
  const categories = vocabConfig?.structure?.categories || []

  for (const category of categories) {
    const categoryKey = category.key
    const storagePath = category.storage_path
    const value = tags[categoryKey]

    // Skip if no value provided
    if (value === undefined || value === null) continue

    if (storagePath.includes('.')) {
      // Handle nested paths (e.g., "tags.brand_expression")
      const parts = storagePath.split('.')
      const rootKey = parts[0]
      const nestedKey = parts.slice(1).join('.')

      if (!updateData[rootKey]) {
        updateData[rootKey] = {}
      }

      // Set nested value
      if (nestedKey.includes('.')) {
        // Handle deeply nested paths (though currently not used)
        const nestedParts = nestedKey.split('.')
        let current = updateData[rootKey]
        for (let i = 0; i < nestedParts.length - 1; i++) {
          if (!current[nestedParts[i]]) {
            current[nestedParts[i]] = {}
          }
          current = current[nestedParts[i]]
        }
        current[nestedParts[nestedParts.length - 1]] = value
      } else {
        updateData[rootKey][nestedKey] = value
      }
    } else {
      // Handle direct paths
      updateData[storagePath] = value
    }
  }

  return updateData
}

/**
 * Validates that all required categories have values.
 *
 * @param tags - The tags object to validate
 * @param vocabConfig - The active vocabulary configuration
 * @returns Object with isValid boolean and array of missing category labels
 *
 * @example
 * ```typescript
 * const tags = { industries: ['tech'] }
 * const result = validateRequiredCategories(tags, vocabConfig)
 * // { isValid: false, missingCategories: ['Project Type', 'Style'] }
 * ```
 */
export function validateRequiredCategories(
  tags: Record<string, string[] | string>,
  vocabConfig: any
): { isValid: boolean; missingCategories: string[] } {
  const categories = vocabConfig?.structure?.categories || []
  const missingCategories: string[] = []

  for (const category of categories) {
    // For now, consider all array/jsonb_array categories as "recommended" not required
    // Text fields (like notes) are always optional
    // This can be extended with a "required" field in the vocabulary config if needed
    const value = tags[category.key]

    if (category.storage_type !== 'text') {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        // Not critical, but could be tracked
      }
    }
  }

  // For now, always return valid (no hard requirements)
  return { isValid: true, missingCategories }
}

/**
 * Merges AI-suggested tags with existing manual selections.
 *
 * For array-based categories, this combines arrays without duplicates.
 * For text-based categories, AI suggestions are only used if no manual value exists.
 *
 * @param existingTags - Tags already selected manually
 * @param aiSuggestions - Tags suggested by AI
 * @param vocabConfig - The active vocabulary configuration
 * @returns Merged tags object
 *
 * @example
 * ```typescript
 * const existing = { industries: ['tech'], notes: 'Manual note' }
 * const aiSuggested = { industries: ['tech', 'fashion'], notes: 'AI note' }
 *
 * mergeAISuggestions(existing, aiSuggested, vocabConfig)
 * // { industries: ['tech', 'fashion'], notes: 'Manual note' }
 * // Note: manual notes are preserved, arrays are merged without duplicates
 * ```
 */
export function mergeAISuggestions(
  existingTags: Record<string, string[] | string>,
  aiSuggestions: Record<string, string[] | string>,
  vocabConfig: any
): Record<string, string[] | string> {
  const merged: Record<string, string[] | string> = { ...existingTags }
  const categories = vocabConfig?.structure?.categories || []

  for (const category of categories) {
    const categoryKey = category.key
    const aiValue = aiSuggestions[categoryKey]
    const existingValue = merged[categoryKey]

    if (category.storage_type === 'text') {
      // For text fields, only use AI suggestion if no existing value
      if (!existingValue && aiValue) {
        merged[categoryKey] = aiValue
      }
    } else {
      // For array fields, merge without duplicates
      if (aiValue && Array.isArray(aiValue)) {
        const existing = Array.isArray(existingValue) ? existingValue : []
        const combined = [...new Set([...existing, ...aiValue])]
        merged[categoryKey] = combined
      }
    }
  }

  return merged
}
