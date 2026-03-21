import { createServerClient } from '@/lib/supabase'
import VocabularyClient from '@/components/tagger/VocabularyClient'
import Link from 'next/link'
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
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/tagger/dashboard"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors font-semibold mb-6"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">Tag Vocabulary Management</h1>
          <p className="text-gray-300 font-medium">
            Manage your reference image tagging vocabulary
          </p>
        </div>

        <VocabularyClient tags={tags} />
      </div>
    </div>
  )
}
