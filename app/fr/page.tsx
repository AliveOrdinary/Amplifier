import type { Metadata } from "next";
import { HomePage } from "@/components/site/home-page";
import { HOME_COPY } from "@/lib/i18n/home";
import { alternates } from "@/lib/i18n/site";

export const metadata: Metadata = {
  title: { absolute: "Amplifier" },
  description: HOME_COPY.fr.meta.description,
  alternates: { canonical: "/fr", languages: alternates("/") },
  openGraph: { locale: "fr_CA" },
};

/** The homepage in French. Text lives in lib/i18n/home.ts. */
export default function HomeFr() {
  return <HomePage locale="fr" />;
}
