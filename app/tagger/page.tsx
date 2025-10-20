import ImageTaggerClient from '@/components/tagger/ImageTaggerClient'

export default function TaggerPage() {
  return (
    <div className="min-h-screen bg-custom-bg">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Reference Image Tagger</h1>
        <ImageTaggerClient />
      </div>
    </div>
  )
}
