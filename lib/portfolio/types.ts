/**
 * The portfolio as the public site sees it. Shared by the server and the
 * browser; everything here is plain data, ready to render.
 */

export type MediaKind = "image" | "video";

export type PortfolioMedia = {
  id: string;
  kind: MediaKind;
  /** Public address of the original file. */
  url: string;
  /** Pixels. Null only for files added before sizes were recorded. */
  width: number | null;
  height: number | null;
  /** What the image shows, for screen readers. Empty for decorative media. */
  alt: string;
  caption: string | null;
  /** Videos: true when the sound matters (offer an unmute button); false plays silent. */
  hasAudio: boolean;
};

/** A run of text, written in Markdown (## headings, paragraphs, lists, links, **bold**). */
export type TextBlock = { id: string; type: "text"; text: string };

/** One to three images or videos shown side by side, with an optional caption under them. */
export type MediaBlock = { id: string; type: "media"; media: PortfolioMedia[]; caption: string | null };

export type Block = TextBlock | MediaBlock;

/** A project in a list: Home's featured work, the Works page. */
export type ProjectCard = {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  year: number | null;
  services: string[];
  /** A sentence or two: what it was and why it mattered. */
  summary: string | null;
  featured: boolean;
  /** Image or video to show for the project. Null when none was chosen. */
  cover: PortfolioMedia | null;
  publishedAt: string | null;
};

/** A whole case study, with its neighbours in the studio's order for "next project" links. */
export type Project = ProjectCard & {
  blocks: Block[];
  /** Every file uploaded to the project, in upload order (blocks hold the ones to show). */
  media: PortfolioMedia[];
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  /** Not published yet: only seen in preview. */
  draft: boolean;
  /** A studio member is previewing (show <PreviewBanner>). */
  preview: boolean;
};

/* --------------------------------------------- as stored in the database */

/** The languages the public site is written in. English is the original; others fall back to it. */
export type Locale = "en" | "fr";

/**
 * A project's French, stored beside the English (projects.fr). Blocks and
 * alt text are keyed by the English block and file ids, so reordering or
 * editing the English keeps them attached. Empty means "use the English".
 */
export type ProjectFrench = {
  title?: string;
  summary?: string;
  services?: string[];
  blocks?: Record<string, { text?: string; caption?: string }>;
  alt?: Record<string, string>;
};

/** Blocks as saved: media blocks hold media ids, resolved into PortfolioMedia on read. */
export type StoredBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "media"; media: string[]; caption?: string | null };
