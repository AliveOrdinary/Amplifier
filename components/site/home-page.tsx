import { listProjects, type ProjectCard } from "@/lib/portfolio";
import { Preloader } from "@/components/site/preloader";
import { HOME_COPY } from "@/lib/i18n/home";
import { SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";
import { BriefSeal } from "./brief-seal";
import { ContactCall } from "./contact-call";
import { SiteHeader } from "./site-header";
import { HomeWorks } from "./home-works";

/**
 * The homepage in one language; app/page.tsx (English) and app/fr/page.tsx
 * render it. After studio1030.at: the work full screen, cutting from one
 * picture to the next; the first scroll lifts it away to the closing call.
 * That's the whole page: no footer, it ends on the call.
 */
export async function HomePage({ locale }: { locale: Locale }) {
  const t = HOME_COPY[locale];
  const [featured, all] = await Promise.all([featuredProjects(locale), allProjects(locale)]);
  // Every project's tile and cover, in the studio's order.
  const pictures = all.flatMap((p) => [p.thumbnail, p.cover].filter((m, i, list): m is NonNullable<typeof m> => Boolean(m) && list.findIndex((x) => x?.id === m!.id) === i));

  return (
    <div className="site flex-1" lang={locale}>
      <Preloader />

      <SiteHeader
        locale={locale}
        homeHref={localePath(locale, "/")}
        homeLabel={SITE_COPY[locale].homeLabel}
        links={[
          { id: "work", label: t.nav.work, href: localePath(locale, "/projects") },
          { id: "studio", label: t.nav.studio },
          { id: "contact", label: t.nav.contact, href: "#brief" },
        ]}
        languages={alternates("/")}
        city={t.city}
      />

      <main>
        <HomeWorks pictures={pictures} hint={t.scroll}>
          <section id="contact" className="relative flex h-full flex-col justify-center">
            <h2 className="sr-only">{t.sections.contact}</h2>
            <ContactCall lead={t.contact.lead} tail={t.contact.tail} body={t.contact.body} mixed={t.contact.mixed} projects={featured} />
          </section>
        </HomeWorks>
      </main>

      <BriefSeal label={t.contact.cta} href={localePath(locale, "/start")} />
    </div>
  );
}

/** Every published project (the slideshow); samples stand in locally, as below. */
async function allProjects(locale: Locale): Promise<ProjectCard[]> {
  try {
    return await listProjects({ locale });
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    return SAMPLE;
  }
}

/** Featured projects; with no database during local design work, sample projects stand in. */
async function featuredProjects(locale: Locale): Promise<ProjectCard[]> {
  try {
    return await listProjects({ featured: true, locale });
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    console.warn("Home: portfolio unavailable, showing sample projects.");
    return SAMPLE;
  }
}

const sample = (slug: string, title: string, service: string, year: number, url: string | null): ProjectCard => ({
  id: slug,
  slug,
  title,
  client: null,
  year,
  services: [service],
  summary: null,
  featured: true,
  cover: url ? { id: `${slug}-cover`, kind: "image", url, width: null, height: null, alt: title, caption: null, hasAudio: false } : null,
  thumbnail: null,
  publishedAt: null,
});

const SAMPLE: ProjectCard[] = [
  sample("crums", "Crums", "Packaging", 2025, "/images/uploads/crums/crums-master-.jpg"),
  sample("sanjo-construction", "Sanjo Construction", "Identity", 2025, null),
  sample("teeta", "Teeta", "Naming", 2024, null),
];
