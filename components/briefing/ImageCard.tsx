'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import type { ArenaBlock } from '@/lib/types';

interface ImageCardProps {
  block: ArenaBlock;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}

export default function ImageCard({ block, isFavorited, onToggleFavorite }: ImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageUrl = block.image?.display?.url || block.image?.thumb?.url || '';
  const title = block.title || 'Untitled';
  const username = block.user?.username || 'Unknown';
  const sourceUrl = block.source?.url || `https://are.na/block/${block.id}`;

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
            alt={title}
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
        <p className="text-sm font-medium text-white truncate">{title}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-400">by {username}</p>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-300 hover:text-white hover:underline transition-colors"
            >
              View Source →
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
