'use client';

import { memo } from 'react';
import Image from 'next/image';

interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  filename: string;
  status: 'pending' | 'tagged' | 'skipped';
}

interface ImagePreviewProps {
  image: UploadedImage;
  currentIndex: number;
  totalImages: number;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  onSaveAndNext: () => Promise<void>;
  isSaving: boolean;
}

const ImagePreview = memo(function ImagePreview({
  image,
  currentIndex,
  totalImages,
  onPrevious,
  onNext,
  onSkip,
  onSaveAndNext,
  isSaving
}: ImagePreviewProps) {
  const isFirstImage = currentIndex === 0;
  const isLastImage = currentIndex === totalImages - 1;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
      {/* Image Container */}
      <div className="bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 relative" style={{ maxHeight: '70vh', minHeight: '400px' }}>
        <Image
          src={image.previewUrl}
          alt={image.filename}
          width={800}
          height={600}
          sizes="(max-width: 1024px) 100vw, 800px"
          className="max-w-full max-h-[70vh] object-contain"
        />
      </div>

      {/* Filename */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm font-semibold text-gray-900 truncate" title={image.filename}>
          {image.filename}
        </p>
        {image.status === 'skipped' && (
          <span className="inline-block mt-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
            Skipped
          </span>
        )}
        {image.status === 'tagged' && (
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Already Tagged
          </span>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 border-t border-gray-200 pt-4">
        <button
          onClick={onPrevious}
          disabled={isFirstImage}
          className={`flex-1 px-4 py-3 border-2 rounded-lg font-medium transition-all ${
            isFirstImage
              ? 'border-gray-300 text-gray-400 cursor-not-allowed bg-gray-100'
              : 'border-gray-400 text-gray-900 bg-white hover:bg-gray-50 hover:border-gray-500'
          }`}
        >
          ← Previous
        </button>

        {image.status !== 'tagged' ? (
          <>
            <button
              onClick={onSkip}
              className="flex-1 px-4 py-3 border-2 border-orange-400 text-orange-700 bg-orange-50 rounded-lg font-medium hover:bg-orange-100 hover:border-orange-500 transition-all"
            >
              Skip
            </button>

            <button
              onClick={onSaveAndNext}
              disabled={isSaving}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                isSaving
                  ? 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-gray-800 shadow-sm hover:shadow-md'
              }`}
            >
              {isSaving ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </span>
              ) : (
                <span>Save & Next →</span>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={onNext}
            disabled={isLastImage}
            className={`flex-1 px-4 py-3 border-2 rounded-lg font-medium transition-all ${
              isLastImage
                ? 'border-gray-300 text-gray-400 cursor-not-allowed bg-gray-100'
                : 'border-gray-400 text-gray-900 bg-white hover:bg-gray-50 hover:border-gray-500'
            }`}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
});

export default ImagePreview;
