import { intakeProjectTypes } from "@/lib/brief/intake";
import { COLUMNS, LABEL, PAGE, SiteFooter } from "@/components/site/site-frame";
import { SiteHeader } from "@/components/site/site-header";
import { cn } from "@/components/ui/primitives";
import { HOME_COPY } from "@/lib/i18n/home";
import { START_COPY } from "@/lib/i18n/start";
import { SITE_COPY, alternates, localePath, type Locale } from "@/lib/i18n/site";
import { StartForm } from "./start-form";

/**
 * "Start a brief" (the seal on every page): a visitor gives their name,
 * email and what they're making, and goes straight into their own visual
 * brief. Limits and spam checks run on the server (lib/brief/intake.ts).
 */
export async function StartPage({ locale }: { locale: Locale }) {
  const t = START_COPY[locale];
  const home = HOME_COPY[locale];
  const types = (await intakeProjectTypes()).map((p) => ({ value: p.value, label: t.types?.[p.value] ?? p.label }));

  return (
    <div className="site flex-1" lang={locale}>
      <SiteHeader
        locale={locale}
        homeHref={localePath(locale, "/")}
        homeLabel={SITE_COPY[locale].homeLabel}
        links={[
          { id: "work", label: home.nav.work, href: localePath(locale, "/projects") },
          { id: "studio", label: home.nav.studio },
          { id: "contact", label: home.nav.contact, href: `${localePath(locale, "/")}#brief` },
        ]}
        linkBase={localePath(locale, "/")}
        languages={alternates("/start")}
        power={home.power}
      />

      <main className={cn(PAGE, "pt-12 pb-24")}>
        <section className={cn(COLUMNS, "pt-28 sm:pt-40")}>
          <div className={cn(LABEL, "pt-3 text-muted")}>00 / {t.label}</div>
          <div className="min-w-0 max-w-[640px]">
            <h1 className="text-[clamp(44px,5.6vw,80px)] leading-[1.05] font-normal tracking-[-0.02em]">{t.title}</h1>
            <p className="mt-8 text-[19px] leading-[1.65] text-ink-soft">{t.intro}</p>
            <StartForm copy={t} types={types} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
