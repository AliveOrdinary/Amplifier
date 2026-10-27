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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 sm:gap-y-16 lg:grid-cols-[200px_minmax(0,1fr)]">
      {blocks.map((block) =>
        block.type === "text" ? (
          // A labelled block opens a section, as on francisdes.com: a hairline across the page, then
          // "01 / The challenge" in the left column, level with the heading on the menu's line.
          sections.has(block.id) ? (
            <section
              key={block.id}
              id={sections.get(block.id)!.id}
              className="mt-8 grid scroll-mt-24 grid-cols-[minmax(0,1fr)] gap-x-10 border-t border-rule pt-5 sm:mt-16 lg:col-span-2 lg:grid-cols-[200px_minmax(0,1fr)]"
            >
              <div className={`${LABEL} mt-8 lg:mt-10 lg:pt-2`}>
                {sections.get(block.id)!.n} / {block.label}
              </div>
              <div className="portfolio-prose mt-4 max-w-[62ch] text-[17px] leading-relaxed text-ink-soft lg:col-start-2 lg:mt-10">
                <Markdown>{block.text}</Markdown>
              </div>
            </section>
          ) : (
            <div key={block.id} className="portfolio-prose max-w-[62ch] text-[17px] leading-relaxed text-ink-soft lg:col-start-2">
              <Markdown>{block.text}</Markdown>
            </div>
          )
        ) : (
          <div key={block.id} className="lg:col-span-2">
            <GrowingFigure block={block} />
          </div>
        ),
      )}
    </div>
  );
}

/** Rounded like the cover. */
const ROUND = "rounded-[16px] [clip-path:inset(0_round_16px)]";

/**
 * A media block that opens out as you scroll, like the cover. As on
 * francisdes.com: one picture at its own proportions; two or three side by
 * side cropped to equal squares with a gap, or touching as one picture
 * (`join`).
 */
function GrowingFigure({ block }: { block: MediaBlock }) {
  const n = block.media.length;
  const cols = n === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  const sizes = `(min-width: 640px) ${Math.round(100 / n)}vw, 100vw`;
  return (
    <figure>
      {n === 1 ? (
        <GrowingCover>
          <Media media={block.media[0]} sizes="100vw" />
        </GrowingCover>
      ) : block.join ? (
        <GrowingCover>
          <div className={`grid ${cols}`}>
            {block.media.map((m) => (
              <Media key={m.id} media={m} sizes={sizes} aspect="1 / 1" className="object-cover" />
            ))}
          </div>
        </GrowingCover>
      ) : (
        <GrowingCover split>
          <div className={`grid gap-3 sm:gap-6 ${cols}`}>
            {block.media.map((m) => (
              <Media key={m.id} media={m} sizes={sizes} aspect="1 / 1" className={`object-cover ${ROUND}`} />
            ))}
          </div>
        </GrowingCover>
      )}
      {block.caption ? <figcaption className="mt-3 text-sm text-muted">{block.caption}</figcaption> : null}
    </figure>
  );
}
