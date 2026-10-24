import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProject } from "@/lib/portfolio";
import { ProjectBlocks } from "@/components/portfolio/blocks";
import { Media } from "@/components/portfolio/media";
import { PreviewBanner } from "@/components/portfolio/preview-banner";
import { Mono, Wordmark } from "@/components/ui/primitives";

/**
 * Reference case-study page, built on the portfolio engine. Plain on
 * purpose: the site design replaces the look, the data calls stay the same.
 */
export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const project = await getProject((await params).slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary ?? undefined,
    openGraph: project.cover?.kind === "image" ? { images: [project.cover.url] } : undefined,
  };
}

export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <Project params={params} />
    </Suspense>
  );
}

async function Project({ params }: Pick<PageProps<"/projects/[slug]">, "params">) {
  const project = await getProject((await params).slug);
  if (!project) notFound();

  return (
    <>
      {project.preview ? <PreviewBanner project={project} /> : null}
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 sm:px-10">
        <header className="flex h-16 items-center justify-between">
          <Link href="/">
            <Wordmark className="text-2xl" />
          </Link>
          <Link href="/projects" className="text-[15px] hover:text-muted">
            Works
          </Link>
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

        <nav aria-label="More projects" className="mt-20 flex justify-between gap-6 border-t border-rule pt-6 text-[15px]">
          {project.previous ? <Link href={`/projects/${project.previous.slug}`}>← {project.previous.title}</Link> : <span />}
          {project.next ? <Link href={`/projects/${project.next.slug}`}>{project.next.title} →</Link> : null}
        </nav>
      </main>
    </>
  );
}
