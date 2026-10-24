/**
 * Crums as it stands on the old site (content/projects/crums.md and its
 * files under public/images/uploads/crums), for a one-time move into the
 * portfolio. The files are fetched from this site's own /images folder.
 */
export const CRUMS = {
  title: "Crums",
  slug: "crums",
  year: 2025,
  services: ["Naming", "Branding", "Package Design", "Art Direction", "Motion Graphics", "Photography"],
  summary:
    "Crums is a startup bringing the flavours of South Indian snacks to a new generation. But with 14 snack variations, traditional packaging was too costly. The challenge? Cut costs without sacrificing a fresh, exciting brand presence.",
  text: `## The Challenge

Crums is a startup bringing the flavours of South Indian snacks to a new generation. With 14 different snack variations, traditional packaging options were prohibitively expensive for a new business. The challenge was to create a cost-effective packaging solution while maintaining a vibrant, distinctive brand identity.

## The Solution

We developed a unified packaging system using standardized green bags with a yellow label area. Each product variation is distinguished through unique label designs, stickers, and color-coded elements that allow for cost-efficient production while creating a strong brand presence. The playful typography and vibrant color palette establish a contemporary aesthetic that appeals to a younger audience while honoring traditional flavors.`,
  /** In the old site's order. The cover was its featured video, which has sound. */
  files: [
    { file: "comp-1.mp4", type: "video/mp4", role: "cover", hasAudio: true },
    { file: "crums-master-.jpg", type: "image/jpeg", role: "block", hasAudio: false },
    { file: "logo-animation-ae-final.mp4", type: "video/mp4", role: "block", hasAudio: false },
    { file: "artboard-3-2x.png", type: "image/png", role: "block", hasAudio: false },
    { file: "crums-typography-ae-f.mp4", type: "video/mp4", role: "block", hasAudio: false },
    { file: "mockup2.png", type: "image/png", role: "block", hasAudio: false },
  ],
  folder: "/images/uploads/crums/",
} as const;
