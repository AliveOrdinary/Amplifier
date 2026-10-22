import type { Metadata } from "next";
import { Suspense } from "react";
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
  return <BrowseScreen initialCheck={check === "1"} />;
}
