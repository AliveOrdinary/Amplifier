import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import "./globals.css";

// The studio's own typeface (built from Instrument Sans, OFL; see app/fonts/AmplifierGrotesk-OFL.txt).
// Used by the public site only (.site in globals.css); the Studio app stays on Geist.
const grotesk = localFont({
  src: [
    { path: "./fonts/AmplifierGrotesk-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/AmplifierGrotesk-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/AmplifierGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/AmplifierGrotesk-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-grotesk",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Amplifier", template: "%s — Amplifier" },
  description: "Amplifier is a design studio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${grotesk.variable} ${GeistMono.variable} ${GeistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
