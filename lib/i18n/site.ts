/**
 * The public site's languages, addresses and the text shared by every page.
 * Page-specific text: ./home.ts (homepage). Project content comes from
 * Studio › Portfolio, in French where it has been written.
 *
 * FRENCH IS A DRAFT: to be checked by a fluent speaker before launch.
 */

import type { Locale } from "@/lib/portfolio/types";

export type { Locale };

export const LOCALES: readonly Locale[] = ["en", "fr"];

/** "/projects/crums" in a language: unchanged for English, under /fr for French. */
export function localePath(locale: Locale, path: string) {
  if (locale === "en") return path;
  return path === "/" ? "/fr" : `/fr${path}`;
}

/** The same page in every language, for the switch and for search engines (hreflang). */
export function alternates(path: string) {
  return Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])) as Record<Locale, string>;
}

export const LANGUAGE: Record<Locale, { name: string; label: string; og: string }> = {
  en: { name: "English", label: "Language", og: "en_CA" },
  fr: { name: "Français", label: "Langue", og: "fr_CA" },
};

export type SiteCopy = {
  homeLabel: string;
  works: { title: string; count: (n: number) => string; empty: string };
  project: { works: string; more: string };
};

export const SITE_COPY: Record<Locale, SiteCopy> = {
  en: {
    homeLabel: "Amplifier, home",
    works: { title: "Works", count: (n) => `${n} ${n === 1 ? "project" : "projects"}`, empty: "No published projects yet." },
    project: { works: "Works", more: "More projects" },
  },
  // Draft: to be checked by a fluent speaker.
  fr: {
    homeLabel: "Amplifier, accueil",
    works: { title: "Projets", count: (n) => `${n} projet${n > 1 ? "s" : ""}`, empty: "Aucun projet publié pour l’instant." },
    project: { works: "Projets", more: "Autres projets" },
  },
};
