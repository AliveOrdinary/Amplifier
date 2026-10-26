/**
 * Every piece of homepage text, in English and French. Add a language by
 * adding a locale and its copy; the page and the switch pick it up.
 *
 * FRENCH IS A DRAFT: written for review by a fluent speaker before launch.
 * Project names, services and case studies come from Studio › Portfolio
 * and stay as written there for now.
 */

import type { FaderKey } from "@/lib/portfolio/channels";
import type { Locale } from "./site";

export type HomeCopy = {
  meta: { description: string };
  nav: { work: string; studio: string; contact: string };
  power: string;
  sections: { intro: string; selected: string; studio: string; contact: string };
  hero: { title: string; intro: string; facts: { k: string; v: string }[] };
  work: { title: string };
  desk: {
    /** "{n}" is replaced by the number of channels in use. */
    channels: string;
    solo: string;
    none: string;
    /** Shown when no project is marked Featured and published yet. */
    empty: string;
    mix: string;
    reset: string;
    faders: Record<FaderKey, { name: string; left: string; right: string }>;
  };
  studio: { title: string; body: string; roles: Record<"design" | "technology", string> };
  contact: { title: string; body: string };
};

export const HOME_COPY: Record<Locale, HomeCopy> = {
  en: {
    meta: { description: "Amplifier is a design studio: branding, type and motion." },
    nav: { work: "Work", studio: "Studio", contact: "Contact" },
    power: "Power",
    sections: { intro: "Intro", selected: "Selected", studio: "Studio", contact: "Contact" },
    hero: {
      title: "Branding, type and motion for people who make things.",
      intro: "Every project is a channel. Move the faders to your taste, and the work that fits comes up.",
      facts: [
        { k: "Who", v: "Amplifier Studio" },
        { k: "What", v: "Branding, type and motion" },
        { k: "Where", v: "Toronto · Remote" },
        { k: "How", v: "It starts with a visual brief" },
      ],
    },
    work: { title: "Selected work, on the desk." },
    desk: {
      channels: "Channels ✺ {n} in use",
      solo: "Solo",
      none: "none",
      empty: "New work is on the way.",
      mix: "Mix to your taste",
      reset: "Reset",
      faders: {
        density: { name: "Density", left: "Minimal", right: "Rich" },
        volume: { name: "Volume", left: "Quiet", right: "Loud" },
        tone: { name: "Tone", left: "Serious", right: "Playful" },
        form: { name: "Form", left: "Organic", right: "Geometric" },
      },
    },
    studio: {
      title: "Who’s at the desk.",
      body: "We build brands from the name up, for musicians, filmmakers, cafés and anyone with something to say. Every project starts by finding the one idea that holds it all together.",
      roles: { design: "Art direction, design", technology: "Technology" },
    },
    contact: {
      title: "Every project starts with a visual brief.",
      body: "Tell us about yours and we’ll send you one: a few questions and a run of images that show us your taste before we meet.",
    },
  },

  // Draft: to be checked by a fluent speaker.
  fr: {
    meta: { description: "Amplifier est un studio de design : identité visuelle, typographie et animation." },
    nav: { work: "Projets", studio: "Studio", contact: "Contact" },
    power: "Marche",
    sections: { intro: "Intro", selected: "Sélection", studio: "Studio", contact: "Contact" },
    hero: {
      title: "Identité visuelle, typographie et animation pour celles et ceux qui créent.",
      intro: "Chaque projet est une piste. Réglez les curseurs selon vos goûts : les projets qui vous ressemblent remontent.",
      facts: [
        { k: "Qui", v: "Amplifier Studio" },
        { k: "Quoi", v: "Identité, typographie et animation" },
        { k: "Où", v: "Toronto · À distance" },
        { k: "Comment", v: "Tout commence par un brief visuel" },
      ],
    },
    work: { title: "Projets choisis, sur la console." },
    desk: {
      channels: "Pistes ✺ {n} actives",
      solo: "Solo",
      none: "aucun",
      empty: "De nouveaux projets arrivent bientôt.",
      mix: "Mixez selon vos goûts",
      reset: "Remettre à zéro",
      faders: {
        density: { name: "Densité", left: "Minimal", right: "Riche" },
        volume: { name: "Volume", left: "Discret", right: "Éclatant" },
        tone: { name: "Ton", left: "Sérieux", right: "Ludique" },
        form: { name: "Forme", left: "Organique", right: "Géométrique" },
      },
    },
    studio: {
      title: "Qui est à la console.",
      body: "Nous construisons des marques à partir du nom, pour des musiciens, des cinéastes, des cafés et tous ceux qui ont quelque chose à dire. Chaque projet commence par trouver l’idée qui fait tenir l’ensemble.",
      roles: { design: "Direction artistique, design", technology: "Technologie" },
    },
    contact: {
      title: "Chaque projet commence par un brief visuel.",
      body: "Parlez-nous du vôtre et nous vous en enverrons un : quelques questions et une série d’images qui nous montrent vos goûts avant notre rencontre.",
    },
  },
};
