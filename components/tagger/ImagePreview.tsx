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
}

const ImagePreview = memo(function ImagePreview({ image }: ImagePreviewProps) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Image Container */}
      <div className="bg-gray-950 flex items-center justify-center relative" style={{ maxHeight: '70vh', minHeight: '400px' }}>
        <Image
          src={image.previewUrl}
          alt={image.filename}
          width={800}
          height={600}
          sizes="(max-width: 1024px) 100vw, 800px"
          className="max-w-full max-h-[70vh] object-contain"
        />
      </div>

      {/* Filename + status */}
      <div className="px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-medium text-white truncate" title={image.filename}>
          {image.filename}
        </p>
        {image.status === 'skipped' && (
          <span className="text-amber-400 text-xs flex-shrink-0 ml-2">Skipped</span>
        )}
        {image.status === 'tagged' && (
          <span className="text-green-400 text-xs flex-shrink-0 ml-2">Tagged</span>
        )}
      </div>
    </div>
  );
});

export default ImagePreview;
