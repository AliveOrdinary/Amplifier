"use client";

import { useState } from "react";
import type { StuckImage } from "@/lib/library/queries";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { useLibrary } from "./library-provider";

/**
 * Images that couldn't be added after a few tries (lib/library/unfinished.ts),
 * on the Review screen: say so plainly, and offer Retry or Remove.
 */
export function StuckImages({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { stuck } = useLibrary();
  if (!stuck.length) return null;

  return (
    <div className={cn("flex flex-col", className)} role="status">
      <p className={compact ? "text-sm" : "text-[17px]"}>
        Couldn&apos;t add {stuck.length} {stuck.length === 1 ? "image" : "images"}
      </p>
      <p className={cn("mt-1 text-muted", compact ? "text-xs" : "text-sm")}>
        Adding stopped part-way and didn&apos;t work on a few more tries. Try again, or remove {stuck.length === 1 ? "it" : "them"}.
      </p>
      <ul className={cn("flex flex-col", compact ? "mt-3 gap-3" : "mt-4 gap-0")}>
        {stuck.map((image) => (
          <StuckRow key={image.id} image={image} compact={compact} />
        ))}
      </ul>
    </div>
  );
}

function StuckRow({ image, compact }: { image: StuckImage; compact: boolean }) {
  const { retryStuck, removeStuck } = useLibrary();
  const [busy, setBusy] = useState<"retry" | "remove" | null>(null);
  const run = (kind: "retry" | "remove") => async () => {
    setBusy(kind);
    try {
      await (kind === "retry" ? retryStuck(image) : removeStuck(image));
    } finally {
      setBusy(null);
    }
  };

  const board = image.collection?.split(" · ").slice(1).join(" · ");
  const label = board ? `Pin from ${board}` : (image.name ?? "Image");
  const added = new Date(image.createdAt).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        !compact && "border-t border-rule py-3 first:border-t-0 first:pt-0",
      )}
    >
      <div className="min-w-0 flex-[1_1_220px]">
        <p className={cn("truncate", compact ? "text-xs" : "text-[15px]")}>
          {image.pageUrl ? (
            <a href={image.pageUrl} target="_blank" rel="noreferrer" className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
              {label}
            </a>
          ) : (
            label
          )}
        </p>
        <Mono className="mt-0.5 block truncate" title={image.error}>
          Added {added} · {image.error}
        </Mono>
      </div>
      <div className="flex items-center gap-4">
        <Button size="sm" onClick={run("retry")} disabled={busy !== null}>
          {busy === "retry" ? "Retrying…" : "Retry"}
        </Button>
        <Button size="sm" variant="text" onClick={run("remove")} disabled={busy !== null}>
          {busy === "remove" ? "Removing…" : "Remove"}
        </Button>
      </div>
    </li>
  );
}
