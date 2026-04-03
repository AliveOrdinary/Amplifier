'use client';

import { useState, memo } from 'react';
import Image from 'next/image';
import type { ReferenceImage } from '@/lib/types';

interface ReferenceImageCardProps {
  image: ReferenceImage;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}

const ReferenceImageCard = memo(function ReferenceImageCard({ image, isFavorited, onToggleFavorite }: ReferenceImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageUrl = image.thumbnail_path;
  const filename = image.original_filename || 'Untitled';
  const matchScore = image.match_score || 0;
  const matchedKeywords = image.matched_keywords || [];

  const getMatchBadge = () => {
    if (matchScore >= 10) return { text: 'Excellent', className: 'bg-green-900/50 text-green-300 border border-green-700' };
    if (matchScore >= 5) return { text: 'Good match', className: 'bg-blue-900/50 text-blue-300 border border-blue-700' };
    return { text: 'Related', className: 'bg-gray-800 text-gray-300 border border-gray-700' };
  };

  const badge = getMatchBadge();

  return (
    <div
      className="relative group mb-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative overflow-hidden rounded-lg bg-gray-900 min-h-[200px]">
        {!imageLoaded && imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
          </div>
        )}

        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={filename}
            width={400}
            height={400}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={`w-full h-auto transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              console.error('Failed to load image:', imageUrl);
              setImageLoaded(true);
            }}
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center bg-gray-800 text-gray-500">
            <p className="text-sm">No image available</p>
          </div>
        )}

        {/* Match score badge */}
        <div className={`absolute top-3 left-3 ${badge.className} px-2 py-1 rounded text-xs font-medium`}>
          {badge.text}
        </div>

        {/* Overlay with favorite button */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
            isHovered || isFavorited ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={onToggleFavorite}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              isFavorited
                ? 'bg-red-500 text-white'
                : 'bg-white/90 text-gray-600 hover:bg-red-500 hover:text-white'
            }`}
            aria-label={isFavorited ? 'Unfavorite' : 'Favorite'}
          >
            <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 px-1">
        <p className="text-sm font-medium text-white truncate">{filename}</p>
        {matchedKeywords.length > 0 && (
          <div className="mt-1">
            <p className="text-xs text-gray-400">
              Matches: {matchedKeywords.slice(0, 3).join(', ')}
              {matchedKeywords.length > 3 && ` +${matchedKeywords.length - 3}`}
            </p>
          </div>
        )}
        {image.matched_on && Object.keys(image.matched_on).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(image.matched_on)
              .flatMap(([category, tags]) =>
                (tags || []).slice(0, 2).map((tag, i) => (
                  <span key={`${category}-${i}`} className="text-xs bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))
              )
              .slice(0, 5)}
          </div>
        )}
      </div>
    </div>
  );
});

export default ReferenceImageCard;
