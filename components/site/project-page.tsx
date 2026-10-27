import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/portfolio";
import { ProjectBlocks, sectionsOf } from "@/components/portfolio/blocks";
import { GrowingCover } from "@/components/portfolio/growing-cover";
import { Media } from "@/components/portfolio/media";
import { PreviewBanner } from "@/components/portfolio/preview-banner";
import { COLUMNS, LABEL, PAGE, SiteFooter } from "@/components/site/site-frame";
import { SiteHeader } from "@/components/site/site-header";
import { Wayfinding } from "@/components/site/wayfinding";
import { cn } from "@/components/ui/primitives";
import { HOME_COPY } from "@/lib/i18n/home";
import { LANGUAGE, SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";

/** Title, summary and the language versions of a case study, for <head>. */
export async function projectMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const project = await getProject(slug, locale);
  if (!project) return {};
  const path = `/projects/${slug}`;
  return {
    title: project.title,
    description: project.summary ?? undefined,
    alternates: { canonical: localePath(locale, path), languages: alternates(path) },
    openGraph: {
      locale: LANGUAGE[locale].og,
      ...(project.cover?.kind === "image" ? { images: [project.cover.url] } : {}),
    },
  };
}

/**
 * A case study, in either language (French where it's been written in
 * Studio, English elsewhere), on the homepage's grid: the same header, the
 * same width, labels in the 200px column and everything else starting on
 * the menu's line. Images and video run the full width.
 */
export async function ProjectPage({ slug, locale }: { slug: string; locale: Locale }) {
  const t = SITE_COPY[locale];
  const home = HOME_COPY[locale];
  const project = await getProject(slug, locale);
  if (!project) notFound();
  const href = (s: string) => localePath(locale, `/projects/${s}`);
  const facts = [
    project.client ? { k: t.project.client, v: project.client } : null,
    project.year ? { k: t.project.year, v: String(project.year) } : null,
    project.services.length ? { k: t.project.services, v: project.services.join(", ") } : null,
  ].filter((f): f is { k: string; v: string } => f !== null);

  // The side scale: the opening, each labelled section, then "More projects".
  const more = project.previous || project.next;
  const sections = sectionsOf(project.blocks);
  const scale = [
    { id: "top", label: t.project.label },
    ...sections.map((s) => ({ id: s.id, label: s.label })),
    ...(more ? [{ id: "more", label: t.project.more }] : []),
  ];

  return (
    <div className="site flex-1 overflow-x-clip" lang={locale}>
      <Wayfinding sections={scale} />
      {project.preview ? <PreviewBanner project={project} french={locale === "fr"} /> : null}
      <SiteHeader
        locale={locale}
        homeHref={localePath(locale, "/")}
        homeLabel={t.homeLabel}
        links={[
          { id: "work", label: home.nav.work },
          { id: "studio", label: home.nav.studio },
          { id: "contact", label: home.nav.contact },
        ]}
        linkBase={localePath(locale, "/")}
        languages={alternates(`/projects/${project.slug}`)}
        power={home.power}
      />

      <main className={cn(PAGE, "pt-12")}>
        <header id="top" className={cn(COLUMNS, "scroll-mt-24 pt-20 sm:pt-28")}>
          <div className={cn(LABEL, "pt-3 text-muted")}>00 / {t.project.label}</div>
          <div className="min-w-0">
            <h1 className="text-[clamp(48px,7vw,96px)] leading-[0.92] font-medium tracking-[-0.035em]">{project.title}</h1>
            {project.summary ? <p className="mt-8 max-w-[620px] text-lg leading-relaxed text-ink-soft">{project.summary}</p> : null}
            {facts.length ? (
              <dl className="mt-14 grid gap-x-8 gap-y-5 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-4">
                {facts.map((f) => (
                  <div key={f.k} className={f.k === t.project.services ? "sm:col-span-2" : undefined}>
                    <dt className={cn(LABEL, "text-muted")}>{f.k}</dt>
                    <dd className="mt-1.5 text-[17px]">{f.v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </header>

        {project.cover ? (
          <div className="mt-16 sm:mt-24">
            <GrowingCover>
              <Media media={project.cover} priority sizes="100vw" />
            </GrowingCover>
          </div>
        ) : null}

        <div className="mt-16 sm:mt-24">
          <ProjectBlocks blocks={project.blocks} />
        </div>

        {more ? (
          <nav id="more" aria-label={t.project.more} className={cn(COLUMNS, "mt-32 scroll-mt-24 border-t border-rule pt-5 sm:mt-40")}>
            <div className={cn(LABEL, "mt-8 text-muted lg:mt-10 lg:pt-1")}>
              {String(sections.length + 1).padStart(2, "0")} / {t.project.more}
            </div>
            <div className="mt-4 grid gap-8 sm:grid-cols-2 lg:mt-10">
              {project.previous ? (
                <Link href={href(project.previous.slug)} className="group block">
                  <span className={cn(LABEL, "text-muted")}>← {t.project.previous}</span>
                  <span className="mt-2 block text-[clamp(28px,3.2vw,44px)] leading-none font-medium tracking-[-0.02em] group-hover:text-muted">
                    {project.previous.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {project.next ? (
                <Link href={href(project.next.slug)} className="group block sm:text-right">
                  <span className={cn(LABEL, "text-muted")}>{t.project.next} →</span>
                  <span className="mt-2 block text-[clamp(28px,3.2vw,44px)] leading-none font-medium tracking-[-0.02em] group-hover:text-muted">
                    {project.next.title}
                  </span>
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
