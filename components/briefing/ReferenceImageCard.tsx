'use client';

import { useState, memo } from 'react';
import { motion } from 'framer-motion';
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

  // Determine match quality badge
  const getMatchBadge = () => {
    if (matchScore >= 10) return { text: '⭐ Excellent', color: 'bg-green-500' };
    if (matchScore >= 5) return { text: '✓ Good', color: 'bg-blue-500' };
    return { text: '~ Related', color: 'bg-gray-500' };
  };

  const badge = getMatchBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
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
        <div className={`absolute top-3 left-3 ${badge.color} text-white px-2 py-1 rounded text-xs font-bold`}>
          {badge.text}
        </div>

        {/* Overlay with favorite button */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${
            isHovered || isFavorited ? 'bg-opacity-40' : 'bg-opacity-0'
          }`}
        >
          <button
            onClick={onToggleFavorite}
            className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              isFavorited
                ? 'bg-red-500 text-white scale-110'
                : 'bg-white text-gray-700 hover:bg-red-500 hover:text-white'
            } ${isHovered || isFavorited ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            aria-label={isFavorited ? 'Unfavorite' : 'Favorite'}
          >
            {isFavorited ? '❤️' : '🤍'}
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
        {image.matched_on && (
          <div className="mt-1 flex flex-wrap gap-1">
            {image.matched_on.industries.slice(0, 2).map((tag, i) => (
              <span key={`ind-${i}`} className="text-xs bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {image.matched_on.styles.slice(0, 2).map((tag, i) => (
              <span key={`style-${i}`} className="text-xs bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {image.matched_on.moods.slice(0, 2).map((tag, i) => (
              <span key={`mood-${i}`} className="text-xs bg-pink-900 text-pink-200 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default ReferenceImageCard;
