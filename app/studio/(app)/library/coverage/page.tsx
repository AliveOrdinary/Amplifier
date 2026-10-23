import type { Metadata } from "next";
import { Suspense } from "react";
import { CoverageSkeleton } from "../../skeletons";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { libraryCoverage } from "@/lib/library/queries";
import { CoverageScreen } from "./coverage-screen";

export const metadata: Metadata = { title: "Library — Coverage" };

export const maxDuration = 120;

export default function LibraryCoveragePage() {
  return (
    <Suspense fallback={<CoverageSkeleton />}>
      <Coverage />
    </Suspense>
  );
}

/** Counted in the database, so it stays quick however large the library gets. */
async function Coverage() {
  const member = await getMember();
  const db = await createClient();
  return <CoverageScreen coverage={await libraryCoverage(db, member.studioId)} />;
}
