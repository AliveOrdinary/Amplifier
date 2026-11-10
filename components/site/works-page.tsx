import { getProject, listProjects } from "@/lib/portfolio";
import type { ProjectCard } from "@/lib/portfolio/types";
import { MixPanel } from "@/components/portfolio/desk";
import { BriefSeal } from "@/components/site/brief-seal";
import { PAGE, SiteFooter } from "@/components/site/site-frame";
import { SiteHeader } from "@/components/site/site-header";
import { WorkBoard, type BoardPicture } from "@/components/site/work-board";
import { WorkGrid } from "@/components/site/work-grid";
import { cn } from "@/components/ui/primitives";
import { HOME_COPY } from "@/lib/i18n/home";
import { SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";

/** "Packaging · Identity · 2022" */
const meta = (p: ProjectCard) => [...p.services, ...(p.year ? [String(p.year)] : [])].join(" · ");

/**
 * The Work page (nav › Work), in either language: the "Mix to your taste"
 * faders from the old homepage's desk at the top, then every project as a tall
 * cover in a grid across the full width (components/site/work-grid.tsx). Moving a
 * fader turns the grid into a moodboard of the pictures closest to the mix
 * (components/site/work-board.tsx).
 */
export async function WorksPage({ locale }: { locale: Locale }) {
  const t = SITE_COPY[locale];
  const home = HOME_COPY[locale];
  const projects = await listProjects({ locale });
  // Every picture each project shows (its cover, then its pictures in order), for the moodboard.
  const pictures: BoardPicture[] = (await Promise.all(projects.map((p) => getProject(p.slug, locale)))).flatMap((project) => {
    if (!project) return [];
    const seen = new Set<string>();
    const all = [project.cover, ...project.blocks.flatMap((b) => (b.type === "media" ? b.media : []))];
    return all.flatMap((m) => {
      if (!m || seen.has(m.id)) return [];
      seen.add(m.id);
      return [{ key: `${project.slug}-${m.id}`, media: m, slug: project.slug, title: project.title, href: localePath(locale, `/projects/${project.slug}`) }];
    });
  });


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
        {/* The "Mix to your taste" faders from the old homepage's desk, where the desk sat there. */}
        <section className={cn(PAGE, "pt-20 pb-20 sm:pt-28 sm:pb-28")}>
          <h1 className="sr-only">{t.works.title}</h1>
          <MixPanel copy={home.desk} />
        </section>

        <WorkBoard pictures={pictures} projects={projects.length} locale={locale}>
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
        </WorkBoard>
      </main>

      <SiteFooter />
      <BriefSeal label={home.contact.cta} href={localePath(locale, "/start")} />
    </div>
  );
}
