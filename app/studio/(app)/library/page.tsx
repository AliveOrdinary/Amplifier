import type { Metadata } from "next";
import { ReviewScreen } from "./review-screen";

export const metadata: Metadata = { title: "Library — Review" };

// Server actions on this page resize and score images.
export const maxDuration = 120;

export default function LibraryReviewPage() {
  return <ReviewScreen />;
}
