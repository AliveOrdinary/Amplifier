import { createClient } from '@supabase/supabase-js'
import VocabularyClient from '@/components/tagger/VocabularyClient'
import Link from 'next/link'

// Server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface VocabularyTag {
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

async function getVocabularyTags(): Promise<VocabularyTag[]> {
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
    <div className="min-h-screen bg-custom-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/tagger/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold mb-2">Tag Vocabulary Management</h1>
          <p className="text-gray-600">
            Manage your reference image tagging vocabulary
          </p>
        </div>

        <VocabularyClient tags={tags} />
      </div>
    </div>
  )
}
