"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickOptions } from "@/lib/library/queries";
import { pickLibrary, type PickedImage } from "./actions";

/**
 * Library images for a picker dialog, a page at a time: the search runs on
 * the server once typing pauses, and "Show more" loads the next page.
 */
export function usePicker(options: Omit<PickOptions, "search" | "offset">) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [state, setState] = useState<{ key: string; images: PickedImage[]; more: boolean; error: string | null }>({
    key: "",
    images: [],
    more: false,
    error: null,
  });
  const [extra, setExtra] = useState(false);
  const request = useRef(0);
  const key = JSON.stringify({ ...options, term });

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(
    (offset: number) => {
      const id = ++request.current;
      return pickLibrary({ ...options, search: term, offset }).then((r) => {
        if (id !== request.current) return;
        setExtra(false);
        setState((s) => ({
          key,
          images: r.ok ? (offset ? [...s.images, ...r.images] : r.images) : s.images,
          more: r.ok ? r.more : false,
          error: r.ok ? null : r.error,
        }));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` covers `options` and `term`
    [key],
  );

  useEffect(() => {
    void fetchPage(0);
  }, [fetchPage]);

  const showMore = useCallback(() => {
    setExtra(true);
    void fetchPage(state.images.length);
  }, [fetchPage, state.images.length]);

  return {
    search,
    setSearch,
    images: state.images,
    more: state.more,
    error: state.error,
    loading: state.key !== key || extra,
    showMore,
  };
}
