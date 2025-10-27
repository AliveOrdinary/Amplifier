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
// Note: Arena.net integration removed - now only uses internal reference images

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
  referenceImages: ReferenceImage[];
  favoritedImageIds: string[];
  timestamp: string;
}

export interface ExtractKeywordsRequest {
  responses: QuestionnaireResponses;
}

export interface ExtractKeywordsResponse {
  keywords: string[];
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

// Reference Image Bank Types

export interface ReferenceImage {
  id: string;
  thumbnail_path: string;
  storage_path: string;
  original_filename: string;
  notes?: string;
  match_score?: number;
  matched_keywords?: string[];
  matched_on?: Record<string, string[]>; // Dynamic category matches
  // Dynamic category fields - any array or object fields from vocabulary config
  [key: string]: any;
}

export interface SearchReferencesRequest {
  keywords: string[];
}

export interface SearchReferencesResponse {
  images: ReferenceImage[];
  error?: string;
  warning?: string;
} 