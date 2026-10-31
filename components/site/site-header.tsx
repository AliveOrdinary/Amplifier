"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark, cn } from "@/components/ui/primitives";
import { LanguageSwitch } from "@/components/site/language-switch";
import { PAGE } from "@/components/site/site-frame";
import type { Locale } from "@/lib/i18n/site";

/**
 * The header, after julienpianetti.com: one thin line of small type fixed to
 * the top, no bar behind it. Logo left; the menu (Work Studio Contact) lined
 * up with the page's text column; language and the Power light right. It
 * blends with what scrolls under it (difference), so it stays readable over
 * dark pages, the orange tile and images alike. The section you're in, and
 * the link under the pointer, go grey. The menu is set light, against the
 * bold logo.
 */
export function SiteHeader({
  locale,
  homeHref,
  homeLabel,
  links,
  languages,
  power,
  linkBase = "",
  current,
}: {
  locale: Locale;
  homeHref: string;
  homeLabel: string;
  /** `href`: a page of its own (Work → /projects) instead of a section of Home. */
  links: { id: string; label: string; href?: string }[];
  languages: Record<Locale, string>;
  /** The label beside the orange light ("Power" / "Marche"). */
  power: string;
  /** On pages other than Home: where the section links go ("/" → "/#work"). */
  linkBase?: string;
  /** The page you're on, when it isn't a section of Home (the Work page: "work"). */
  current?: string;
}) {
  const [active, setActive] = useState<string | null>(current ?? null);

  useEffect(() => {
    if (current) return;
    const update = () => {
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const l of links) {
        const el = document.getElementById(l.id);
        if (el && el.getBoundingClientRect().top <= line) current = l.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = links.at(-1)?.id ?? null;
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [links, current]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 text-white mix-blend-difference">
      <div className={cn(PAGE, "grid grid-cols-[auto_1fr_auto] items-center gap-x-10 py-4 text-[13px] leading-none font-medium lg:grid-cols-[200px_1fr_auto]")}>
        <Link href={homeHref} aria-label={homeLabel} className="pointer-events-auto justify-self-start">
          <Wordmark className="text-[17px]" />
        </Link>

        <nav aria-label="Main" className="pointer-events-auto justify-self-start">
          {/* Smaller on phones, so the line stays light; 13px from tablet up. */}
          <ul className="flex flex-wrap gap-x-3 text-[11px] font-light sm:gap-x-4 sm:text-[13px] min-[900px]:text-[15px]">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.href ?? `${linkBase}#${l.id}`}
                  aria-current={active === l.id ? "location" : undefined}
                  className={cn("transition-colors duration-100", active === l.id ? "text-white/45" : "hover:text-white/45")}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="pointer-events-auto flex items-center gap-6 justify-self-end">
          <LanguageSwitch locale={locale} paths={languages} className="text-[11px] text-white/45 [&_[aria-current]]:text-white [&_a:hover]:text-white" />
          <span className="hidden items-center gap-2 font-mono text-[11px] tracking-[0.08em] uppercase sm:flex">
            <span aria-hidden className="power-led size-2 rounded-full bg-signal shadow-[0_0_10px_var(--signal)]" />
            {power}
          </span>
        </div>
      </div>
    </header>
  );
}
