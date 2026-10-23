"use client";

import { usePathname } from "next/navigation";

/**
 * What shows the moment a studio link is clicked, until the page arrives:
 * the outline of the page being opened, so the click visibly landed.
 */

const bar = "bg-panel";

export function RouteSkeleton() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/studio/library")) return <LibrarySkeleton withBar />;
  if (pathname.startsWith("/studio/settings")) return <PageSkeleton tabs sections={3} />;
  if (/^\/studio\/briefs\/[^/]+\/prep/.test(pathname)) return <PageSkeleton sections={3} />;
  if (/^\/studio\/briefs\/(?!new)[^/]+/.test(pathname)) return <PageSkeleton sections={2} />;
  if (pathname === "/studio/briefs/new") return <PageSkeleton form />;
  return <PageSkeleton list />;
}

export function PageSkeleton({
  tabs,
  sections = 0,
  list,
  form,
}: {
  tabs?: boolean;
  sections?: number;
  list?: boolean;
  form?: boolean;
}) {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-24 sm:px-10">
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="animate-pulse">
        <div className="border-b border-rule-strong pb-5">
          <div className={`h-3 w-32 ${bar}`} />
          <div className={`mt-4 h-10 w-64 max-w-full ${bar}`} />
        </div>
        {tabs ? (
          <div className="mt-4 flex gap-1">
            <div className={`h-8 w-20 ${bar}`} />
            <div className={`h-8 w-20 ${bar}`} />
          </div>
        ) : null}
        {sections ? <SectionsSkeletonInner count={sections} /> : null}
        {list ? (
          <div className="mt-8 border-t border-rule">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-6 border-b border-rule py-5">
                <div className={`h-4 w-48 max-w-[50%] ${bar}`} />
                <div className={`ml-auto h-3 w-24 ${bar}`} />
              </div>
            ))}
          </div>
        ) : null}
        {form ? (
          <div className="mt-8 flex max-w-xl flex-col gap-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className={`h-3 w-24 ${bar}`} />
                <div className={`h-11 w-full ${bar}`} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Numbered sections, for under a header that's already showing (Settings). */
export function SectionsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <SectionsSkeletonInner count={count} />
    </div>
  );
}

function SectionsSkeletonInner({ count }: { count: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-wrap gap-6 border-b border-rule py-10 last:border-b-0">
          <div className="max-w-[260px] flex-[1_1_200px]">
            <div className={`h-3 w-6 ${bar}`} />
            <div className={`mt-3 h-5 w-36 ${bar}`} />
            <div className={`mt-3 h-3 w-full ${bar}`} />
          </div>
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
            <div className={`h-11 w-full ${bar}`} />
            <div className={`h-11 w-3/4 ${bar}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A grid of image tiles; with the library's tab bar when that isn't showing yet. */
export function LibrarySkeleton({ withBar }: { withBar?: boolean }) {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col">
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="flex flex-1 animate-pulse flex-col">
        {withBar ? (
          <div className="flex gap-1 border-b border-rule px-4 py-2.5 sm:px-6">
            {[20, 20, 24].map((w, i) => (
              <div key={i} className={`h-8 ${bar}`} style={{ width: `${w * 4}px` }} />
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-6 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={`aspect-[4/5] ${bar}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
