import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectPage, projectMetadata } from "@/components/site/project-page";

export async function generateMetadata({ params }: PageProps<"/fr/projects/[slug]">): Promise<Metadata> {
  return projectMetadata((await params).slug, "fr");
}

/** A case study in French: French where it's been written in Studio, English elsewhere. */
export default function ProjectFr({ params }: PageProps<"/fr/projects/[slug]">) {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <Resolved params={params} />
    </Suspense>
  );
}

async function Resolved({ params }: Pick<PageProps<"/fr/projects/[slug]">, "params">) {
  return <ProjectPage slug={(await params).slug} locale="fr" />;
}
