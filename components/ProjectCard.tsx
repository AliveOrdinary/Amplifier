'use client';

import Link from 'next/link';
import ProjectMedia from './ProjectMedia';
import React from 'react';

interface ProjectCardProps {
  title: string;
  slug: string;
  featuredImage?: string;
  featuredVideo?: string;
  shortSummary: string;
  year: number;
  services: string[];
}

export default function ProjectCard({
  title,
  slug,
  featuredImage,
  featuredVideo,
}: ProjectCardProps) {
  const hasVideo = !!featuredVideo;
  const featuredContentSrc = hasVideo ? featuredVideo : featuredImage;
  const mediaType = hasVideo ? 'video' : 'image';

  if (!featuredContentSrc) {
    return null;
  }

  const handleMediaClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mediaType === 'video') {
      event.stopPropagation();
    }
  };

  return (
    <Link href={`/projects/${slug}`} className="block group" aria-label={`View project: ${title}`}>
      <div className="mb-4">
        <ProjectMedia 
          type={mediaType} 
          src={featuredContentSrc} 
          alt={title}
          onClick={handleMediaClick}
        />
      </div>
    </Link>
  );
} 