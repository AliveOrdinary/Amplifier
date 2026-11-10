import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, listProjects } from "@/lib/portfolio";
import type { Block, PortfolioMedia } from "@/lib/portfolio/types";
import { Media } from "@/components/portfolio/media";
import { PreviewBanner } from "@/components/portfolio/preview-banner";
import { SiteFooter } from "@/components/site/site-frame";
import { BriefSeal } from "@/components/site/brief-seal";
import { CaseMotion } from "@/components/site/case-motion";
import { CaseStory, type StorySection } from "@/components/site/case-story";
import { SiteHeader } from "@/components/site/site-header";
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

/** A picture's proportions (width over height); 4:3 until the file's size is known. */
const ratioOf = (m: PortfolioMedia) => (m.width && m.height ? m.width / m.height : 4 / 3);

type Row = { id: string; media: PortfolioMedia[]; scroll: boolean; join: boolean; marker: string | null };

/**
 * Splits the blocks the way the page shows them: labelled text opens a
 * section in the left column (unlabelled text joins the section it
 * follows), and every picture block becomes a row of tiles on the right.
 * The first row after a section's text carries that section's marker.
 */
function arrange(blocks: Block[], opening: string) {
  const sections: StorySection[] = [];
  const rows: Row[] = [];
  let pending: string | null = null;
  for (const b of blocks) {
    if (b.type === "text") {
      if (b.label || !sections.length) {
        const id = `s-${b.id}`;
        sections.push({ id, label: b.label ?? opening, text: b.text });
        pending = id;
      } else {
        sections[sections.length - 1].text += `\n\n${b.text}`;
      }
    } else if (b.media.length) {
      rows.push({ id: b.id, media: b.media, scroll: b.scroll, join: b.join, marker: pending });
      pending = null;
    }
  }
  // A single picture marked `join` sticks to the row above it; joined rows are drawn as one piece.
  const stacks: Row[][] = [];
  for (const row of rows) {
    if (row.join && row.media.length === 1 && stacks.length) stacks[stacks.length - 1].push(row);
    else stacks.push([row]);
  }
  // A section with no pictures after it still needs a place to start.
  return { sections, stacks, trailing: pending };
}

/**
 * A case study, in either language (French where it's been written in
 * Studio, English elsewhere), after mubien.com: the services as tags, the
 * summary as one big line with the services as tags under it, then the story held in a left column while the
 * work runs down the right as touching tiles, each at its own proportions,
 * with the credits at the end and two more projects across the page.
 * The header, footer and Start a brief seal are the site's own.
 */
export async function ProjectPage({ slug, locale }: { slug: string; locale: Locale }) {
  const t = SITE_COPY[locale];
  const home = HOME_COPY[locale];
  const project = await getProject(slug, locale);
  if (!project) notFound();
  const href = (s: string) => localePath(locale, `/projects/${s}`);

  const { sections, stacks, trailing } = arrange(project.blocks, t.project.about);
  const credits = [
    project.client ? { k: t.project.client, v: project.client } : null,
    project.services.length ? { k: t.project.services, v: project.services.join(", ") } : null,
    project.year ? { k: t.project.year, v: String(project.year) } : null,
  ].filter((f): f is { k: string; v: string } => f !== null);

  // More work: the previous and next projects, shown by their covers.
  const neighbours = [project.previous, project.next].filter((n): n is { slug: string; title: string } => n !== null);
  const cards = neighbours.length ? await listProjects({ locale }) : [];
  const more = neighbours.map((n) => {
    const card = cards.find((c) => c.slug === n.slug);
    return { ...n, media: card ? (card.thumbnail ?? card.cover) : null, meta: card?.services.join(", ") ?? "" };
  });

  return (
    <div className="site flex-1 overflow-x-clip" lang={locale}>
      <CaseMotion />
      {project.preview ? <PreviewBanner project={project} french={locale === "fr"} /> : null}
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
        languages={alternates(`/projects/${project.slug}`)}
        city={home.city}
        current="work"
      />

      <main>
        <header className="px-2 pt-[72px]">
          <h1 className="mt-24 text-[34px] leading-[1.14] font-normal tracking-[-0.01em] text-balance lg:mt-[150px] lg:max-w-[60%] lg:text-[3.97vw]">
            {project.summary ? (
              <>
                <span className="sr-only">{project.title}: </span>
                {project.summary}
              </>
            ) : (
              project.title
            )}
          </h1>
          {/* What we did (Naming, Branding, Packaging…), under the line. */}
          {project.services.length ? (
            <ul className="mt-8 flex flex-wrap gap-1.5 lg:mt-10" aria-label={t.project.services}>
              {project.services.map((s) => (
                <li key={s} className="rounded-[4px] bg-panel px-2 py-1.5 text-[13px] leading-none text-ink-soft">
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        <section className="grid gap-2 px-2 pt-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:pt-14">
          <CaseStory sections={sections} />

          {/* 8px between tiles, across and down, as on mubien.com. */}
          <div className="grid min-w-0 gap-2">
            {project.cover ? (
              <div className="case-tile overflow-hidden rounded-[8px] bg-panel" style={{ aspectRatio: ratioOf(project.cover) }}>
                <Media media={project.cover} priority sizes="(min-width: 1024px) 80vw, 100vw" className="size-full! object-cover" />
              </div>
            ) : null}

            {stacks.map((stack) => {
              // Joined: no gap and no curve where pictures meet; the piece keeps its outer corners.
              const joined = stack.length > 1 || stack[0].join;
              return (
                <div key={stack[0].id} className={cn("grid", joined ? "overflow-hidden rounded-[8px]" : "gap-2")}>
                  {stack.map((row) => (
                    <div key={row.id} id={row.marker ?? undefined} className={cn("flex flex-col lg:flex-row lg:items-start", !joined && "gap-2")}>
                      {row.media.map((m) => (
                        <div
                          key={m.id}
                          data-scroll-inside={row.scroll ? "" : undefined}
                          // Side by side, each takes width by its proportions so the row lines up top and bottom.
                          className={cn(
                            "case-tile min-w-0 overflow-hidden bg-panel lg:[flex:var(--r)_1_0]",
                            !joined && "rounded-[8px]",
                            row.scroll && "overflow-y-auto",
                          )}
                          style={{ aspectRatio: row.scroll ? "16 / 9" : ratioOf(m), "--r": row.scroll ? 16 / 9 : ratioOf(m) } as CSSProperties}
                        >
                          <Media
                            media={m}
                            sizes={`(min-width: 1024px) ${Math.round(80 / row.media.length)}vw, 100vw`}
                            className={row.scroll ? undefined : "size-full! object-cover"}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
            {trailing ? <div id={trailing} className="-mt-2" /> : null}

            {credits.length ? (
              <dl className="case-tile grid gap-7 rounded-[8px] bg-panel px-6 py-8 sm:grid-cols-3 sm:gap-x-10 sm:px-10 sm:py-12">
                {credits.map((c) => (
                  <div key={c.k}>
                    <dt className="text-[17px] leading-[1.4]">{c.k}</dt>
                    <dd className="text-[17px] leading-[1.5] font-[350] text-muted">{c.v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>

        {more.length ? (
          <nav aria-label={t.project.more} className="mt-28 grid gap-2 px-2 sm:grid-cols-2 lg:mt-32">
            <div className="px-1 pb-2 font-mono text-[11px] tracking-[0.08em] text-muted uppercase sm:col-span-2">{t.project.more}</div>
            {more.map((n) => (
              <Link key={n.slug} href={href(n.slug)} className="group block">
                <div className="case-tile aspect-[3/2] overflow-hidden rounded-[8px] bg-panel">
                  {n.media ? <Media media={n.media} sizes="(min-width: 640px) 50vw, 100vw" aspect="3 / 2" className="size-full! object-cover" /> : null}
                </div>
                <div className="flex justify-between gap-4 px-1 pt-3.5 text-[17px]">
                  <span className="group-hover:text-muted">{n.title}</span>
                  <span className="text-muted">{n.meta}</span>
                </div>
              </Link>
            ))}
          </nav>
        ) : null}
      </main>

      <SiteFooter />
      <BriefSeal label={home.contact.cta} href={localePath(locale, "/start")} />
    </div>
  );
}
