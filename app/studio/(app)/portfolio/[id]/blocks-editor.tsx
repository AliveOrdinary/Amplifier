"use client";

import { useState } from "react";
import type { StudioMedia } from "@/lib/portfolio/studio";
import type { StoredBlock } from "@/lib/portfolio/types";
import { blockId } from "@/lib/portfolio/blocks";
import { Button, EmptyState, Input, Mono, cn } from "@/components/ui/primitives";
import { Thumb } from "./media-panel";

type MediaBlock = Extract<StoredBlock, { type: "media" }>;

/** The case study as a list of blocks: text, or one to three files side by side. */
export function BlocksEditor({
  blocks,
  media,
  onChange,
  areaClass,
}: {
  blocks: StoredBlock[];
  media: StudioMedia[];
  onChange: (blocks: StoredBlock[]) => void;
  areaClass: string;
}) {
  const byId = new Map(media.map((m) => [m.id, m]));
  const update = (i: number, block: StoredBlock) => onChange(blocks.map((b, j) => (j === i ? block : b)));
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i));
  const move = (i: number, to: number) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(to, 0, b);
    onChange(next);
  };
  const add = (block: StoredBlock) => onChange([...blocks, block]);

  // Files not in any block yet: the obvious next things to place.
  const used = new Set(blocks.flatMap((b) => (b.type === "media" ? b.media : [])));
  const unused = media.filter((m) => !used.has(m.id));

  return (
    <div className="flex flex-col gap-4">
      {blocks.length ? (
        <ol className="flex flex-col gap-4">
          {blocks.map((block, i) => (
            <li key={block.id} className="border border-rule-strong">
              <div className="flex items-center gap-3 border-b border-rule px-4 py-2">
                <Mono>{String(i + 1).padStart(2, "0")}</Mono>
                <Mono className="text-ink">{block.type === "text" ? "Text" : block.media.length > 1 ? "Side by side" : "Image or video"}</Mono>
                <div className="-mr-2 ml-auto flex">
                  <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)}>
                    ↓
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(i)}>
                    Remove
                  </Button>
                </div>
              </div>
              <div className="p-4">
                {block.type === "text" ? (
                  <>
                    <label htmlFor={`l-${block.id}`} className="mb-1.5 block text-sm text-muted">
                      Section label <span className="text-muted/70">(optional: shown as “01 / The challenge” beside the text and on the side scale)</span>
                    </label>
                    <input
                      id={`l-${block.id}`}
                      value={block.label ?? ""}
                      maxLength={40}
                      onChange={(e) => update(i, { ...block, label: e.target.value })}
                      placeholder="The challenge"
                      className="mb-3 h-9 w-full max-w-xs border border-rule-strong bg-transparent px-2.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
                    />
                    <label htmlFor={`b-${block.id}`} className="sr-only">
                      Text
                    </label>
                    <textarea
                      id={`b-${block.id}`}
                      rows={Math.min(18, Math.max(5, block.text.split("\n").length + 1))}
                      value={block.text}
                      onChange={(e) => update(i, { ...block, text: e.target.value })}
                      placeholder={"## The challenge\n\nWhat the client needed, in a few sentences."}
                      className={areaClass}
                    />
                    <p className="mt-2 text-sm text-muted">
                      ## starts a heading. Leave a blank line between paragraphs. **bold**, [link](https://…), and - for lists.
                    </p>
                  </>
                ) : (
                  <MediaBlockEditor block={block} byId={byId} media={media} onChange={(b) => update(i, b)} />
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Nothing here yet">
          Add text and images below. The cover and summary already show at the top of the page.
        </EmptyState>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => add({ id: blockId(), type: "text", text: "" })}>+ Text</Button>
        <Button
          disabled={!media.length}
          onClick={() => add({ id: blockId(), type: "media", media: unused[0] ? [unused[0].id] : [media[0].id], caption: null })}
        >
          + Image or video
        </Button>
        {media.length && unused.length ? (
          <Button
            variant="ghost"
            onClick={() => onChange([...blocks, ...unused.map((m): StoredBlock => ({ id: blockId(), type: "media", media: [m.id], caption: null }))])}
          >
            + All {unused.length} unplaced {unused.length === 1 ? "file" : "files"}, one after another
          </Button>
        ) : null}
        {!media.length ? <span className="text-sm text-muted">Upload images or video above to place them here.</span> : null}
      </div>
    </div>
  );
}

function MediaBlockEditor({
  block,
  byId,
  media,
  onChange,
}: {
  block: MediaBlock;
  byId: Map<string, StudioMedia>;
  media: StudioMedia[];
  onChange: (block: MediaBlock) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const chosen = block.media.filter((id) => byId.has(id));
  const toggle = (id: string) => {
    if (chosen.includes(id)) {
      if (chosen.length > 1) onChange({ ...block, media: chosen.filter((m) => m !== id) });
    } else if (chosen.length < 3) {
      onChange({ ...block, media: [...chosen, id] });
    }
  };
  const shift = (from: number, to: number) => {
    const next = [...chosen];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange({ ...block, media: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-3", chosen.length === 2 && "grid-cols-2", chosen.length === 3 && "grid-cols-3")}>
        {chosen.map((id, i) => (
          <div key={id} className="min-w-0">
            <Thumb media={byId.get(id)!} className={chosen.length === 1 ? "max-h-[360px]" : "h-40"} />
            {chosen.length > 1 ? (
              <div className="-ml-3 mt-1 flex">
                <Button size="sm" variant="ghost" aria-label="Move left" disabled={i === 0} onClick={() => shift(i, i - 1)}>
                  ←
                </Button>
                <Button size="sm" variant="ghost" aria-label="Move right" disabled={i === chosen.length - 1} onClick={() => shift(i, i + 1)}>
                  →
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        {!chosen.length ? <p className="text-sm text-danger">The file in this block was deleted. Choose another or remove the block.</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setChoosing((c) => !c)} aria-expanded={choosing}>
          {choosing ? "Done choosing" : chosen.length < 3 ? "Choose files (up to 3 side by side)" : "Change files"}
        </Button>
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor={`cap-${block.id}`} className="sr-only">
            Caption
          </label>
          <Input
            id={`cap-${block.id}`}
            placeholder="Caption (optional)"
            value={block.caption ?? ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            className="h-9"
          />
        </div>
        {chosen.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.join)}
              onChange={(e) => onChange({ ...block, join: e.target.checked })}
              className="size-4 accent-[var(--signal)]"
            />
            No gap (show them as one picture)
          </label>
        ) : chosen.length === 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.scroll)}
              onChange={(e) => onChange({ ...block, scroll: e.target.checked })}
              className="size-4 accent-[var(--signal)]"
            />
            Scroll inside a 16:9 frame (for a full-length page design)
          </label>
        ) : null}
      </div>

      {choosing ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 border-t border-rule pt-3">
          {media.map((m) => {
            const on = chosen.includes(m.id);
            const full = !on && chosen.length >= 3;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggle(m.id)}
                  className={cn(
                    "relative block w-full outline-offset-2 disabled:opacity-40",
                    on && "outline outline-2 outline-signal",
                  )}
                >
                  <Thumb media={m} className="h-20" />
                  {on ? (
                    <span className="absolute top-1 left-1 bg-signal px-1.5 font-mono text-[11px] text-on-signal">
                      {chosen.indexOf(m.id) + 1}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
