import Markdown from "react-markdown";
import type { Block } from "@/lib/portfolio/types";
import { Media } from "./media";

/**
 * A case study's blocks, plainly laid out: text in a reading column, media
 * full width, two or three side by side on larger screens. A starting point
 * for the site design.
 */
export function ProjectBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-10 sm:gap-16">
      {blocks.map((block) =>
        block.type === "text" ? (
          <div key={block.id} className="portfolio-prose max-w-[68ch] text-[17px] leading-relaxed text-ink-soft">
            <Markdown>{block.text}</Markdown>
          </div>
        ) : (
          <figure key={block.id}>
            <div
              className={
                block.media.length === 1
                  ? ""
                  : block.media.length === 2
                    ? "grid gap-3 sm:grid-cols-2"
                    : "grid gap-3 sm:grid-cols-3"
              }
            >
              {block.media.map((m) => (
                <Media key={m.id} media={m} sizes={`(min-width: 640px) ${Math.round(100 / block.media.length)}vw, 100vw`} />
              ))}
            </div>
            {block.caption ? <figcaption className="mt-3 text-sm text-muted">{block.caption}</figcaption> : null}
          </figure>
        ),
      )}
    </div>
  );
}
