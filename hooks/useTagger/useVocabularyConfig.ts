'use client'

import { useState, useEffect } from 'react'

export interface VocabularyCategory {
  key: string
  label: string
  description: string
  placeholder: string
  storage_path: string
  storage_type: 'array' | 'jsonb_array' | 'text'
  search_weight: number
}

export interface VocabularyConfig {
  structure: {
    categories: VocabularyCategory[]
  }
}

export interface UseVocabularyConfigReturn {
  config: VocabularyConfig | null
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Hook to load and manage vocabulary configuration from API
 *
 * @returns {UseVocabularyConfigReturn} Vocabulary config, loading state, error state, and reload function
 *
 * @example
 * ```tsx
 * const { config, isLoading, error } = useVocabularyConfig()
 *
 * if (isLoading) return <Loading />
 * if (error) return <Error message={error} />
 *
 * return <div>{config.structure.categories.length} categories</div>
 * ```
 */
export function useVocabularyConfig(): UseVocabularyConfigReturn {
  const [config, setConfig] = useState<VocabularyConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/vocabulary-config')
      if (!response.ok) {
        throw new Error('Failed to load vocabulary config')
      }

      const { config: fetchedConfig } = await response.json()
      setConfig(fetchedConfig)

      console.log('✅ Vocabulary config loaded:', fetchedConfig.structure.categories.length, 'categories')
    } catch (err) {
      console.error('❌ Error loading vocabulary config:', err)
      setError(err instanceof Error ? err.message : 'Failed to load vocabulary config')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  return {
    config,
    isLoading,
    error,
    reload: loadConfig
  }
}
