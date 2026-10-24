import type { Metadata } from "next";
import Link from "next/link";
import { listProjects } from "@/lib/portfolio";
import { Media } from "@/components/portfolio/media";
import { Mono, Wordmark } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Works" };

/**
 * Reference Works page, built on the portfolio engine. Plain on purpose:
 * the site design replaces the look, the data calls stay the same.
 */
export default async function WorksPage() {
  const projects = await listProjects();

  return (
    <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 sm:px-10">
      <header className="flex h-16 items-center justify-between">
        <Link href="/">
          <Wordmark className="text-2xl" />
        </Link>
        <Mono>{projects.length} projects</Mono>
      </header>
      <h1 className="border-b border-ink pt-10 pb-6 text-display font-medium">Works</h1>
      {projects.length ? (
        <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2">
          {projects.map((p, i) => (
            <li key={p.id}>
              <Link href={`/projects/${p.slug}`} className="group block">
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
        <p className="mt-10 text-ink-soft">No published projects yet.</p>
      )}
    </main>
  );
}
