import Link from "next/link";
import { LANGUAGE, LOCALES, type Locale } from "@/lib/i18n/site";
import { cn } from "@/components/ui/primitives";

/** EN / FR: the same page in each language, the current one lit. */
export function LanguageSwitch({ locale, paths, className }: { locale: Locale; paths: Record<Locale, string>; className?: string }) {
  return (
    <nav aria-label={LANGUAGE[locale].label} className={cn("flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.08em] text-muted", className)}>
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden>/</span> : null}
          <Link
            href={paths[l]}
            hrefLang={l}
            lang={l}
            aria-label={LANGUAGE[l].name}
            aria-current={l === locale ? "page" : undefined}
            className={l === locale ? "text-ink" : "hover:text-ink"}
          >
            {l.toUpperCase()}
          </Link>
        </span>
      ))}
    </nav>
  );
}
