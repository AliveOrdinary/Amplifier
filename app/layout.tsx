import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const montreal = localFont({
  src: [
    { path: "./fonts/PPNeueMontreal-Book.woff2", weight: "400", style: "normal" },
    { path: "./fonts/PPNeueMontreal-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/PPNeueMontreal-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-montreal",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Amplifier", template: "%s — Amplifier" },
  description: "Amplifier is a design studio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${montreal.variable} ${GeistMono.variable} ${GeistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
