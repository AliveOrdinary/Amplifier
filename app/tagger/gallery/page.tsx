import { createServerClient } from '@/lib/supabase'
import GalleryClient from '@/components/tagger/GalleryClient'
import type { TaggerReferenceImage } from '@/lib/types/tagger'

// Disable caching - always fetch fresh data
export const revalidate = 0
export const dynamic = 'force-dynamic'

async function getTaggedImages(): Promise<TaggerReferenceImage[]> {
  const supabaseAdmin = createServerClient()
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
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-white">Gallery</h1>
        <span className="text-sm text-gray-400">{images.length} images</span>
      </div>
      <GalleryClient images={images} />
    </div>
  )
}
