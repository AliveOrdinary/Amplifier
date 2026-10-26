import Link from "next/link";
import type { ReactNode } from "react";
import { listProjects, type ProjectCard } from "@/lib/portfolio";
import { Desk } from "@/components/portfolio/desk";
import { GREETINGS } from "@/components/site/greetings";
import { Preloader } from "@/components/site/preloader";
import { Wordmark, cn } from "@/components/ui/primitives";

const label = "font-mono text-[12px] uppercase tracking-[0.08em]";

const TEAM = [
  { name: "Eldhose Kuriyan", role: "Art direction, design" },
  { name: "Francis Xavier", role: "Art direction, design" },
  { name: "Navaneeth Krishnan", role: "Technology" },
];

const FACTS = [
  { k: "Who", v: "Amplifier Studio" },
  { k: "What", v: "Branding, type and motion" },
  { k: "Where", v: "Toronto · Remote" },
  { k: "How", v: "It starts with a visual brief" },
];

// TODO: the studio's email address.
const STUDIO_EMAIL = "[studio email]";

export default async function Home() {
  const projects = await featuredProjects();

  return (
    <div className="site flex-1">
      <Preloader />

      <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md">
        <div className="mx-auto grid h-[72px] w-full max-w-[1360px] grid-cols-[1fr_auto] items-center px-4 sm:grid-cols-3 sm:px-10">
          <Link href="/" aria-label="Amplifier, home" className="justify-self-start">
            <Wordmark className="text-2xl" />
          </Link>
          <nav aria-label="Main" className={cn(label, "flex gap-6 justify-self-end text-[13px] text-muted sm:justify-self-center sm:gap-10")}>
            <a href="#work" className="hover:text-ink">Work</a>
            <a href="#studio" className="hover:text-ink">Studio</a>
            <a href="#contact" className="hover:text-ink">Contact</a>
          </nav>
          <span className={cn(label, "hidden items-center gap-2 justify-self-end sm:flex")}>
            <span aria-hidden className="power-led size-2 rounded-full bg-signal shadow-[0_0_10px_var(--signal)]" />
            Power
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1360px] px-4 sm:px-10">
        <Section n="00" name="MMXXVI" id="top" first>
          <h1 className="text-[clamp(48px,7vw,96px)] leading-[0.92] font-medium tracking-[-0.035em]">
            Branding, type and motion for people who make things.
          </h1>
          <p className="mt-8 max-w-[520px] text-lg leading-relaxed text-ink-soft">
            Every project is a channel. Move the faders to your taste, and the work that fits comes up.
          </p>
          <dl className="mt-14 grid gap-x-8 gap-y-5 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.k}>
                <dt className={cn(label, "text-muted")}>{f.k}</dt>
                <dd className="mt-1.5 text-[17px]">{f.v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section n="01" name="Selected" id="work" title="Selected work, on the desk.">
          <Desk projects={projects} />
        </Section>

        <Section n="02" name="Studio" id="studio" title="Who’s at the desk.">
          <p className="max-w-[860px] text-[clamp(22px,2.4vw,30px)] leading-[1.3] tracking-[-0.01em] text-ink-soft">
            We build brands from the name up, for musicians, filmmakers, cafés and anyone with something to say. Every
            project starts by finding the one idea that holds it all together.
          </p>
          <ul className="mt-12 border-t border-rule">
            {TEAM.map((p) => (
              <li key={p.name} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-6">
                <span className="text-[clamp(26px,3vw,40px)] leading-none font-medium tracking-[-0.02em]">{p.name}</span>
                <span className={cn(label, "text-muted")}>{p.role}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section n="03" name="Contact" id="contact" title="Every project starts with a visual brief.">
          <p className="max-w-[620px] text-lg leading-relaxed text-ink-soft">
            Tell us about yours and we’ll send you one: a few questions and a run of images that show us your taste
            before we meet.
          </p>
          <a
            href={STUDIO_EMAIL.startsWith("[") ? "#contact" : `mailto:${STUDIO_EMAIL}`}
            className="mt-10 inline-flex items-center gap-4 rounded-full border border-rule-strong py-3 pr-3 pl-7 text-[clamp(20px,2.4vw,30px)] tracking-[-0.01em] transition-colors hover:border-signal"
          >
            {STUDIO_EMAIL}
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-ink text-lg text-paper">↗</span>
          </a>
        </Section>
      </main>

      <footer className="mx-auto mt-24 w-full max-w-[1360px] px-4 sm:px-10">
        <div className={cn(label, "flex flex-wrap justify-between gap-4 border-t border-rule pt-6 pb-10 normal-case text-muted")}>
          <span className="flex flex-wrap gap-x-3">
            {GREETINGS.map((g) => (
              <span key={g}>{g}</span>
            ))}
          </span>
          <span className="uppercase">© MMXXVI Amplifier</span>
        </div>
      </footer>
    </div>
  );
}

/** A numbered section: "01 / Selected" on the left, the title and content on the right (stacked on phones). */
function Section({
  n,
  name,
  id,
  title,
  first,
  children,
}: {
  n: string;
  name: string;
  id: string;
  title?: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("grid scroll-mt-24 gap-x-10 gap-y-6 lg:grid-cols-[200px_1fr]", first ? "pt-20 sm:pt-28" : "pt-32 sm:pt-40")}>
      <div className={cn(label, "pt-3 text-muted")}>
        {n} / {name}
      </div>
      <div className="min-w-0">
        {title ? (
          <h2 className="mb-12 max-w-[900px] text-[clamp(40px,5.6vw,80px)] leading-[0.95] font-medium tracking-[-0.03em]">{title}</h2>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** Featured projects; with no database during local design work, sample projects stand in. */
async function featuredProjects(): Promise<ProjectCard[]> {
  try {
    return await listProjects({ featured: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    console.warn("Home: portfolio unavailable, showing sample projects.");
    return SAMPLE;
  }
}

const sample = (slug: string, title: string, service: string, year: number, url: string | null): ProjectCard => ({
  id: slug,
  slug,
  title,
  client: null,
  year,
  services: [service],
  summary: null,
  featured: true,
  cover: url ? { id: `${slug}-cover`, kind: "image", url, width: null, height: null, alt: title, caption: null, hasAudio: false } : null,
  publishedAt: null,
});

const SAMPLE: ProjectCard[] = [
  sample("crums", "Crums", "Packaging", 2025, "/images/uploads/crums/crums-master-.jpg"),
  sample("sanjo-construction", "Sanjo Construction", "Identity", 2025, null),
  sample("teeta", "Teeta", "Naming", 2024, null),
];
