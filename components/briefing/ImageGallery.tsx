'use client';

import Masonry from 'react-masonry-css';
import ImageCard from './ImageCard';
import ReferenceImageCard from './ReferenceImageCard';
import type { ArenaBlock, ReferenceImage } from '@/lib/types';

interface ImageGalleryProps {
  blocks: ArenaBlock[];
  favoritedIds: number[];
  referenceImages?: ReferenceImage[];
  favoritedImageIds?: string[];
  onToggleFavorite: (id: number) => void;
  onToggleFavoriteImage?: (id: string) => void;
  onRegenerate: () => void;
  onNext: () => void;
}

export default function ImageGallery({
  blocks,
  favoritedIds,
  referenceImages = [],
  favoritedImageIds = [],
  onToggleFavorite,
  onToggleFavoriteImage,
  onRegenerate,
  onNext,
}: ImageGalleryProps) {
  const breakpointColumns = {
    default: 3,
    1024: 2,
    640: 1,
  };

  // Use reference images if available, otherwise fall back to arena blocks
  const useReferenceImages = referenceImages.length > 0;
  const totalImages = useReferenceImages ? referenceImages.length : blocks.length;
  const favoritedCount = useReferenceImages ? favoritedImageIds.length : favoritedIds.length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-rightserif font-bold mb-4 text-white">Visual Gallery</h2>
        <p className="text-gray-300 mb-4">
          {useReferenceImages ? (
            totalImages > 0 ? (
              <>We've curated {totalImages} images from our internal collection based on your keywords. Click the heart icon to favorite images that resonate with your vision.</>
            ) : (
              <>Our reference collection is currently being built. We'll discuss visual direction during our kickoff call.</>
            )
          ) : (
            <>We've curated {totalImages} images from Are.na based on your keywords. Click the heart icon to favorite images that resonate with your vision.</>
          )}
        </p>

        {favoritedCount > 0 && (
          <div className="bg-white text-black px-4 py-2 rounded-full inline-block font-bold">
            {favoritedCount} image{favoritedCount !== 1 ? 's' : ''} favorited
          </div>
        )}
      </div>

      {totalImages === 0 ? (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-lg">
          {useReferenceImages ? (
            <>
              <p className="text-xl mb-4">🎨 Building our collection...</p>
              <p className="text-gray-400 mb-6">
                We're currently curating references for your project type.
                Our design team is actively building this library.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                For now, we'll discuss visual direction during our kickoff call.
              </p>
              <button
                onClick={onNext}
                className="px-8 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-bold"
              >
                Continue to Review →
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-400 mb-4">No images found. Try adjusting your keywords.</p>
              <button
                onClick={onRegenerate}
                className="px-6 py-3 border-2 border-white text-white rounded-md hover:bg-gray-900 transition-colors font-bold"
              >
                ← Edit Keywords
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-4 w-auto"
            columnClassName="pl-4 bg-clip-padding"
          >
            {useReferenceImages ? (
              referenceImages.map((image) => (
                <ReferenceImageCard
                  key={image.id}
                  image={image}
                  isFavorited={favoritedImageIds.includes(image.id)}
                  onToggleFavorite={() => onToggleFavoriteImage?.(image.id)}
                />
              ))
            ) : (
              blocks.map((block) => (
                <ImageCard
                  key={block.id}
                  block={block}
                  isFavorited={favoritedIds.includes(block.id)}
                  onToggleFavorite={() => onToggleFavorite(block.id)}
                />
              ))
            )}
          </Masonry>

          <div className="flex justify-between items-center mt-12 pt-8 border-t-2 border-gray-800">
            <button
              onClick={onRegenerate}
              className="px-6 py-3 border-2 border-white text-white rounded-md hover:bg-gray-900 transition-colors font-bold"
            >
              ← Edit Keywords & Regenerate
            </button>

            <button
              onClick={onNext}
              className="px-8 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-bold"
            >
              Continue to Review →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
