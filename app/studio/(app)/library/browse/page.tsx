import type { Metadata } from "next";
import { Suspense } from "react";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { libraryPage } from "@/lib/library/queries";
import { openingFilters } from "@/lib/library/constants";
import { BrowseScreen } from "./browse-screen";

export const metadata: Metadata = { title: "Library — Browse" };

export const maxDuration = 120;

export default function LibraryBrowsePage({ searchParams }: PageProps<"/studio/library/browse">) {
  return (
    <Suspense fallback={<BrowseScreen />}>
      <Browse searchParams={searchParams} />
    </Suspense>
  );
}

/** ?check=1 opens straight to the scores that need checking (linked from the rubric). */
async function Browse({ searchParams }: Pick<PageProps<"/studio/library/browse">, "searchParams">) {
  const { check } = await searchParams;
  const member = await getMember();
  const db = await createClient();
  const opening = check === "1";
  // The first page comes with the screen, so images show without a second round trip.
  const firstPage = await libraryPage(db, member.studioId, openingFilters(opening), null).catch(() => undefined);
  return <BrowseScreen initialCheck={opening} firstPage={firstPage} />;
}
