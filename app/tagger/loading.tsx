import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function TaggerLoading() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" color="purple" />
        <p className="text-white text-lg font-semibold">Loading...</p>
      </div>
    </div>
  )
}
