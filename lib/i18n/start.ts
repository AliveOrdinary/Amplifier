/**
 * The "Start a brief" page (/start, /fr/start). French is a draft, to be
 * checked by a fluent speaker, like the rest of the site's French.
 */
import type { Locale } from "@/lib/i18n/site";

export type StartCopy = {
  title: string;
  label: string;
  intro: string;
  name: string;
  email: string;
  emailHint: string;
  type: string;
  typeHint: string;
  choose: string;
  submit: string;
  starting: string;
  privacy: string;
  /** French names for the project types; English ones come from the studio's templates. */
  types?: Record<string, string>;
  errors: Record<"name" | "email" | "projectType" | "invalid" | "too-fast" | "stale" | "visitor-limit" | "email-open" | "site-limit" | "unavailable", string>;
};

export const START_COPY: Record<Locale, StartCopy> = {
  en: {
    title: "Start a brief.",
    label: "Start a brief",
    intro:
      "A few questions and a run of images, about 8 minutes. It shows us what you're drawn to, so our first conversation starts from your taste, not a blank page. There are no right or wrong answers.",
    name: "Your name",
    email: "Email",
    emailHint: "So we can get back to you. Nothing else.",
    type: "What are you making?",
    typeHint: "Picks the questions you'll see.",
    choose: "Choose…",
    submit: "Start my brief",
    starting: "Starting…",
    privacy: "Only the Amplifier studio sees your answers. Your brief has its own link: keep it open, or bookmark it to come back later.",
    errors: {
      name: "Add your name.",
      email: "That email doesn't look right.",
      projectType: "Choose what you're making.",
      invalid: "Check the form and try again.",
      "too-fast": "That was quick. Give it a second and try again.",
      stale: "This page has been open a while. Reload it and try again.",
      "visitor-limit": "You've already started two briefs today. Carry on with one of those, or come back tomorrow.",
      "email-open": "There's already an open brief for this email. Carry on with it from the link you got when you started it.",
      "site-limit": "We've had a lot of briefs today. Please try again tomorrow.",
      unavailable: "Something went wrong on our side. Please try again in a minute.",
    },
  },
  fr: {
    title: "Commencer un brief.",
    label: "Commencer un brief",
    intro:
      "Quelques questions et une série d’images, environ 8 minutes. Cela nous montre ce qui vous attire, pour que notre première conversation parte de vos goûts, pas d’une page blanche. Il n’y a pas de bonne ou de mauvaise réponse.",
    name: "Votre nom",
    email: "Courriel",
    emailHint: "Pour vous répondre. Rien d’autre.",
    type: "Que créez-vous ?",
    typeHint: "Détermine les questions posées.",
    choose: "Choisir…",
    submit: "Commencer mon brief",
    starting: "Un instant…",
    privacy:
      "Seul le studio Amplifier voit vos réponses. Votre brief a son propre lien : gardez-le ouvert, ou ajoutez-le à vos favoris pour y revenir. Le brief lui-même est en anglais.",
    types: {
      brand_identity: "Identité de marque (nouvelle)",
      rebrand: "Refonte d’identité",
      website: "Site web",
      packaging_product: "Emballage ou produit",
      space_signage: "Espace, signalétique et orientation",
      campaign_print: "Campagne, affiche ou imprimé",
      creative_release: "Sortie musicale, film ou art",
      event_festival: "Événement",
    },
    errors: {
      name: "Indiquez votre nom.",
      email: "Ce courriel ne semble pas valide.",
      projectType: "Choisissez ce que vous créez.",
      invalid: "Vérifiez le formulaire et réessayez.",
      "too-fast": "C’était rapide. Attendez une seconde et réessayez.",
      stale: "Cette page est ouverte depuis un moment. Rechargez-la et réessayez.",
      "visitor-limit": "Vous avez déjà commencé deux briefs aujourd’hui. Poursuivez l’un d’eux, ou revenez demain.",
      "email-open": "Un brief est déjà ouvert pour ce courriel. Poursuivez-le avec le lien reçu au départ.",
      "site-limit": "Nous avons reçu beaucoup de briefs aujourd’hui. Veuillez réessayer demain.",
      unavailable: "Un problème est survenu de notre côté. Veuillez réessayer dans une minute.",
    },
  },
};
