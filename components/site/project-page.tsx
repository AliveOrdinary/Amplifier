import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/portfolio";
import { ProjectBlocks } from "@/components/portfolio/blocks";
import { Media } from "@/components/portfolio/media";
import { PreviewBanner } from "@/components/portfolio/preview-banner";
import { LanguageSwitch } from "@/components/site/language-switch";
import { Mono, Wordmark } from "@/components/ui/primitives";
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
 * Reference case-study page, built on the portfolio engine, in either
 * language: French where it's been written in Studio, English elsewhere.
 * Plain on purpose: the site design replaces the look, the data calls stay.
 */
export async function ProjectPage({ slug, locale }: { slug: string; locale: Locale }) {
  const t = SITE_COPY[locale];
  const project = await getProject(slug, locale);
  if (!project) notFound();
  const href = (s: string) => localePath(locale, `/projects/${s}`);

  return (
    <>
      {project.preview ? <PreviewBanner project={project} french={locale === "fr"} /> : null}
      <main lang={locale} className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 sm:px-10">
        <header className="flex h-16 items-center justify-between gap-6">
          <Link href={localePath(locale, "/")} aria-label={t.homeLabel}>
            <Wordmark className="text-2xl" />
          </Link>
          <div className="flex items-center gap-6">
            <Link href={localePath(locale, "/projects")} className="text-[15px] hover:text-muted">
              {t.project.works}
            </Link>
            <LanguageSwitch locale={locale} paths={alternates(`/projects/${project.slug}`)} />
          </div>
        </header>

        <div className="border-b border-ink pt-10 pb-6">
          <Mono className="flex flex-wrap gap-x-4">
            {project.client ? <span>{project.client}</span> : null}
            {project.year ? <span>{project.year}</span> : null}
          </Mono>
          <h1 className="mt-3 text-display font-medium">{project.title}</h1>
          {project.summary ? <p className="mt-5 max-w-[62ch] text-[19px] leading-relaxed text-ink-soft">{project.summary}</p> : null}
          {project.services.length ? (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1">
              {project.services.map((s) => (
                <li key={s}>
                  <Mono>{s}</Mono>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {project.cover ? (
          <div className="mt-10">
            <Media media={project.cover} priority sizes="100vw" />
          </div>
        ) : null}

        <div className="mt-10 sm:mt-16">
          <ProjectBlocks blocks={project.blocks} />
        </div>

        <nav aria-label={t.project.more} className="mt-20 flex justify-between gap-6 border-t border-rule pt-6 text-[15px]">
          {project.previous ? <Link href={href(project.previous.slug)}>← {project.previous.title}</Link> : <span />}
          {project.next ? <Link href={href(project.next.slug)}>{project.next.title} →</Link> : null}
        </nav>
      </main>
    </>
  );
}
