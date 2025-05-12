export interface ProjectImageItem {
  image: string;
  caption?: string;
  order?: number;
}

export interface ProjectVideoItem {
  video: string;
  caption?: string;
  order?: number;
  hasAudio?: boolean;
}

export interface ProjectMediaItem {
  type: 'image' | 'video';
  src: string;
  caption?: string;
  order: number;
  hasAudio?: boolean;
}

export interface ProjectData {
  title: string;
  slug: string;
  featuredImage?: string;
  featuredVideo?: string;
  featuredVideoHasAudio?: boolean;
  shortSummary: string;
  mainSummary: string;
  year: number;
  services: string[];
  projectImages?: ProjectImageItem[];
  projectVideos?: ProjectVideoItem[];
  featured: boolean;
  order: number;
  content?: string;
} 