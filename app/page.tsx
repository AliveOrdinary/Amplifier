import Link from "next/link";
import { listProjects, type ProjectCard } from "@/lib/portfolio";
import { Desk } from "@/components/portfolio/desk";
import { Wordmark } from "@/components/ui/primitives";

const mono = "font-mono text-label uppercase tracking-[0.08em]";

const TEAM = [
  { name: "Eldhose Kuriyan", role: "Art direction, design" },
  { name: "Francis Xavier", role: "Art direction, design" },
  { name: "Navaneeth Krishnan", role: "Technology" },
];

// TODO: the studio's email address.
const STUDIO_EMAIL = "[studio email]";

export default async function Home() {
  const projects = await featuredProjects();

  return (
    <div className="theme-paper flex-1">
      <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-10">
        <header className="flex min-h-[72px] flex-wrap items-center gap-x-6 gap-y-2 border-b border-ink py-3">
          <Link href="/" aria-label="Amplifier, home">
            <Wordmark className="text-2xl" />
          </Link>
          <span className={`${mono} hidden text-muted md:inline`}>Independent design studio · Toronto</span>
          <nav aria-label="Main" className="ml-auto flex gap-5 text-base sm:gap-7">
            <a href="#work" className="hover:text-muted">Work</a>
            <a href="#studio" className="hover:text-muted">Studio</a>
            <a href="#contact" className="hover:text-muted">Contact</a>
          </nav>
          <span className={`${mono} hidden items-center gap-2 sm:flex`}>
            <span aria-hidden className="power-led size-2 rounded-full bg-signal" />
            Power
          </span>
        </header>

        <section id="top" className="flex flex-wrap items-end gap-8 pt-14 pb-10 sm:pt-[72px] sm:pb-12">
          <h1 className="flex-[999_1_620px] text-[clamp(44px,6.4vw,76px)] font-medium leading-[0.98] tracking-[-0.035em]">
            Branding, type and motion for people who make things.
          </h1>
          <p className="max-w-[360px] flex-[1_1_280px] text-lg leading-[1.45] text-ink-soft">
            Every project is a channel. Move the faders to your taste, and the work that fits comes up.
          </p>
        </section>

        <Desk projects={projects} />

        <section id="studio" className="flex flex-wrap gap-10 border-b border-ink py-20 sm:py-24">
          <div className={`${mono} max-w-[260px] flex-[1_1_220px] text-muted`}>Studio</div>
          <div className="flex flex-[999_1_600px] flex-col gap-10">
            <p className="max-w-[920px] text-[clamp(26px,3vw,36px)] leading-[1.15] tracking-[-0.02em]">
              We build brands from the name up, for musicians, filmmakers, cafés and anyone with something to say. Every
              project starts by finding the one idea that holds it all together.
            </p>
            <ul className="grid gap-6 border-t border-ink pt-4 sm:grid-cols-3">
              {TEAM.map((p) => (
                <li key={p.name}>
                  <div className="text-lg">{p.name}</div>
                  <div className="mt-1 text-sm text-muted">{p.role}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="contact" className="flex flex-wrap gap-10 pt-20 pb-16 sm:pt-24">
          <div className={`${mono} max-w-[260px] flex-[1_1_220px] text-muted`}>Contact</div>
          <div className="flex-[999_1_600px]">
            <h2 className="text-[clamp(36px,4.6vw,56px)] font-medium leading-none tracking-[-0.03em]">
              Every project starts with a visual brief.
            </h2>
            <p className="mt-5 max-w-[620px] text-lg leading-normal text-ink-soft">
              Tell us about yours and we’ll send you one: a few questions and a run of images that show us your taste
              before we meet.
            </p>
            <a
              href={STUDIO_EMAIL.startsWith("[") ? "#contact" : `mailto:${STUDIO_EMAIL}`}
              className="mt-7 inline-block text-[clamp(24px,2.6vw,32px)] tracking-[-0.01em] underline underline-offset-[6px] hover:text-muted"
            >
              {STUDIO_EMAIL}
            </a>
          </div>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-ink pt-5 pb-8 font-mono text-label tracking-[0.06em] text-muted">
          <span>Hello · Bonjour · नमस्ते · നമസ്ക്കാരം · வணக்கம் · హలో · مرحبًا</span>
          <span>© {new Date().getFullYear()} AMPLIFIER</span>
        </footer>
      </div>
    </div>
  );
}

/** Featured projects; with no database during local design work, the old site's Crums stands in. */
async function featuredProjects(): Promise<ProjectCard[]> {
  try {
    return await listProjects({ featured: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    console.warn("Home: portfolio unavailable, showing sample projects.", error);
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
  sample("teeta", "Teeta", "Naming, identity", 2024, null),
];
