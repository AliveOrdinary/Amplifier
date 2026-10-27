import Markdown from "react-markdown";
import type { Block } from "@/lib/portfolio/types";
import { Media } from "./media";

/**
 * A case study's blocks on the site grid: text starts on the menu's line
 * (after the 200px label column) in a reading width; images and video run
 * the full width, two or three side by side on larger screens.
 */
export function ProjectBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="grid gap-x-10 gap-y-10 sm:gap-y-16 lg:grid-cols-[200px_1fr]">
      {blocks.map((block) =>
        block.type === "text" ? (
          <div key={block.id} className="portfolio-prose max-w-[62ch] text-[17px] leading-relaxed text-ink-soft lg:col-start-2">
            <Markdown>{block.text}</Markdown>
          </div>
        ) : (
          <figure key={block.id} className="lg:col-span-2">
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
