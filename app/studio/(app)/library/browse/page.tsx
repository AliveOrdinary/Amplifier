import type { Metadata } from "next";
import { BrowseScreen } from "./browse-screen";

export const metadata: Metadata = { title: "Library — Browse" };

export const maxDuration = 120;

export default function LibraryBrowsePage() {
  return <BrowseScreen />;
}
