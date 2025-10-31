'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import type { VocabularyConfig } from './useVocabularyConfig'

export interface TagVocabulary {
  [categoryKey: string]: string[]
}

interface TagVocabularyRow {
  category: string
  tag_value: string
  sort_order: number
}

export interface UseVocabularyReturn {
  vocabulary: TagVocabulary
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Hook to load tag vocabulary from Supabase based on vocabulary config
 *
 * Loads all active tags from the database, groups them by category,
 * and maps them to the vocabulary config structure.
 *
 * @param {VocabularyConfig | null} config - Vocabulary configuration
 * @returns {UseVocabularyReturn} Vocabulary data, loading state, error state, and reload function
 *
 * @example
 * ```tsx
 * const { config } = useVocabularyConfig()
 * const { vocabulary, isLoading, error } = useVocabulary(config)
 *
 * if (isLoading) return <Loading />
 * if (error) return <Error message={error} />
 *
 * return <TagList tags={vocabulary} />
 * ```
 */
export function useVocabulary(config: VocabularyConfig | null): UseVocabularyReturn {
  const supabase = createClientComponentClient()
  const [vocabulary, setVocabulary] = useState<TagVocabulary>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVocabulary = async () => {
    if (!config) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch all active tags, sorted by category and sort_order
      const { data, error: fetchError } = await supabase
        .from('tag_vocabulary')
        .select('category, tag_value, sort_order')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      if (!data) {
        throw new Error('No vocabulary data returned')
      }

      // Group tags by category
      const groupedVocabulary = data.reduce((acc, row: TagVocabularyRow) => {
        const category = row.category
        if (!acc[category]) {
          acc[category] = []
        }
        acc[category].push(row.tag_value)
        return acc
      }, {} as Record<string, string[]>)

      // Map database categories to vocabulary config keys dynamically
      const vocabularyState: TagVocabulary = {}

      // Since tag_vocabulary.category now uses the config key directly,
      // no mapping is needed - just match by key
      config.structure.categories.forEach(cat => {
        if (cat.storage_type === 'array' || cat.storage_type === 'jsonb_array') {
          // Use the category key directly (it matches the database category)
          vocabularyState[cat.key] = groupedVocabulary[cat.key] || []
        }
      })

      setVocabulary(vocabularyState)

      // Log for verification
      console.log('✅ Vocabulary loaded successfully:', vocabularyState)
      const tagCounts: Record<string, number> = {}
      let total = 0
      Object.entries(vocabularyState).forEach(([key, values]) => {
        tagCounts[key] = values.length
        total += values.length
      })
      console.log('📊 Tag counts:', { ...tagCounts, total })
    } catch (err) {
      console.error('❌ Error loading vocabulary:', err)
      setError(err instanceof Error ? err.message : 'Failed to load vocabulary')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadVocabulary()
  }, [config])

  return {
    vocabulary,
    isLoading,
    error,
    reload: loadVocabulary
  }
}
