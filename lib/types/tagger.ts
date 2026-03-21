import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared type definitions for the tagger system.
 * Single source of truth — import from '@/lib/types/tagger' everywhere.
 */

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

/** Full vocabulary config row as stored in the database */
export interface VocabularyConfigRow extends VocabularyConfig {
  id: string
  config_name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VocabularyTag {
  id: string
  category: string
  tag_value: string
  description: string | null
  sort_order: number
  is_active: boolean
  times_used: number
  last_used_at: string | null
  created_at: string
}

/** Tag vocabulary keyed by category */
export interface TagVocabulary {
  [categoryKey: string]: string[]
}

export interface TagVocabularyRow {
  category: string
  tag_value: string
  sort_order: number
}

/** Reference image as returned from the database (tagger context) */
export interface TaggerReferenceImage {
  id: string
  storage_path: string
  thumbnail_path: string
  original_filename: string
  notes: string | null
  status: string
  tagged_at: string
  updated_at: string
  ai_suggested_tags: Record<string, string[]> | null
  ai_confidence_score: number | null
  ai_reasoning: string | null
  /** Dynamic category fields from vocabulary config */
  [key: string]: unknown
}

/** Typed Supabase client prop (replaces `supabase: any`) */
export type TaggerSupabaseClient = SupabaseClient
