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

// Visual Briefing Tool Types

export interface ArenaBlock {
  id: number;
  title: string | null;
  class: 'Image' | 'Link' | 'Text' | 'Attachment' | 'Media';
  image?: {
    thumb?: { url: string };
    display?: { url: string };
    original?: { url: string; file_size?: number; file_size_display?: string };
  };
  description?: string;
  description_html?: string;
  user: {
    id: number;
    username: string;
    full_name: string;
  };
  source?: {
    url: string;
    provider?: {
      name: string;
      url: string;
    };
  };
  content?: string;
  content_html?: string;
  created_at: string;
  updated_at: string;
}

export interface ArenaSearchResponse {
  term: string;
  per: number;
  current_page: number;
  total_pages: number;
  length: number;
  blocks?: ArenaBlock[];
  channels?: any[];
  users?: any[];
}

export interface QuestionnaireResponses {
  // Client Info
  clientName: string;
  clientEmail: string;
  projectName?: string;

  // Step 1: Brand Strategy & Positioning
  visualApproach: string; // disruptive vs quiet
  creativeDocuments: string;
  problemSolved: string;
  deeperReason: string;
  customerWords: string;
  differentiators: string;
  strategicThoughts?: string;

  // Step 2: Brand Personality & Tone
  dinnerPartyBehavior: string;
  neverFeelLike: string;
  energyMood: string;
  soundtrackGenre: string;
  artistsDiversification: string;

  // Step 3: Visual Identity & Style
  colorAssociations: string;
  visualStyle: string; // clean/minimal vs rich/layered
  admiredBrands: string;
  aestheticInspiration: string;
  decolonizationVisual: string;

  // Step 4: Target Audience
  audienceDescription: string;
  idealClient: string;
  desiredFeeling: string;
  customerFrustrations: string;
  avoidCustomerTypes?: string;
  brandRole: string;

  // Step 5: Vision & Growth
  fiveYearVision: string;
  expansionPlans: string;
  dreamPartnerships: string;
  bigDream: string;
  successBeyondSales: string;
  longTermFocus: string;
  existingCollection: string;
  competitors: string;
}

export interface BriefingData {
  responses: QuestionnaireResponses;
  extractedKeywords: string[];
  editedKeywords?: string[];
  arenaBlocks: ArenaBlock[];
  favoritedBlockIds: number[];
  timestamp: string;
}

export interface ExtractKeywordsRequest {
  responses: QuestionnaireResponses;
}

export interface ExtractKeywordsResponse {
  keywords: string[];
  error?: string;
}

export interface SearchArenaRequest {
  keywords: string[];
}

export interface SearchArenaResponse {
  blocks: ArenaBlock[];
  error?: string;
}

export interface SendBriefingRequest {
  briefingData: BriefingData;
}

export interface SendBriefingResponse {
  success: boolean;
  message: string;
  error?: string;
} 