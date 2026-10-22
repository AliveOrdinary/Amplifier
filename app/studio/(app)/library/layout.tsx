import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { libraryBoards, libraryCounts, reviewQueue, scoringNow } from "@/lib/library/queries";
import { listDimensions } from "@/lib/library/rubric";
import { LibraryProvider } from "./library-provider";
import { Suspense } from "react";
import { LibraryBar, NoticeToast, ShareResult } from "./library-chrome";

/**
 * The library fills the window under the studio header: tabs and adding on
 * top, the active screen below. Only the review queue loads up front; Browse
 * loads pages as you scroll. After that the screens update in place, so
 * nothing jumps or reloads while you review.
 */
export default async function LibraryLayout({ children }: LayoutProps<"/studio/library">) {
  const member = await getMember();
  const db = await createClient();
  const [queue, scoring, counts, boards, dimensions] = await Promise.all([
    reviewQueue(db, member.studioId),
    scoringNow(db, member.studioId),
    libraryCounts(db, member.studioId),
    libraryBoards(db, member.studioId),
    listDimensions(db, member.studioId),
  ]);

  return (
    <LibraryProvider
      initialImages={[...scoring, ...queue]}
      initialCounts={counts}
      boards={boards}
      dimensions={dimensions.map(({ key, left, right, leftDefinition, rightDefinition }) => ({
        key,
        left,
        right,
        leftDefinition,
        rightDefinition,
      }))}
    >
      <div className="flex flex-col lg:h-[calc(100dvh-57px)]">
        <LibraryBar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
      <NoticeToast />
      <Suspense fallback={null}>
        <ShareResult />
      </Suspense>
    </LibraryProvider>
  );
}
