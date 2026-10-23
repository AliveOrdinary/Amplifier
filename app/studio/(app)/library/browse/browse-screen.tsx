"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MEDIA, mediumLabel, openingFilters } from "@/lib/library/constants";
import type { ImageStatus, LibraryImage } from "@/lib/library/types";
import type { LibraryFilters, PageCursor } from "@/lib/library/queries";
import { Button, Mono, Select, cn } from "@/components/ui/primitives";
import { useLibrary } from "../library-provider";
import { browsePage, findSimilar, imagesById } from "../actions";
import { ImageStage, ScorePanel, SecondaryActions, hotkeyIndex, isTypingTarget } from "../editor";

const STATUS_FILTERS: { key: ImageStatus | "all"; label: string }[] = [
  { key: "approved", label: "Approved" },
  { key: "pending", label: "To review" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

/**
 * The library in pages: the server filters and returns 60 images at a time,
 * and the next page loads as you scroll near the end. Edits show at once
 * (images live in the library provider); an image that no longer matches
 * the filters drops out, unless it's the one open.
 */
export type FirstPage = { images: LibraryImage[]; next: PageCursor | null };

export function BrowseScreen({ initialCheck = false, firstPage }: { initialCheck?: boolean; firstPage?: FirstPage }) {
  const { images, counts, boards, remember, dimensions, decide, setScore, notify } = useLibrary();
  const [similar, setSimilar] = useState<{ id: string; ids: string[] } | null>(null);
  const [finding, setFinding] = useState(false);
  const [status, setStatus] = useState<ImageStatus | "all">(initialCheck ? "all" : "approved");
  const [onlyCheck, setOnlyCheck] = useState(initialCheck);
  const [medium, setMedium] = useState("");
  const [board, setBoard] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusDim, setFocusDim] = useState(0);

  // Search waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = useMemo<LibraryFilters>(
    () => ({ status, medium, search: term, check: onlyCheck, board }),
    [status, medium, term, onlyCheck, board],
  );

  /* ---------------------------------------------------------- pages */

  const [page, setPage] = useState<{ key: string; ids: string[]; next: PageCursor | null; since: string }>(() =>
    firstPage
      ? {
          key: JSON.stringify(openingFilters(initialCheck)),
          ids: firstPage.images.map((i) => i.id),
          next: firstPage.next,
          since: firstPage.images[0]?.createdAt ?? new Date(0).toISOString(),
        }
      : { key: "", ids: [], next: null, since: "" },
  );
  // The page the server sent: into the library's image cache once, and no second fetch for it.
  const seeded = useRef(firstPage ?? null);
  const [more, setMore] = useState(false);
  const request = useRef(0);
  const filterKey = JSON.stringify(filters);
  // Loading while the list on screen is for other filters, or while a next page is on its way.
  const loading = page.key !== filterKey || more;

  const load = useCallback(
    (cursor: PageCursor | null) => {
      const id = ++request.current;
      return browsePage(filters, cursor).then((r) => {
        if (id !== request.current) return; // the filters changed meanwhile
        setMore(false);
        if (!r.ok) {
          setPage((p) => ({ ...p, key: filterKey }));
          return notify(r.error, { tone: "error" });
        }
        remember(r.images);
        setPage((p) => ({
          key: filterKey,
          ids: cursor && p.key === filterKey ? [...p.ids, ...r.images.map((i) => i.id)] : r.images.map((i) => i.id),
          next: r.next,
          since: cursor && p.key === filterKey ? p.since : (r.images[0]?.createdAt ?? new Date(0).toISOString()),
        }));
      });
    },
    [filters, filterKey, remember, notify],
  );

  useEffect(() => {
    if (firstPage) remember(firstPage.images);
  }, [firstPage, remember]);

  // A fresh first page whenever the filters change (the opening one came with the page).
  useEffect(() => {
    if (seeded.current) {
      seeded.current = null;
      return;
    }
    void load(null);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loading || !page.next || similar) return;
    setMore(true);
    void load(page.next);
  }, [loading, page.next, similar, load]);

  /* ---------------------------------------------------- what's shown */

  // The server's first page counts as loaded straight away, before it reaches the library's cache.
  const byId = useMemo(() => {
    const map = new Map((firstPage?.images ?? []).map((i) => [i.id, i]));
    for (const image of images) map.set(image.id, image);
    return map;
  }, [images, firstPage]);
  const needsCheck = useCallback((i: LibraryImage) => dimensions.some((d) => i.scores[d.key]?.check), [dimensions]);
  const matches = useCallback(
    (i: LibraryImage) =>
      i.ready &&
      (!onlyCheck || needsCheck(i)) &&
      (status === "all" || i.status === status) &&
      (!medium || i.medium === medium) &&
      (!board || i.collection === board),
    [onlyCheck, needsCheck, status, medium, board],
  );

  const visible = useMemo(() => {
    if (similar) return similar.ids.flatMap((id) => (byId.get(id)?.ready ? [byId.get(id)!] : []));
    const listed = new Set(page.ids);
    // Images added since this list loaded join the top (not while searching: the server matched the words).
    const added = term
      ? []
      : images.filter((i) => !listed.has(i.id) && page.since && i.createdAt > page.since && matches(i));
    const loaded = page.ids.flatMap((id) => {
      const image = byId.get(id);
      return image && (matches(image) || image.id === selectedId) ? [image] : [];
    });
    return [...added, ...loaded];
  }, [similar, byId, page, images, term, matches, selectedId]);

  // Keep showing the open image even if an edit moves it out of the filter.
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const plain = status === "approved" && !medium && !board && !term && !onlyCheck;
  const countLabel = plain ? `${counts.approved} images` : `${visible.length}${page.next ? "+" : ""} images`;

  // Load the next page when the end of the grid comes into view.
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinel.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      root: scroller.current,
      rootMargin: "600px",
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore]);

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
        if (index >= visible.length - 6) loadMore();
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        const prev = visible[index - 1];
        if (prev) setSelectedId(prev.id);
      } else if (hotkeyIndex(event.key) >= 0 && hotkeyIndex(event.key) < dimensions.length) {
        setFocusDim(hotkeyIndex(event.key));
      } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && dimensions[focusDim]) {
        event.preventDefault();
        const dim = dimensions[focusDim].key;
        const now = selected.scores[dim]?.score ?? 0;
        setScore(selected, dim, now + (event.key === "ArrowRight" ? 0.5 : -0.5));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const select = "min-w-0 flex-1 basis-36 sm:w-auto sm:max-w-[220px] sm:flex-none";

  return (
    <div className={cn("grid min-h-0 flex-1 grid-cols-1", selected && "lg:grid-cols-[minmax(0,1fr)_440px]")}>
      <section aria-label="Library images" className="flex min-h-0 flex-col">
        {similar ? (
          <SimilarBar
            image={byId.get(similar.id)}
            count={visible.length}
            onClear={() => setSimilar(null)}
          />
        ) : (
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
            <Select id="browse-medium" value={medium} onChange={(e) => setMedium(e.target.value)} size="xs" wrapperClassName={select}>
              <option value="">All media</option>
              {MEDIA.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
            {boards.length ? (
              <>
                <label className="sr-only" htmlFor="browse-board">
                  Board
                </label>
                <Select id="browse-board" value={board} onChange={(e) => setBoard(e.target.value)} size="xs" wrapperClassName={select}>
                  <option value="">All boards</option>
                  {boards.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} ({b.images})
                    </option>
                  ))}
                </Select>
              </>
            ) : null}
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
            {counts.toCheck || onlyCheck ? (
              <button
                type="button"
                aria-pressed={onlyCheck}
                onClick={() => setOnlyCheck((v) => !v)}
                className={cn(
                  "flex h-8 items-center gap-1.5 border px-3 text-sm",
                  onlyCheck ? "border-ink text-ink" : "border-rule-strong text-muted hover:text-ink",
                )}
              >
                <span aria-hidden className="size-1.5 rounded-full bg-signal" />
                To check <span className="font-mono text-xs">{counts.toCheck}</span>
              </button>
            ) : null}
            <Mono className="ml-auto">{countLabel}</Mono>
          </div>
        )}

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
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
          ) : loading ? null : (
            <p className="p-8 text-center text-[15px] text-ink-soft">No images match.</p>
          )}
          <div ref={sentinel} aria-hidden className="h-px" />
          {loading && !visible.length ? (
            <ul aria-label="Loading" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {Array.from({ length: 12 }, (_, i) => (
                <li key={i} aria-hidden className="animate-pulse">
                  <span className="block aspect-[4/5] bg-panel" />
                  <span className="mt-2.5 block h-2.5 w-16 bg-panel" />
                </li>
              ))}
            </ul>
          ) : loading ? (
            <Mono className="block py-6 text-center">Loading more…</Mono>
          ) : null}
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
              {selected.status !== "rejected" ? (
                <Button onClick={() => decide(selected, "rejected")}>Reject</Button>
              ) : null}
              {selected.status !== "pending" ? (
                <Button variant="ghost" onClick={() => decide(selected, "pending")}>
                  Back to review
                </Button>
              ) : null}
              <Button
                variant="ghost"
                disabled={finding}
                onClick={async () => {
                  setFinding(true);
                  const r = await findSimilar(selected.id);
                  if (!r.ok) {
                    setFinding(false);
                    return notify(r.error, { tone: "error" });
                  }
                  // The matches may not have been loaded yet.
                  const missing = r.ids.filter((id) => !byId.has(id));
                  if (missing.length) {
                    const more = await imagesById(missing);
                    if (more.ok) remember(more.images);
                  }
                  setFinding(false);
                  setSimilar({ id: selected.id, ids: r.ids });
                }}
              >
                {finding ? "Finding…" : "More like this"}
              </Button>
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

/** Replaces the filters while showing images similar to one. */
function SimilarBar({
  image,
  count,
  onClear,
}: {
  image?: { thumbUrl: string | null; description: string | null };
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-2 sm:px-6">
      {image?.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.thumbUrl} alt="" className="size-8 object-cover" />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm">
        Most like <span className="text-muted">{image?.description ?? "this image"}</span>
      </span>
      <Mono>{count} images · closest first</Mono>
      <Button size="sm" onClick={onClear}>
        Back to all
      </Button>
    </div>
  );
}
