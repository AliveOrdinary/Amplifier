import type { Metadata } from "next";
import { HomePage } from "@/components/site/home-page";
import { HOME_COPY } from "@/lib/i18n/home";
import { alternates } from "@/lib/i18n/site";

export const metadata: Metadata = {
  title: { absolute: "Amplifier" },
  description: HOME_COPY.en.meta.description,
  alternates: { canonical: "/", languages: alternates("/") },
};

export default function Home() {
  return <HomePage locale="en" />;
}
