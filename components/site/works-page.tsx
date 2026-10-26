import Link from "next/link";
import { listProjects } from "@/lib/portfolio";
import { Media } from "@/components/portfolio/media";
import { LanguageSwitch } from "@/components/site/language-switch";
import { Mono, Wordmark } from "@/components/ui/primitives";
import { SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";

/**
 * Reference Works page, built on the portfolio engine, in either language.
 * Plain on purpose: the site design replaces the look, the data calls stay.
 */
export async function WorksPage({ locale }: { locale: Locale }) {
  const t = SITE_COPY[locale];
  const projects = await listProjects({ locale });

  return (
    <main lang={locale} className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 sm:px-10">
      <header className="flex h-16 items-center justify-between gap-6">
        <Link href={localePath(locale, "/")} aria-label={t.homeLabel}>
          <Wordmark className="text-2xl" />
        </Link>
        <div className="flex items-center gap-6">
          <Mono>{t.works.count(projects.length)}</Mono>
          <LanguageSwitch locale={locale} paths={alternates("/projects")} />
        </div>
      </header>
      <h1 className="border-b border-ink pt-10 pb-6 text-display font-medium">{t.works.title}</h1>
      {projects.length ? (
        <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2">
          {projects.map((p, i) => (
            <li key={p.id}>
              <Link href={localePath(locale, `/projects/${p.slug}`)} className="group block">
                {p.cover ? <Media media={{ ...p.cover, hasAudio: false }} priority={i < 2} /> : <div className="aspect-[4/3] bg-panel" />}
                <div className="mt-3 flex items-baseline justify-between gap-4">
                  <h2 className="text-[19px] font-medium group-hover:underline group-hover:underline-offset-4">{p.title}</h2>
                  {p.year ? <Mono>{p.year}</Mono> : null}
                </div>
                {p.summary ? <p className="mt-1.5 max-w-[60ch] text-[15px] text-ink-soft">{p.summary}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-ink-soft">{t.works.empty}</p>
      )}
    </main>
  );
}
