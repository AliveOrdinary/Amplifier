import { listProjects } from "@/lib/portfolio";
import type { ProjectCard } from "@/lib/portfolio/types";
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
 * The Work page (nav › Work), in either language, after brand-nw.com/work:
 * one big line that opens with a grey "Work.", then every project as a tall
 * cover in a grid (components/site/work-grid.tsx).
 */
export async function WorksPage({ locale }: { locale: Locale }) {
  const t = SITE_COPY[locale];
  const home = HOME_COPY[locale];
  const projects = await listProjects({ locale });

  const years = projects.map((p) => p.year).filter((y): y is number => Boolean(y));
  const [from, to] = [Math.min(...years), Math.max(...years)];
  const span = !years.length ? null : from === to ? String(from) : `${from}–${String(to).slice(-2)}`;
  const count = [t.works.count(projects.length), span].filter(Boolean).join(" · ");

  return (
    <div className="site flex-1" lang={locale}>
      <SiteHeader
        locale={locale}
        homeHref={localePath(locale, "/")}
        homeLabel={t.homeLabel}
        links={[
          { id: "work", label: home.nav.work, href: localePath(locale, "/projects") },
          { id: "studio", label: home.nav.studio },
          { id: "contact", label: home.nav.contact },
        ]}
        linkBase={localePath(locale, "/")}
        languages={alternates("/projects")}
        power={home.power}
        current="work"
      />

      <main className={cn(PAGE, "pt-12 pb-36")}>
        <section className={cn(COLUMNS, "pt-28 pb-20 sm:pt-40 sm:pb-28")}>
          <div className={cn(LABEL, "pt-3 text-muted")}>{count}</div>
          <h1 className="max-w-[920px] text-[clamp(34px,4.4vw,64px)] leading-[1.12] font-normal tracking-[-0.025em]">
            <span className="text-muted">{t.works.title}.</span> {home.hero.title}
          </h1>
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
      <BriefSeal label={home.contact.cta} href={`${localePath(locale, "/")}#contact`} />
    </div>
  );
}
