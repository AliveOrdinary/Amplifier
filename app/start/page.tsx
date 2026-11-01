import type { Metadata } from "next";
import { StartPage } from "@/components/site/start-page";
import { START_COPY } from "@/lib/i18n/start";
import { alternates } from "@/lib/i18n/site";

export const metadata: Metadata = {
  title: START_COPY.en.label,
  alternates: { canonical: "/start", languages: alternates("/start") },
};

export default function Start() {
  return <StartPage locale="en" />;
}
