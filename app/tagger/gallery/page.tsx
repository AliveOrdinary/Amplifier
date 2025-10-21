import { createClient } from '@supabase/supabase-js'
import GalleryClient from '@/components/tagger/GalleryClient'
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

interface ReferenceImage {
  id: string
  storage_path: string
  thumbnail_path: string
  original_filename: string
  industries: string[]
  project_types: string[]
  tags: {
    style: string[]
    mood: string[]
    elements: string[]
  }
  notes: string | null
  status: string
  tagged_at: string
  updated_at: string
  ai_suggested_tags: any
  ai_confidence_score: number | null
  ai_reasoning: string | null
}

async function getTaggedImages(): Promise<ReferenceImage[]> {
  const { data, error } = await supabaseAdmin
    .from('reference_images')
    .select('*')
    .in('status', ['tagged', 'approved'])
    .order('tagged_at', { ascending: false })

  if (error) {
    console.error('Error fetching images:', error)
    return []
  }

  return data || []
}

export default async function GalleryPage() {
  const images = await getTaggedImages()

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
          <h1 className="text-4xl font-bold mb-2">Reference Image Gallery</h1>
          <p className="text-gray-600">
            {images.length} tagged images in your collection
          </p>
        </div>

        <GalleryClient images={images} />
      </div>
    </div>
  )
}
