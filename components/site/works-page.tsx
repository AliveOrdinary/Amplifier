import { listProjects } from "@/lib/portfolio";
import type { ProjectCard } from "@/lib/portfolio/types";
import { Desk } from "@/components/portfolio/desk";
import { BriefSeal } from "@/components/site/brief-seal";
import { COLUMNS, LABEL, PAGE, SiteFooter } from "@/components/site/site-frame";
import { SiteHeader } from "@/components/site/site-header";
import { WorkGrid } from "@/components/site/work-grid";
import { cn } from "@/components/ui/primitives";
import { HOME_COPY } from "@/lib/i18n/home";
import { SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";

/** "Packaging · Identity · 2022" */
const meta = (p: ProjectCard) => [...p.services, ...(p.year ? [String(p.year)] : [])].join(" · ");

/**
 * The Work page (nav › Work), in either language: the desk from the old
 * homepage at the top, where it sat there, then every project as a tall
 * cover in a grid across the full width (components/site/work-grid.tsx).
 */
export async function WorksPage({ locale }: { locale: Locale }) {
  const t = SITE_COPY[locale];
  const home = HOME_COPY[locale];
  const projects = await listProjects({ locale });

  // The desk holds the featured work, as it did on the homepage.
  const featured = projects.some((p) => p.featured) ? projects.filter((p) => p.featured) : projects;

  return (
    <div className="site flex-1" lang={locale}>
      <SiteHeader
        locale={locale}
        homeHref={localePath(locale, "/")}
        homeLabel={t.homeLabel}
        links={[
          { id: "work", label: home.nav.work, href: localePath(locale, "/projects") },
          { id: "studio", label: home.nav.studio },
          { id: "contact", label: home.nav.contact, href: `${localePath(locale, "/")}#brief` },
        ]}
        linkBase={localePath(locale, "/")}
        languages={alternates("/projects")}
        city={home.city}
        current="work"
      />

      <main className="pt-12 pb-36">
        {/* The desk from the old homepage, laid out as it was there: "01 / Selected" in the
            label column, the title beside it, the desk across the full width under them. */}
        <section className={cn(PAGE, COLUMNS, "pt-20 pb-20 sm:pt-28 sm:pb-28")}>
          <div className={cn(LABEL, "pt-3 text-muted")}>01 / {home.sections.selected}</div>
          <div className="min-w-0">
            <h1 className="mb-12 max-w-[760px] text-[clamp(34px,3.9vw,56px)] leading-[1.15] font-normal tracking-[-0.01em]">{home.work.title}</h1>
          </div>
          <div className="min-w-0 lg:col-span-2">
            <Desk projects={featured} copy={home.desk} />
          </div>
        </section>

        <WorkGrid
          empty={t.works.empty}
          items={projects.map((p) => ({
            key: p.id,
            href: localePath(locale, `/projects/${p.slug}`),
            title: p.title,
            meta: meta(p),
            media: p.thumbnail ?? p.cover,
          }))}
        />
      </main>

      <SiteFooter />
      <BriefSeal label={home.contact.cta} href={localePath(locale, "/start")} />
    </div>
  );
}
