import ImageTaggerClient from '@/components/tagger/ImageTaggerClient'
import Link from 'next/link'

export default function TaggerPage() {
  return (
    <div className="min-h-screen max-h-screen overflow-y-auto bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/tagger/dashboard"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors font-semibold mb-6"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold text-white">Reference Image Tagger</h1>
        </div>
        <ImageTaggerClient />
      </div>
    </div>
  )
}
