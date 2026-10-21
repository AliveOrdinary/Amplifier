"use client";

import { useEffect, useMemo, useState } from "react";
import { DIMENSIONS, MEDIA, mediumLabel } from "@/lib/library/constants";
import type { ImageStatus } from "@/lib/library/types";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { useLibrary } from "../library-provider";
import { ImageStage, ScorePanel, SecondaryActions, isTypingTarget } from "../editor";

const STATUS_FILTERS: { key: ImageStatus | "all"; label: string }[] = [
  { key: "approved", label: "Approved" },
  { key: "pending", label: "To review" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function BrowseScreen() {
  const { images, decide, setScore } = useLibrary();
  const [status, setStatus] = useState<ImageStatus | "all">("approved");
  const [medium, setMedium] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusDim, setFocusDim] = useState(0);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return images.filter(
      (i) =>
        i.ready &&
        (status === "all" || i.status === status) &&
        (!medium || i.medium === medium) &&
        (!term || `${i.description ?? ""} ${i.name ?? ""}`.toLowerCase().includes(term)),
    );
  }, [images, status, medium, search]);

  // Keep showing the open image even if an edit moves it out of the filter.
  const selected = images.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") return setSelectedId(null);
      if (!selected) return;
      const index = visible.findIndex((i) => i.id === selected.id);
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = visible[index + 1];
        if (next) setSelectedId(next.id);
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        const prev = visible[index - 1];
        if (prev) setSelectedId(prev.id);
      } else if (/^[1-8]$/.test(event.key)) {
        setFocusDim(Number(event.key) - 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const dim = DIMENSIONS[focusDim].key;
        const now = selected.scores[dim]?.score ?? 0;
        setScore(selected, dim, now + (event.key === "ArrowRight" ? 0.5 : -0.5));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={cn("grid min-h-0 flex-1 grid-cols-1", selected && "lg:grid-cols-[minmax(0,1fr)_440px]")}>
      <section aria-label="Library images" className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-2.5 sm:px-6">
          <div role="group" aria-label="Status" className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={status === f.key}
                onClick={() => setStatus(f.key)}
                className={cn(
                  "h-8 border px-3 text-sm",
                  status === f.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="browse-medium">
            Medium
          </label>
          <select
            id="browse-medium"
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className="h-8 border border-rule-strong bg-paper px-2 text-sm text-ink"
          >
            <option value="">All media</option>
            {MEDIA.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="browse-search">
            Search descriptions
          </label>
          <input
            id="browse-search"
            type="search"
            placeholder="Search descriptions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 min-w-0 flex-1 basis-48 border border-rule-strong bg-transparent px-2.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none sm:max-w-xs"
          />
          <Mono className="ml-auto">{visible.length} images</Mono>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {visible.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {visible.map((image) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(image.id)}
                    aria-current={selected?.id === image.id ? "true" : undefined}
                    className={cn(
                      "group block w-full text-left outline-offset-2",
                      selected?.id === image.id && "outline outline-2 outline-signal",
                    )}
                  >
                    <span className="block aspect-[4/5] overflow-hidden bg-panel">
                      {image.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.thumbUrl}
                          alt={image.description ?? ""}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </span>
                    <Mono className="mt-1.5 block truncate">{mediumLabel(image.medium)}</Mono>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-[15px] text-ink-soft">No images match.</p>
          )}
        </div>
      </section>

      {selected ? (
        <aside
          aria-label="Edit image"
          className="flex min-h-0 flex-col border-rule max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:bg-paper lg:border-l"
        >
          <div className="flex items-center justify-between border-b border-rule px-4 py-2 lg:px-6">
            <Mono>{selected.status === "pending" ? "To review" : selected.status}</Mono>
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)} aria-label="Close">
              Close <span className="font-mono text-xs opacity-60">Esc</span>
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
            <ImageStage image={selected} className="h-[300px]" />
            <p className="mt-3 text-[15px] text-ink-soft">{selected.description ?? selected.name}</p>
            <div className="mt-5">
              <ScorePanel image={selected} focusDim={focusDim} onFocusDim={setFocusDim} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {selected.status !== "approved" ? (
                <Button variant="primary" onClick={() => decide(selected, "approved")}>
                  Approve
                </Button>
              ) : null}
              {selected.status !== "rejected" ? <Button onClick={() => decide(selected, "rejected")}>Reject</Button> : null}
              {selected.status !== "pending" ? (
                <Button variant="ghost" onClick={() => decide(selected, "pending")}>
                  Back to review
                </Button>
              ) : null}
            </div>
            <div className="mt-3">
              <SecondaryActions image={selected} />
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

