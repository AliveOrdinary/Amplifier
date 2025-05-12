'use client'
import Image from 'next/image';
import React, { useState, useRef, MouseEvent } from 'react';


interface ProjectMediaProps {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  caption?: string; // Re-add caption if needed, or remove if unused
  aspectRatio?: string; // Re-add if needed, or remove if unused
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  hasAudio?: boolean; // Add hasAudio prop
}

export default function ProjectMedia({ 
  type, 
  src, 
  alt, 
  onClick,
  hasAudio // Destructure hasAudio prop
}: ProjectMediaProps) {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Remove state related to automatic detection
  // const [hasAudioState, setHasAudioState] = useState(false);

  // Remove the useEffect hook for automatic detection

  const toggleMute = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); // Prevent click from bubbling up from the button
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="relative w-full" onClick={onClick}>
      {type === 'image' ? (
        <div className="relative w-full aspect-video">
          <Image
            src={src}
            alt={alt || 'Project media'}
            fill
            sizes="w-full h-full"
            className="object-fill"
            priority
          />
        </div>
      ) : (
        <div className="relative group">
          <video
            ref={videoRef}
            src={src}
            autoPlay
            muted={isMuted} // Controlled by state
            loop
            playsInline
            className="w-full object-fill"
            preload="metadata" 
          />
          
          {/* Mute button shown based on hasAudio PROP now */}
          {hasAudio && (
            <button 
              onClick={toggleMute}
              className="absolute bottom-4 right-4 bg-black/70 rounded-full p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                // Muted Icon SVG
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              ) : (
                // Unmuted Icon SVG
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
} 