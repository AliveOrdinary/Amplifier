import Markdown from "react-markdown";
import type { Block, MediaBlock } from "@/lib/portfolio/types";
import { GrowingCover } from "./growing-cover";
import { Media } from "./media";

/**
 * A case study's blocks on the site grid: text starts on the menu's line
 * (after the 200px label column) in a reading width; images and video run
 * the full width, two or three side by side on larger screens, and open out
 * to the full width of the screen as you scroll, like the cover.
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
          <div key={block.id} className="lg:col-span-2">
            <GrowingFigure block={block} />
          </div>
        ),
      )}
    </div>
  );
}

/** Rounded like the cover; the picture fills its frame. */
const ROUND = "rounded-[24px] [clip-path:inset(0_round_24px)]";

/** A media block that opens out as you scroll, like the cover. */
function GrowingFigure({ block }: { block: MediaBlock }) {
  const n = block.media.length;
  return (
    <figure>
      <GrowingCover split={n > 1}>
        {n === 1 ? (
          <Media media={block.media[0]} sizes="100vw" />
        ) : (
          <div className={n === 2 ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-3"}>
            {block.media.map((m) => (
              <Media key={m.id} media={m} sizes={`(min-width: 640px) ${Math.round(100 / n)}vw, 100vw`} className={ROUND} />
            ))}
          </div>
        )}
      </GrowingCover>
      {block.caption ? <figcaption className="mt-3 text-sm text-muted">{block.caption}</figcaption> : null}
    </figure>
  );
}
