"use client";

import { Button, Mono } from "@/components/ui/primitives";

/** The end of a picker's grid: "Show more", loading, or nothing found. */
export function PickerFooter({
  more,
  loading,
  empty,
  onMore,
}: {
  more: boolean;
  loading: boolean;
  empty: boolean;
  onMore: () => void;
}) {
  if (loading) return <li className="col-span-full py-4 text-center"><Mono>Loading…</Mono></li>;
  if (empty) return <li className="col-span-full py-6 text-center text-[15px] text-ink-soft">No images match.</li>;
  if (!more) return null;
  return (
    <li className="col-span-full flex justify-center py-3">
      <Button size="sm" onClick={onMore}>
        Show more
      </Button>
    </li>
  );
}
