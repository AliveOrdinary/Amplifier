'use client';

import Masonry from 'react-masonry-css';
import ImageCard from './ImageCard';
import type { ArenaBlock } from '@/lib/types';

interface ImageGalleryProps {
  blocks: ArenaBlock[];
  favoritedIds: number[];
  onToggleFavorite: (id: number) => void;
  onRegenerate: () => void;
  onNext: () => void;
}

export default function ImageGallery({
  blocks,
  favoritedIds,
  onToggleFavorite,
  onRegenerate,
  onNext,
}: ImageGalleryProps) {
  const breakpointColumns = {
    default: 3,
    1024: 2,
    640: 1,
  };

  const favoritedCount = favoritedIds.length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-rightserif font-bold mb-4 text-white">Visual Gallery</h2>
        <p className="text-gray-300 mb-4">
          We've curated {blocks.length} images from Are.na based on your keywords. Click the heart icon to favorite images that resonate with your vision.
        </p>

        {favoritedCount > 0 && (
          <div className="bg-white text-black px-4 py-2 rounded-full inline-block font-bold">
            {favoritedCount} image{favoritedCount !== 1 ? 's' : ''} favorited
          </div>
        )}
      </div>

      {blocks.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-400 mb-4">No images found. Try adjusting your keywords.</p>
          <button
            onClick={onRegenerate}
            className="px-6 py-3 border-2 border-white text-white rounded-md hover:bg-gray-900 transition-colors font-bold"
          >
            ← Edit Keywords
          </button>
        </div>
      ) : (
        <>
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-4 w-auto"
            columnClassName="pl-4 bg-clip-padding"
          >
            {blocks.map((block) => (
              <ImageCard
                key={block.id}
                block={block}
                isFavorited={favoritedIds.includes(block.id)}
                onToggleFavorite={() => onToggleFavorite(block.id)}
              />
            ))}
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
