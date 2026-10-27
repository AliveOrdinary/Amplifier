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
/**
 * The case study's sections: every text block with a label, numbered from
 * 01 in order. Their ids are what the side scale scrolls to.
 */
export function sectionsOf(blocks: Block[]) {
  return blocks.flatMap((b) => (b.type === "text" && b.label ? [{ id: `s-${b.id}`, block: b.id, label: b.label }] : [])).map((s, i) => ({
    ...s,
    n: String(i + 1).padStart(2, "0"),
  }));
}

const LABEL = "font-mono text-[12px] uppercase tracking-[0.08em] text-muted";

export function ProjectBlocks({ blocks }: { blocks: Block[] }) {
  const sections = new Map(sectionsOf(blocks).map((s) => [s.block, s]));
  return (
    <div className="grid gap-x-10 gap-y-10 sm:gap-y-16 lg:grid-cols-[200px_1fr]">
      {blocks.map((block) =>
        block.type === "text" ? (
          // A labelled block opens a section: "01 / The challenge" on the left, like Home's sections.
          <section
            key={block.id}
            id={sections.get(block.id)?.id}
            className="grid scroll-mt-24 gap-x-10 gap-y-4 lg:col-span-2 lg:grid-cols-[200px_1fr]"
          >
            {sections.has(block.id) ? (
              <div className={`${LABEL} lg:pt-1.5`}>
                {sections.get(block.id)!.n} / {block.label}
              </div>
            ) : null}
            <div className="portfolio-prose max-w-[62ch] text-[17px] leading-relaxed text-ink-soft lg:col-start-2">
              <Markdown>{block.text}</Markdown>
            </div>
          </section>
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
