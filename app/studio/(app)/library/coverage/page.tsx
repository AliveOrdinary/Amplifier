import type { Metadata } from "next";
import { CoverageScreen } from "./coverage-screen";

export const metadata: Metadata = { title: "Library — Coverage" };

export const maxDuration = 120;

export default function LibraryCoveragePage() {
  return <CoverageScreen />;
}
