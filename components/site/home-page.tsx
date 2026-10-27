import type { ReactNode } from "react";
import { listProjects, type ProjectCard } from "@/lib/portfolio";
import { Desk } from "@/components/portfolio/desk";
import { GREETINGS } from "@/components/site/greetings";
import { Preloader } from "@/components/site/preloader";
import { Wayfinding } from "@/components/site/wayfinding";
import { cn } from "@/components/ui/primitives";
import { HOME_COPY } from "@/lib/i18n/home";
import { SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";
import { SiteHeader } from "./site-header";

const label = "font-mono text-[12px] uppercase tracking-[0.08em]";

const TEAM = [
  { name: "Eldhose Kuriyan", role: "design" },
  { name: "Francis Xavier", role: "design" },
  { name: "Navaneeth Krishnan", role: "technology" },
] as const;

// TODO: the studio's email address.
const STUDIO_EMAIL = "[studio email]";

/** The homepage in one language; app/page.tsx (English) and app/fr/page.tsx render it. */
export async function HomePage({ locale }: { locale: Locale }) {
  const t = HOME_COPY[locale];
  const projects = await featuredProjects(locale);
  const sections = [
    { id: "top", label: t.sections.intro },
    { id: "work", label: t.sections.selected },
    { id: "studio", label: t.sections.studio },
    { id: "contact", label: t.sections.contact },
  ];

  return (
    <div className="site flex-1" lang={locale}>
      <Preloader />
      <Wayfinding sections={sections} />

      <SiteHeader
        locale={locale}
        homeHref={localePath(locale, "/")}
        homeLabel={SITE_COPY[locale].homeLabel}
        links={[
          { id: "work", label: t.nav.work },
          { id: "studio", label: t.nav.studio },
          { id: "contact", label: t.nav.contact },
        ]}
        languages={alternates("/")}
        power={t.power}
      />

      <main className="mx-auto w-full pt-12 max-w-[1360px] xl:max-w-[min(1360px,calc(100vw-320px))] px-4 sm:px-10">
        <Section n="00" name="MMXXVI" id="top" first>
          <h1 className="text-[clamp(48px,7vw,96px)] leading-[0.92] font-medium tracking-[-0.035em]">{t.hero.title}</h1>
          <p className="mt-8 max-w-[520px] text-lg leading-relaxed text-ink-soft">{t.hero.intro}</p>
          <dl className="mt-14 grid gap-x-8 gap-y-5 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.hero.facts.map((f) => (
              <div key={f.k}>
                <dt className={cn(label, "text-muted")}>{f.k}</dt>
                <dd className="mt-1.5 text-[17px]">{f.v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section n="01" name={t.sections.selected} id="work" title={t.work.title} wide={<Desk projects={projects} copy={t.desk} />} />

        {/* Laid out like the opening: a big heading, a short paragraph, then a row of labels. */}
        <Section n="02" name={t.sections.studio} id="studio">
          <h2 className="text-[clamp(48px,7vw,96px)] leading-[0.92] font-medium tracking-[-0.035em]">{t.studio.title}</h2>
          <p className="mt-8 max-w-[620px] text-lg leading-relaxed text-ink-soft">{t.studio.body}</p>
          <dl className="mt-14 grid gap-x-8 gap-y-5 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((p) => (
              <div key={p.name}>
                <dt className={cn(label, "text-muted")}>{t.studio.roles[p.role]}</dt>
                <dd className="mt-1.5 text-[17px]">{p.name}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section n="03" name={t.sections.contact} id="contact" title={t.contact.title}>
          <p className="max-w-[620px] text-lg leading-relaxed text-ink-soft">{t.contact.body}</p>
          <a
            href={STUDIO_EMAIL.startsWith("[") ? "#contact" : `mailto:${STUDIO_EMAIL}`}
            className="mt-10 inline-flex items-center gap-4 rounded-full border border-rule-strong py-3 pr-3 pl-7 text-[clamp(20px,2.4vw,30px)] tracking-[-0.01em] transition-colors hover:border-signal"
          >
            {STUDIO_EMAIL}
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-ink text-lg text-paper">↗</span>
          </a>
        </Section>
      </main>

      <footer className="mx-auto mt-24 w-full max-w-[1360px] xl:max-w-[min(1360px,calc(100vw-320px))] px-4 sm:px-10">
        <div className={cn(label, "flex flex-wrap justify-between gap-4 border-t border-rule pt-6 pb-10 normal-case text-muted")}>
          <span className="flex flex-wrap gap-x-3">
            {GREETINGS.map((g) => (
              <span key={g}>{g}</span>
            ))}
          </span>
          <span className="uppercase">© MMXXVI Amplifier</span>
        </div>
      </footer>
    </div>
  );
}

/** A numbered section: "01 / Selected" on the left, the title and content on the right (stacked on phones). */
function Section({
  n,
  name,
  id,
  title,
  first,
  wide,
  children,
}: {
  n: string;
  name: string;
  id: string;
  title?: string;
  first?: boolean;
  /** Content that runs the full width of the page, under the title. */
  wide?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={id} className={cn("grid scroll-mt-24 gap-x-10 gap-y-6 lg:grid-cols-[200px_1fr]", first ? "pt-20 sm:pt-28" : "pt-32 sm:pt-40")}>
      <div className={cn(label, "pt-3 text-muted")}>
        {n} / {name}
      </div>
      <div className="min-w-0">
        {title ? (
          <h2 className="mb-12 max-w-[900px] text-[clamp(40px,5.6vw,80px)] leading-[0.95] font-medium tracking-[-0.03em]">{title}</h2>
        ) : null}
        {children}
      </div>
      {wide ? <div className="min-w-0 lg:col-span-2">{wide}</div> : null}
    </section>
  );
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
