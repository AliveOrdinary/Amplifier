import type { Metadata } from "next";
import { WorksPage } from "@/components/site/works-page";
import { SITE_COPY, alternates } from "@/lib/i18n/site";

export const metadata: Metadata = {
  title: SITE_COPY.fr.works.title,
  alternates: { canonical: "/fr/projects", languages: alternates("/projects") },
  openGraph: { locale: "fr_CA" },
};

export default function WorksFr() {
  return <WorksPage locale="fr" />;
}
