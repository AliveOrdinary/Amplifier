import type { Metadata } from "next";
import { WorksPage } from "@/components/site/works-page";
import { SITE_COPY, alternates } from "@/lib/i18n/site";

export const metadata: Metadata = {
  title: SITE_COPY.en.works.title,
  alternates: { canonical: "/projects", languages: alternates("/projects") },
};

export default function Works() {
  return <WorksPage locale="en" />;
}
