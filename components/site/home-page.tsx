import type { ReactNode } from "react";
import { listProjects, type ProjectCard } from "@/lib/portfolio";
import { Desk } from "@/components/portfolio/desk";
import { Preloader } from "@/components/site/preloader";
import { Wayfinding } from "@/components/site/wayfinding";
import { cn } from "@/components/ui/primitives";
import { HOME_COPY } from "@/lib/i18n/home";
import { SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";
import { ContactCall } from "./contact-call";
import { SiteHeader } from "./site-header";
import { COLUMNS, PAGE, SiteFooter } from "./site-frame";

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

      <main className={cn(PAGE, "pt-12")}>
        <Section n="00" name="MMXXVI" id="top" first>
          <h1 className="max-w-[900px] text-[clamp(44px,5.6vw,80px)] leading-[1.05] font-normal tracking-[-0.02em]">{t.hero.title}</h1>
          <p className="mt-8 max-w-[740px] text-[19px] leading-[1.65] text-ink-soft">{t.hero.intro}</p>
          <dl className="mt-14 grid gap-x-8 gap-y-5 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.hero.facts.map((f) => (
              <div key={f.k}>
                <dt className={cn(label, "text-muted")}>{f.k}</dt>
                <dd className="mt-1.5 text-[15px] leading-[1.5]">{f.v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section n="01" name={t.sections.selected} id="work" title={t.work.title} wide={<Desk projects={projects} copy={t.desk} />} />

        {/* Laid out like the opening: a big heading, a short paragraph, then a row of labels. */}
        <Section n="02" name={t.sections.studio} id="studio">
          <h2 className="max-w-[760px] text-[clamp(34px,3.9vw,56px)] leading-[1.15] font-normal tracking-[-0.01em]">{t.studio.title}</h2>
          <p className="mt-8 max-w-[740px] text-[19px] leading-[1.65] text-ink-soft">{t.studio.body}</p>
          <dl className="mt-14 grid gap-x-8 gap-y-5 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((p) => (
              <div key={p.name}>
                <dt className={cn(label, "text-muted")}>{t.studio.roles[p.role]}</dt>
                <dd className="mt-1.5 text-[15px] leading-[1.5]">{p.name}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          n="03"
          name={t.sections.contact}
          id="contact"
          wide={
            <ContactCall
              {...t.contact}
              href={STUDIO_EMAIL.startsWith("[") ? "#contact" : `mailto:${STUDIO_EMAIL}`}
              projects={projects}
            />
          }
        />
      </main>

      <SiteFooter />
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
    <section id={id} className={cn(COLUMNS, "scroll-mt-24", first ? "pt-20 sm:pt-28" : "pt-32 sm:pt-40")}>
      <div className={cn(label, "pt-3 text-muted")}>
        {n} / {name}
      </div>
      <div className="min-w-0">
        {title ? (
          <h2 className="mb-12 max-w-[760px] text-[clamp(34px,3.9vw,56px)] leading-[1.15] font-normal tracking-[-0.01em]">{title}</h2>
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
