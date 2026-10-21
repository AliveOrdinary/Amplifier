import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listImages } from "@/lib/library/queries";
import { LibraryProvider } from "./library-provider";
import { Suspense } from "react";
import { LibraryBar, NoticeToast, ShareResult } from "./library-chrome";

/**
 * The library fills the window under the studio header: tabs and adding on
 * top, the active screen below. Data loads once; after that the screens
 * update in place, so nothing jumps or reloads while you review.
 */
export default async function LibraryLayout({ children }: LayoutProps<"/studio/library">) {
  const member = await getMember();
  const images = await listImages(await createClient(), member.studioId);

  return (
    <LibraryProvider initialImages={images}>
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
