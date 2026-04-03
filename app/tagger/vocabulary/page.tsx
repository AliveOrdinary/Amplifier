import { createServerClient } from '@/lib/supabase'
import VocabularyClient from '@/components/tagger/VocabularyClient'
import type { VocabularyTag } from '@/lib/types/tagger'

// Disable caching - always fetch fresh data
export const revalidate = 0
export const dynamic = 'force-dynamic'

async function getVocabularyTags(): Promise<VocabularyTag[]> {
  const supabaseAdmin = createServerClient()
  const { data, error } = await supabaseAdmin
    .from('tag_vocabulary')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching vocabulary:', error)
    return []
  }

  return data || []
}

export default async function VocabularyPage() {
  const tags = await getVocabularyTags()

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Vocabulary</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your tagging vocabulary</p>
      </div>
      <VocabularyClient tags={tags} />
    </div>
  )
}
