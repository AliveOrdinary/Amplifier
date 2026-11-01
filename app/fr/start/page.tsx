import type { Metadata } from "next";
import { StartPage } from "@/components/site/start-page";
import { START_COPY } from "@/lib/i18n/start";
import { alternates } from "@/lib/i18n/site";

export const metadata: Metadata = {
  title: START_COPY.fr.label,
  alternates: { canonical: "/fr/start", languages: alternates("/start") },
  openGraph: { locale: "fr_CA" },
};

export default function StartFr() {
  return <StartPage locale="fr" />;
}
