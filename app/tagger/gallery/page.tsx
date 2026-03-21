import { createServerClient } from '@/lib/supabase'
import GalleryClient from '@/components/tagger/GalleryClient'
import Link from 'next/link'
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
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-10">
        {/* Enhanced Header */}
        <div className="mb-10">
          <Link
            href="/tagger/dashboard"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors font-semibold mb-6"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white mb-3">🖼️ Reference Image Gallery</h1>
              <div className="flex items-center gap-4">
                <p className="text-lg text-gray-300 font-medium">
                  Your complete collection of tagged reference images
                </p>
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-blue-600 text-white border-2 border-blue-500">
                  {images.length} Total Images
                </span>
              </div>
            </div>
          </div>
        </div>

        <GalleryClient images={images} />
      </div>
    </div>
  )
}
