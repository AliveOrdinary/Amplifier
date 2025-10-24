import BulkUploadClient from '@/components/tagger/BulkUploadClient'
import Link from 'next/link'

export default function BulkUploadPage() {
  return (
    <div className="min-h-screen bg-custom-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/tagger/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors font-semibold mb-6"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold mb-2">Bulk Image Upload</h1>
          <p className="text-gray-600">
            Optimized for uploading and tagging 10-100 similar images efficiently
          </p>
        </div>

        <BulkUploadClient />
      </div>
    </div>
  )
}
