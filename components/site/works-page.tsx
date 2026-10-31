import { listProjects } from "@/lib/portfolio";
import type { PortfolioMedia, ProjectCard } from "@/lib/portfolio/types";
import { SiteFooter } from "@/components/site/site-frame";
import { BriefSeal } from "@/components/site/brief-seal";
import { SiteHeader } from "@/components/site/site-header";
import { WorkCanvas, type WorkTile, type WorkRow } from "@/components/site/work-canvas";
import { HOME_COPY } from "@/lib/i18n/home";
import { SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";

/** The image a project shows first: its tile, else its cover. */
const lead = (p: ProjectCard): PortfolioMedia | null => p.thumbnail ?? p.cover;

/** "Packaging · Identity · 2022" */
const meta = (p: ProjectCard) => [...p.services, ...(p.year ? [String(p.year)] : [])].join(" · ");

/**
 * The Work page (nav › Work), in either language. Two views of the same
 * projects: a canvas you scroll or drag in any direction, the covers
 * floating around a big "Work" and wrapping round without end (after
 * mobius.framer.website/work), and a plain numbered index. Phones get the
 * index, with pictures.
 */
export async function WorksPage({ locale }: { locale: Locale }) {
  const t = SITE_COPY[locale];
  const home = HOME_COPY[locale];
  const projects = await listProjects({ locale, gallery: true });
  const href = (slug: string) => localePath(locale, `/projects/${slug}`);

  // Every project's pictures, first the lead image, then up to three more.
  const pictures = projects.map((p) => {
    const first = lead(p);
    return [...(first ? [first] : []), ...(p.gallery ?? [])].map(
      (media): WorkTile => ({ key: `${p.id}-${media.id}`, href: href(p.slug), title: p.title, meta: meta(p), media }),
    );
  });
  // Dealt round-robin, so one project's images don't bunch together.
  const tiles: WorkTile[] = [];
  for (let round = 0; pictures.some((list) => list[round]); round++) {
    for (const list of pictures) if (list[round]) tiles.push(list[round]);
  }

  const rows: WorkRow[] = projects.map((p, i) => ({
    key: p.id,
    number: String(i + 1).padStart(2, "0"),
    href: href(p.slug),
    title: p.title,
    meta: meta(p),
    media: lead(p),
  }));

  const years = projects.map((p) => p.year).filter((y): y is number => Boolean(y));
  const [from, to] = [Math.min(...years), Math.max(...years)];
  const span = !years.length ? null : from === to ? String(from) : `${from}–${String(to).slice(-2)}`;

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
      <WorkCanvas
        tiles={tiles}
        rows={rows}
        copy={{
          title: t.works.title,
          intro: home.hero.title,
          hint: t.works.hint,
          canvas: t.works.canvas,
          index: t.works.index,
          views: t.works.views,
          empty: t.works.empty,
          count: [t.works.count(projects.length), span].filter(Boolean).join(" · "),
        }}
        footer={<SiteFooter />}
      />
      <BriefSeal label={home.contact.cta} href={`${localePath(locale, "/")}#contact`} />
    </div>
  );
}
