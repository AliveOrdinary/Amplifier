'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { formatFileSize } from '@/lib/file-hash'

interface DuplicateDetectionModalProps {
  file: File
  fileHash: string
  fileSize: number
  perceptualHash: string
  existingImage: any
  matchType: 'exact' | 'similar' | 'filename'
  confidence: number
  message: string
  onSkip: () => void
  onKeep: () => void
  onViewExisting: () => void
}

export default function DuplicateDetectionModal({
  file,
  fileHash,
  fileSize,
  perceptualHash,
  existingImage,
  matchType,
  confidence,
  message,
  onSkip,
  onKeep,
  onViewExisting
}: DuplicateDetectionModalProps) {
  // Create blob URL and clean up on unmount to prevent memory leak
  const [previewUrl, setPreviewUrl] = useState<string>('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-800">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">
            {matchType === 'exact' && 'Duplicate Image Detected'}
            {matchType === 'similar' && 'Visually Similar Image Found'}
            {matchType === 'filename' && 'Matching Filename Found'}
          </h3>
          <p className="text-gray-300 mb-2">
            {message}
          </p>
          {confidence && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full border border-gray-600">
              <span className="text-sm font-medium text-gray-300">
                Confidence:
              </span>
              <span className={`text-sm font-bold ${
                confidence >= 95 ? 'text-red-400' :
                confidence >= 85 ? 'text-orange-400' :
                'text-yellow-400'
              }`}>
                {confidence}%
              </span>
            </div>
          )}
        </div>

        {/* Side-by-side comparison */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-6">
            {/* New Image */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">
                  New Upload
                </p>
                <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs font-semibold rounded border border-blue-700">
                  NEW
                </span>
              </div>

              <div className="bg-gray-950 rounded-lg overflow-hidden border border-blue-800 mb-3 aspect-square relative">
                {previewUrl && (
                <Image
                  src={previewUrl}
                  alt="New upload"
                  fill
                  className="object-contain"
                />)}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-white truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-400">
                  Size: {formatFileSize(fileSize)}
                </p>
                <p className="text-xs text-gray-400">
                  Type: {file.type.split('/')[1].toUpperCase()}
                </p>
              </div>
            </div>

            {/* Existing Image */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">
                  In Library
                </p>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${
                  existingImage.status === 'tagged'
                    ? 'bg-green-900/50 text-green-300 border-green-700'
                    : existingImage.status === 'skipped'
                    ? 'bg-orange-900/50 text-orange-300 border-orange-700'
                    : 'bg-gray-700 text-gray-300 border-gray-600'
                }`}>
                  {existingImage.status.toUpperCase()}
                </span>
              </div>

              <div className="bg-gray-950 rounded-lg overflow-hidden border border-gray-700 mb-3 aspect-square relative">
                {existingImage.thumbnail_path ? (
                  <Image
                    src={existingImage.thumbnail_path}
                    alt="Existing"
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">No preview available</div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-white truncate" title={existingImage.original_filename}>
                  {existingImage.original_filename}
                </p>
                <p className="text-xs text-gray-400">
                  Size: {existingImage.file_size
                    ? formatFileSize(existingImage.file_size)
                    : 'Unknown'}
                </p>
                <p className="text-xs text-gray-400">
                  Uploaded: {new Date(existingImage.tagged_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Match details */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <div className="text-sm text-gray-300">
              {matchType === 'exact' && (
                <p>
                  <strong className="text-blue-300">Exact match:</strong> The file content is identical (same SHA-256 hash).
                  This is definitely the same image.
                </p>
              )}
              {matchType === 'similar' && (
                <p>
                  <strong className="text-blue-300">Visual similarity:</strong> The images look very similar ({confidence}% match).
                  This could be a resized, cropped, or edited version of the same image.
                </p>
              )}
              {matchType === 'filename' && (
                <p>
                  <strong className="text-blue-300">Filename match:</strong> The filename is the same but the content may differ.
                  {confidence >= 80
                    ? ' File sizes match, so it\'s likely the same image.'
                    : ' File sizes differ, so it might be a different image.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={onSkip}
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold text-base border border-gray-600"
          >
            Skip This Image
          </button>

          {matchType !== 'exact' && (
            <button
              onClick={onKeep}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-base"
            >
              Upload Anyway (Keep Both)
            </button>
          )}

          <button
            onClick={onViewExisting}
            className="w-full px-4 py-3 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <span>View Existing Image in Gallery</span>
            <span>→</span>
          </button>
        </div>

        {/* Technical details (collapsible) */}
        <details className="mt-4 pt-4 border-t border-gray-700">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 font-medium">
            Technical Details
          </summary>
          <div className="mt-2 text-xs text-gray-400 space-y-1 font-mono">
            <p>New SHA-256: {fileHash.substring(0, 32)}...</p>
            <p>New pHash: {perceptualHash}</p>
            {existingImage.file_hash && (
              <p>Existing SHA-256: {existingImage.file_hash.substring(0, 32)}...</p>
            )}
            {existingImage.perceptual_hash && (
              <p>Existing pHash: {existingImage.perceptual_hash}</p>
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
